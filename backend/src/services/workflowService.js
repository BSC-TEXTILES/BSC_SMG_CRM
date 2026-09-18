const crypto = require('crypto');
const pool = require('../config/db');
const auditService = require('./auditService');

/**
 * Workflow & Approval Engine
 * --------------------------------------------------------------------------
 * Drives the strict state machine stored in WorkflowDefinition.transitionsJson.
 *
 * Submission flow (backend enforced, never frontend-timed):
 *   Draft/initial state → Submitted → Pending Admin Approval (20-min deadline)
 *   → approved (Admin action) → configured next state
 *   → auto-advanced (timeout processor) → configured next state
 *
 * All state transitions are validated against the definition; invalid
 * transitions are rejected with an error. Timeout processing is idempotent —
 * the instance row is locked FOR UPDATE and re-validated before advancing.
 *
 * Record-level access control:
 *   A user may only see/act on a workflow instance when they are the
 *   submitter, an assigned approver (role match), an Admin/Super Admin, or
 *   (for non-admin roles) the record belongs to their assigned location.
 */

// Roles that supervise the whole workflow system (respect location scoping
// unless the account is a global admin with no location restriction).
const ADMIN_ROLES = ['Admin', 'Super Admin'];

// Whitelisted ApprovalRequest status filters (never interpolate user input).
const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'auto_advanced', 'cancelled'];

/**
 * Business-record state sync map — when a workflow instance changes state the
 * matching business record's status column is kept in sync so existing module
 * screens reflect the approval outcome. Only add mappings that do not
 * interfere with module-managed state vocabularies.
 */
const RECORD_STATE_SYNC = {
  wedding_registration: {
    table: 'wedding_registrations',
    column: 'status',
    states: {
      draft: 'New',
      submitted: 'New',
      pending_admin_approval: 'Pending Approval',
      approved: 'Approved',
      confirmed: 'Confirmed',
      cancelled: 'Cancelled',
      rejected: 'Rejected'
    }
  }
};

function syncStateFor(recordType, workflowState) {
  const mapping = RECORD_STATE_SYNC[recordType];
  if (!mapping) return null;
  return mapping.states[workflowState] || null;
}

/**
 * Persist the workflow state onto the underlying business record (best-effort:
 * a sync failure must never roll the workflow back — it is re-applied on the
 * next transition).
 */
async function syncRecordState(recordType, recordId, workflowState) {
  const mapping = RECORD_STATE_SYNC[recordType];
  const target = syncStateFor(recordType, workflowState);
  if (!mapping || !target) return;
  try {
    const numericId = Number(recordId);
    if (!Number.isNaN(numericId) && numericId > 0) {
      await pool.query(
        `UPDATE \`${mapping.table}\` SET \`${mapping.column}\` = ? WHERE id = ?`,
        [target, numericId]
      );
    } else {
      // Non-numeric record ids match the table's public identifier column
      await pool.query(
        `UPDATE \`${mapping.table}\` SET \`${mapping.column}\` = ? WHERE registration_id = ?`,
        [target, recordId]
      );
    }
  } catch (err) {
    console.warn('[WorkflowService] Record state sync skipped:', err.message);
  }
}

/**deadline for the given definition (production config: 20 minutes).*/
function computeDeadline(workflowDef, from = Date.now()) {
  const minutes = parseInt(workflowDef.approvalTimeoutMinutes, 10) || 0;
  if (minutes <= 0) return null;
  return new Date(from + minutes * 60 * 1000);
}

/** Resolve the acting identity — public kiosk submissions have no req.user. */
function actorContext(req) {
  const user = req && req.user ? req.user : null;
  return {
    id: user ? user.id : null,
    username: user ? user.username : 'Public/Guest',
    role: user ? user.role : 'Guest',
    locationId: user ? (user.locationId ?? null) : null
  };
}

/** Validate a transition against the workflow definition's state machine. */
function validateTransition(definition, fromState, toState, action) {
  const transitions = definition.transitionsJson || [];
  return transitions.some(t => t.from === fromState && t.to === toState && (t.action === action || (action === 'auto_advance' && t.auto === true)));
}

/** Find the transition object for from+action (exact). */
function findTransition(definition, fromState, action) {
  const transitions = definition.transitionsJson || [];
  return transitions.find(t => t.from === fromState && (t.action === action || (action === 'auto_advance' && t.auto === true))) || null;
}

/**
 * Can this user view/act on this workflow instance?
 * Rules (any one grants access):
 *   - Admin/Super Admin (global admin sees all locations, branch admin only
 *     their own branch instances)
 *   - The user submitted the record
 *   - An approval step for the instance is assigned to the user's role
 *   - Non-admin: instance belongs to the user's assigned location
 */
async function canUserAccessInstance(user, instance) {
  if (!user || !instance) return false;
  if (ADMIN_ROLES.includes(user.role)) {
    if (user.locationId == null) return true; // global admin
    return instance.assignedLocationId == null || Number(instance.assignedLocationId) === Number(user.locationId);
  }
  if (instance.submittedBy != null && Number(instance.submittedBy) === Number(user.id)) return true;

  // Assigned approver for any step on this instance
  const [steps] = await pool.query(
    `SELECT id FROM ApprovalRequest WHERE workflowInstanceId = ? AND (assignedToRole = ? OR requiredRole = ?) LIMIT 1`,
    [instance.id, user.role, user.role]
  );
  if (steps.length > 0) return true;

  if (user.locationId != null && instance.assignedLocationId != null) {
    return Number(instance.assignedLocationId) === Number(user.locationId);
  }
  return false;
}

/** Load full instance row (definition joined) with CamelCase table names. */
async function loadInstance(connection, instanceId) {
  const [rows] = await (connection || pool).query(
    `SELECT wi.*, wd.workflowKey, wd.name AS workflowName, wd.module, wd.statesJson, wd.transitionsJson, wd.approvalTimeoutMinutes
     FROM WorkflowInstance wi
     JOIN WorkflowDefinition wd ON wi.workflowDefinitionId = wd.id
     WHERE wi.id = ?`,
    [instanceId]
  );
  return rows[0] || null;
}

function parseDefinition(instanceRow) {
  const parse = (v) => {
    if (v == null) return v;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch { return []; }
  };
  return {
    transitionsJson: parse(instanceRow.transitionsJson) || [],
    statesJson: parse(instanceRow.statesJson) || [],
    approvalTimeoutMinutes: instanceRow.approvalTimeoutMinutes
  };
}

/**
 * Insert one ApprovalHistory row. System-triggered transitions carry
 * actionByUserId NULL with actionByRole 'System'.
 */
async function insertHistory(connection, { approvalRequestId, workflowInstanceId, action, fromState, toState, actor, details, req }) {
  await connection.query(
    `INSERT INTO ApprovalHistory
       (approvalRequestId, workflowInstanceId, action, fromState, toState,
        actionByUserId, actionByRole, actionDetails, ipAddress, userAgent, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      approvalRequestId || null,
      workflowInstanceId,
      action,
      fromState || null,
      toState || null,
      actor.id,
      actor.role,
      details ? JSON.stringify(details) : null,
      (req && req.ip) || null,
      (req && req.headers && req.headers['user-agent']) || null
    ]
  );
}

/** Insert a WorkflowAuditLog row for a workflow-scoped action. */
async function insertWorkflowAudit(connection, { workflowInstanceId, approvalRequestId, recordId, recordType, actor, action, module, previousState, newState, details, req, correlationId }) {
  await connection.query(
    `INSERT INTO WorkflowAuditLog
       (workflowInstanceId, approvalRequestId, recordId, recordType,
        userId, username, role, action, module, previousState, newState,
        details, ipAddress, userAgent, correlationId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      workflowInstanceId || null,
      approvalRequestId || null,
      recordId || null,
      recordType || null,
      actor.id,
      actor.username || 'System',
      actor.role,
      action,
      module || 'workflow',
      previousState || null,
      newState || null,
      details || null,
      (req && req.ip) || null,
      (req && req.headers && req.headers['user-agent']) || null,
      correlationId || (req && req.correlationId) || null
    ]
  );
}

/** Mirror the workflow action into the central audit_logs trail. */
async function auditTrail({ req, actor, action, module, targetId, targetType, details, success = true }) {
  try {
    await auditService.log({
      req,
      action,
      module,
      details,
      userId: actor.id,
      username: actor.username,
      targetId,
      targetType,
      success
    });
  } catch (err) {
    console.warn('[WorkflowService] Central audit skipped:', err.message);
  }
}

/**
 * Create workflow notifications. Recipients resolved by role (+ location for
 * branch-scoped roles) or an explicit user. Always persisted in the database.
 */
async function createApprovalNotification(connection, params) {
  const { workflowInstanceId, approvalRequestId, recipientUserId, recipientRole, locationId, type, title, message, referenceId, referenceType } = params;

  if (recipientUserId) {
    let role = recipientRole || null;
    if (!role) {
      const [uRows] = await connection.query(`SELECT role FROM users WHERE id = ?`, [recipientUserId]);
      role = uRows.length ? uRows[0].role : null;
    }
    await connection.query(
      `INSERT INTO WorkflowNotification
         (workflowInstanceId, approvalRequestId, recipientUserId, recipientRole, recipientLocationId, type, title, message, referenceId, referenceType, sentAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [workflowInstanceId || null, approvalRequestId || null, recipientUserId, role, locationId || null, type, title, message, referenceId || null, referenceType || null]
    );
    return;
  }

  // Role + location fan-out (Admin with no location restriction receives all)
  let sql = `SELECT id FROM users WHERE active = TRUE AND role = ?`;
  const sqlParams = [recipientRole];
  if (locationId != null) {
    sql += ` AND (location_id = ? OR location_id IS NULL)`;
    sqlParams.push(locationId);
  }
  const [users] = await connection.query(sql, sqlParams);
  for (const user of users) {
    await connection.query(
      `INSERT INTO WorkflowNotification
         (workflowInstanceId, approvalRequestId, recipientUserId, recipientRole, recipientLocationId, type, title, message, referenceId, referenceType, sentAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [workflowInstanceId || null, approvalRequestId || null, user.id, recipientRole, locationId || null, type, title, message, referenceId || null, referenceType || null]
    );
  }
}

/** Get workflow definition by key */
async function getWorkflowDefinition(workflowKey) {
  const [rows] = await pool.query(
    `SELECT * FROM WorkflowDefinition WHERE workflowKey = ? AND isActive = TRUE`,
    [workflowKey]
  );
  if (!rows[0]) return null;
  return { ...rows[0], ...parseDefinition(rows[0]) };
}

/** Get workflow definition by ID */
async function getWorkflowDefinitionById(id) {
  const [rows] = await pool.query(
    `SELECT * FROM WorkflowDefinition WHERE id = ? AND isActive = TRUE`,
    [id]
  );
  if (!rows[0]) return null;
  return { ...rows[0], ...parseDefinition(rows[0]) };
}

/**
 * Create a workflow instance when a record is submitted.
 *
 * The instance starts at the definition's initialState and is immediately
 * walked forward through roleless transitions (e.g. draft→submitted) until it
 * reaches the first approval-gated state (e.g. pending_admin_approval). The
 * approval request for that state gets the definition's timeout deadline —
 * the backend timer that the background processor enforces.
 */
async function createWorkflowInstance(req, workflowKey, recordId, recordType, initialData = {}) {
  const workflowDef = await getWorkflowDefinition(workflowKey);
  if (!workflowDef) {
    throw new Error(`Workflow definition not found: ${workflowKey}`);
  }

  const actor = actorContext(req);

  // Submitter must be allowed to submit for this workflow
  const submitTransition = findTransition(workflowDef, workflowDef.initialState, 'submit');
  if (submitTransition && submitTransition.allowedRoles && !submitTransition.allowedRoles.includes(actor.role) && !ADMIN_ROLES.includes(actor.role)) {
    const err = new Error(`Role ${actor.role} is not allowed to submit this workflow`);
    err.status = 403;
    throw err;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Duplicate-instance guard (one active workflow per record)
    const [existing] = await connection.query(
      `SELECT id FROM WorkflowInstance WHERE recordId = ? AND recordType = ? AND status = 'active'`,
      [recordId, recordType]
    );
    if (existing.length > 0) {
      const err = new Error('An active workflow already exists for this record');
      err.status = 409;
      throw err;
    }

    const [insertResult] = await connection.query(
      `INSERT INTO WorkflowInstance
         (workflowDefinitionId, recordId, recordType, currentState, previousState, nextState,
          status, submittedBy, submittedRole, assignedLocationId, submittedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, NULL, NULL, 'active', ?, ?, ?, NOW(), NOW(), NOW())`,
      [
        workflowDef.id,
        recordId,
        recordType,
        workflowDef.initialState,
        actor.id,
        actor.role,
        actor.locationId
      ]
    );
    const workflowInstanceId = insertResult.insertId;

    // Walk the state machine to the first approval-gated state
    let currentState = workflowDef.initialState;
    await insertHistory(connection, {
      workflowInstanceId,
      action: 'submitted',
      fromState: null,
      toState: currentState,
      actor,
      details: { recordId, recordType, initialData, workflowKey },
      req
    });

    const deadline = computeDeadline(workflowDef);
    let approvalRequestId = null;
    let requiredRole = null;

    let guard = 0;
    while (guard++ < 25) {
      const step = findTransition(workflowDef, currentState, 'submit')
        || findTransition(workflowDef, currentState, 'requires_admin_approval');
      if (!step) break;

      // Stop at the first step that needs a human approver role
      if (step.requiredRole) {
        requiredRole = step.requiredRole;
        break;
      }

      // Auto-walk roleless transition (submit / requires_admin_approval without role)
      const nextState = step.to;
      if (!validateTransition(workflowDef, currentState, nextState, step.action)) break;
      await insertHistory(connection, {
        workflowInstanceId,
        action: 'state_advanced',
        fromState: currentState,
        toState: nextState,
        actor,
        details: { automatic: true, transitionAction: step.action },
        req
      });
      currentState = nextState;
    }

    if (requiredRole) {
      // Create the pending approval request with the backend-enforced deadline
      const [arResult] = await connection.query(
        `INSERT INTO ApprovalRequest
           (workflowInstanceId, stepOrder, currentState, requiredRole, requiredPermission,
            assignedToRole, assignedLocationId, status, requestedAt, deadlineAt, createdAt, updatedAt)
         VALUES (?, 1, ?, ?, ?, ?, ?, 'pending', NOW(), ?, NOW(), NOW())`,
        [
          workflowInstanceId,
          currentState,
          requiredRole,
          (findTransition(workflowDef, currentState, 'approve') || {}).requiredPermission || null,
          requiredRole,
          actor.locationId,
          deadline
        ]
      );
      approvalRequestId = arResult.insertId;

      await connection.query(
        `UPDATE WorkflowInstance SET currentState = ?, previousState = ?, nextState = ?, approvalDeadline = ?, updatedAt = NOW() WHERE id = ?`,
        [currentState, workflowDef.initialState, findTransition(workflowDef, currentState, 'approve')?.to || null, deadline, workflowInstanceId]
      );

      await createApprovalNotification(connection, {
        workflowInstanceId,
        approvalRequestId,
        type: 'approval_required',
        recipientRole: requiredRole,
        locationId: actor.locationId,
        title: 'Approval Required',
        message: `${workflowDef.name}: record ${recordId} requires your approval`,
        referenceId: recordId,
        referenceType: recordType
      });
    } else {
      // No approval step — workflow is complete at the walked state
      await connection.query(
        `UPDATE WorkflowInstance SET currentState = ?, previousState = ?, status = 'completed', completedAt = NOW(), updatedAt = NOW() WHERE id = ?`,
        [currentState, workflowDef.initialState, workflowInstanceId]
      );
    }

    await insertWorkflowAudit(connection, {
      workflowInstanceId,
      approvalRequestId,
      recordId,
      recordType,
      actor,
      action: 'workflow_submitted',
      module: workflowDef.module,
      previousState: workflowDef.initialState,
      newState: currentState,
      details: `Workflow ${workflowDef.name} submitted for record ${recordId}`,
      req
    });

    await auditTrail({
      req,
      actor,
      action: 'WORKFLOW_SUBMIT',
      module: 'Workflow',
      targetId: recordId,
      targetType: recordType,
      details: { workflowKey, workflowInstanceId, currentState, approvalDeadline: deadline }
    });

    await connection.commit();

    return {
      workflowInstanceId,
      approvalRequestId,
      currentState,
      approvalDeadline: deadline,
      requiredRole
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Process an approve/reject action on a pending approval request.
 *
 * Security:
 *   - The approval request row is locked FOR UPDATE (no double-processing race
 *     with the timeout processor or a second admin click).
 *   - Only the role the step is assigned to (or Admin/Super Admin) may act.
 *   - Branch staff may only act on their own location's requests.
 *   - Actions after the deadline are rejected — the timeout processor owns the
 *     record once the window expires.
 */
async function processApproval(req, approvalRequestId, action, notes = '') {
  if (!['approve', 'reject'].includes(action)) {
    const err = new Error('Invalid approval action');
    err.status = 400;
    throw err;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [approvalRows] = await connection.query(
      `SELECT * FROM ApprovalRequest WHERE id = ? AND status = 'pending' FOR UPDATE`,
      [approvalRequestId]
    );
    if (approvalRows.length === 0) {
      const err = new Error('Approval request not found or already processed');
      err.status = 404;
      throw err;
    }
    const approval = approvalRows[0];

    const instance = await loadInstance(connection, approval.workflowInstanceId);
    if (!instance) {
      const err = new Error('Workflow instance not found');
      err.status = 404;
      throw err;
    }
    if (instance.status !== 'active') {
      const err = new Error('Workflow is no longer active');
      err.status = 409;
      throw err;
    }
    const def = parseDefinition(instance);

    const actor = actorContext(req);

    // Role check — derive from DB identity, never from client input
    const userRole = actor.role;
    if (approval.requiredRole && approval.requiredRole !== userRole && !ADMIN_ROLES.includes(userRole)) {
      const err = new Error(`This approval requires the ${approval.requiredRole} role`);
      err.status = 403;
      throw err;
    }

    // Location check for branch-scoped staff
    if (!ADMIN_ROLES.includes(userRole) && actor.locationId != null && approval.assignedLocationId != null
        && Number(approval.assignedLocationId) !== Number(actor.locationId)) {
      const err = new Error('This approval belongs to a different location');
      err.status = 403;
      throw err;
    }

    // Deadline enforcement — late approvals are rejected server-side
    const now = new Date();
    if (approval.deadlineAt && new Date(approval.deadlineAt) < now) {
      const err = new Error('The approval window has expired. The request is queued for automatic transition.');
      err.status = 409;
      throw err;
    }

    // Strict state machine lookup
    const transition = findTransition(def, approval.currentState, action);
    if (!transition || transition.to == null) {
      const err = new Error(`No valid ${action} transition from state ${approval.currentState}`);
      err.status = 409;
      throw err;
    }
    const nextState = transition.to;

    // Persist the decision
    await connection.query(
      `UPDATE ApprovalRequest SET
         status = ?, approvalAction = ?, notes = ?, rejectionReason = ?,
         respondedAt = ?, respondedByUserId = ?, updatedAt = NOW()
       WHERE id = ?`,
      [
        action === 'approve' ? 'approved' : 'rejected',
        action,
        notes || null,
        action === 'reject' ? (notes || null) : null,
        now,
        actor.id,
        approval.id
      ]
    );

    // Chain to the next approval step when the definition requires one
    const nextApprovalTransition = def.transitionsJson.find(t => t.from === nextState && t.requiredRole);
    const hasFurtherApprovals = !!nextApprovalTransition;

    await connection.query(
      `UPDATE WorkflowInstance SET
         currentState = ?, previousState = ?, nextState = ?,
         approvedAt = ?, approvedBy = ?, approvalDeadline = ?,
         status = ?, completedAt = ?, updatedAt = NOW()
       WHERE id = ?`,
      [
        nextState,
        approval.currentState,
        nextApprovalTransition ? nextApprovalTransition.to : null,
        action === 'approve' ? now : null,
        action === 'approve' ? actor.id : null,
        hasFurtherApprovals && action === 'approve' ? computeDeadline(def) : null,
        action === 'reject' ? 'cancelled' : (hasFurtherApprovals ? 'active' : 'completed'),
        !hasFurtherApprovals ? now : null,
        instance.id
      ]
    );

    await insertHistory(connection, {
      approvalRequestId: approval.id,
      workflowInstanceId: instance.id,
      action,
      fromState: approval.currentState,
      toState: nextState,
      actor,
      details: { notes: notes || null, deadlineAt: approval.deadlineAt },
      req
    });

    await insertWorkflowAudit(connection, {
      workflowInstanceId: instance.id,
      approvalRequestId: approval.id,
      recordId: instance.recordId,
      recordType: instance.recordType,
      actor,
      action,
      module: instance.module,
      previousState: approval.currentState,
      newState: nextState,
      details: `${action === 'approve' ? 'Approved' : 'Rejected'}: ${notes || 'No notes'}`,
      req
    });

    if (action === 'approve' && hasFurtherApprovals) {
      const [arResult] = await connection.query(
        `INSERT INTO ApprovalRequest
           (workflowInstanceId, stepOrder, currentState, requiredRole, requiredPermission,
            assignedToRole, assignedLocationId, status, requestedAt, deadlineAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), ?, NOW(), NOW())`,
        [
          instance.id,
          (approval.stepOrder || 1) + 1,
          nextState,
          nextApprovalTransition.requiredRole,
          nextApprovalTransition.requiredPermission || null,
          nextApprovalTransition.requiredRole,
          instance.assignedLocationId,
          computeDeadline(def)
        ]
      );
      await createApprovalNotification(connection, {
        workflowInstanceId: instance.id,
        approvalRequestId: arResult.insertId,
        type: 'approval_required',
        recipientRole: nextApprovalTransition.requiredRole,
        locationId: instance.assignedLocationId,
        title: 'Approval Required',
        message: `Next approval step required for ${instance.recordType} ${instance.recordId}`,
        referenceId: instance.recordId,
        referenceType: instance.recordType
      });
    } else {
      // Notify the submitter of the outcome
      if (instance.submittedBy != null) {
        await createApprovalNotification(connection, {
          workflowInstanceId: instance.id,
          type: action,
          recipientUserId: instance.submittedBy,
          title: action === 'approve' ? 'Request Approved' : 'Request Rejected',
          message: action === 'approve'
            ? `Your ${instance.workflowName} request (${instance.recordId}) has been approved`
            : `Your ${instance.workflowName} request (${instance.recordId}) was rejected: ${notes || 'No reason provided'}`,
          referenceId: instance.recordId,
          referenceType: instance.recordType
        });
      }
      await syncRecordState(instance.recordType, instance.recordId, nextState);
    }

    await auditTrail({
      req,
      actor,
      action: action === 'approve' ? 'WORKFLOW_APPROVE' : 'WORKFLOW_REJECT',
      module: 'Workflow',
      targetId: instance.recordId,
      targetType: instance.recordType,
      details: { workflowInstanceId: instance.id, from: approval.currentState, to: nextState, notes: notes || null }
    });

    await connection.commit();

    return {
      success: true,
      action,
      previousState: approval.currentState,
      nextState,
      workflowInstanceId: instance.id,
      recordStateSynced: syncStateFor(instance.recordType, nextState) != null
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Auto-advance a workflow whose approval deadline has expired.
 *
 * Idempotent: the instance row is locked FOR UPDATE and re-validated —
 * concurrent processors or repeated runs cannot double-advance, duplicate
 * audit entries, or corrupt the state.
 */
async function autoAdvanceWorkflow(workflowInstanceId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [instanceRows] = await connection.query(
      `SELECT wi.*, wd.workflowKey, wd.name AS workflowName, wd.module, wd.statesJson, wd.transitionsJson, wd.approvalTimeoutMinutes
       FROM WorkflowInstance wi
       JOIN WorkflowDefinition wd ON wi.workflowDefinitionId = wd.id
       WHERE wi.id = ? FOR UPDATE`,
      [workflowInstanceId]
    );
    if (instanceRows.length === 0) {
      await connection.rollback();
      return { processed: false, reason: 'Instance not found' };
    }
    const instance = instanceRows[0];

    // Idempotency + deadline guards. No blanket autoAdvanced-flag check: a
    // chained approval step legitimately re-enters this path after the first
    // auto-advance. Correctness comes from the row lock, the still-pending
    // approval request, and the not-yet-advanced current state below.
    if (instance.status !== 'active') {
      await connection.rollback();
      return { processed: false, reason: 'Instance not active' };
    }
    if (!instance.approvalDeadline || new Date(instance.approvalDeadline) > new Date()) {
      await connection.rollback();
      return { processed: false, reason: 'Deadline not yet expired' };
    }

    // Only advance when an approval step is still genuinely pending — a step
    // already decided (approved/rejected/auto-advanced) must never re-fire.
    const [pendingCheck] = await connection.query(
      `SELECT id, stepOrder FROM ApprovalRequest WHERE workflowInstanceId = ? AND status = 'pending' FOR UPDATE`,
      [workflowInstanceId]
    );
    if (pendingCheck.length === 0) {
      await connection.rollback();
      return { processed: false, reason: 'No pending approval request' };
    }

    const def = parseDefinition(instance);
    const autoTransition = findTransition(def, instance.currentState, 'auto_advance');
    if (!autoTransition) {
      await connection.rollback();
      return { processed: false, reason: 'No auto transition configured for current state' };
    }

    const systemActor = { id: null, username: 'System', role: 'System', locationId: null };
    const nextState = autoTransition.to;
    const now = new Date();

    // Close out the pending approval request (locked above) as auto_advanced
    const pendingApproval = pendingCheck[0] || null;
    if (pendingApproval) {
      await connection.query(
        `UPDATE ApprovalRequest SET status = 'auto_advanced', autoAdvanced = TRUE, respondedAt = ?, updatedAt = NOW() WHERE id = ?`,
        [now, pendingApproval.id]
      );
    }

    // Chain to a further approval step when the definition requires one
    const nextApprovalTransition = def.transitionsJson.find(t => t.from === nextState && t.requiredRole);
    const hasFurtherApprovals = !!nextApprovalTransition;

    await connection.query(
      `UPDATE WorkflowInstance SET
         currentState = ?, previousState = ?, nextState = ?,
         autoAdvanced = TRUE, autoAdvancedAt = ?, approvalDeadline = ?,
         status = ?, completedAt = ?, updatedAt = NOW()
       WHERE id = ?`,
      [
        nextState,
        instance.currentState,
        nextApprovalTransition ? nextApprovalTransition.to : null,
        now,
        hasFurtherApprovals ? computeDeadline(def, now.getTime()) : null,
        hasFurtherApprovals ? 'active' : 'completed',
        hasFurtherApprovals ? null : now,
        workflowInstanceId
      ]
    );

    await insertHistory(connection, {
      approvalRequestId: pendingApproval ? pendingApproval.id : null,
      workflowInstanceId,
      action: 'auto_advanced',
      fromState: instance.currentState,
      toState: nextState,
      actor: systemActor,
      details: {
        reason: 'Admin approval window expired without a decision',
        approvalDeadline: instance.approvalDeadline,
        transition: autoTransition
      }
    });

    await insertWorkflowAudit(connection, {
      workflowInstanceId,
      approvalRequestId: pendingApproval ? pendingApproval.id : null,
      recordId: instance.recordId,
      recordType: instance.recordType,
      actor: systemActor,
      action: 'auto_advanced',
      module: instance.module,
      previousState: instance.currentState,
      newState: nextState,
      details: `Auto-advanced: admin approval not completed within ${def.approvalTimeoutMinutes} minutes`,
      correlationId: `auto_${workflowInstanceId}`
    });

    if (hasFurtherApprovals) {
      const [arResult] = await connection.query(
        `INSERT INTO ApprovalRequest
           (workflowInstanceId, stepOrder, currentState, requiredRole, requiredPermission,
            assignedToRole, assignedLocationId, status, requestedAt, deadlineAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), ?, NOW(), NOW())`,
        [
          workflowInstanceId,
          ((pendingApproval && pendingApproval.stepOrder) || 1) + 1,
          nextState,
          nextApprovalTransition.requiredRole,
          nextApprovalTransition.requiredPermission || null,
          nextApprovalTransition.requiredRole,
          instance.assignedLocationId,
          computeDeadline(def, now.getTime())
        ]
      );
      await createApprovalNotification(connection, {
        workflowInstanceId,
        approvalRequestId: arResult.insertId,
        type: 'approval_required',
        recipientRole: nextApprovalTransition.requiredRole,
        locationId: instance.assignedLocationId,
        title: 'Approval Required (Auto-Advanced)',
        message: `Request auto-advanced and now requires your approval (${instance.recordId})`,
        referenceId: instance.recordId,
        referenceType: instance.recordType
      });
    } else {
      if (instance.submittedBy != null) {
        await createApprovalNotification(connection, {
          workflowInstanceId,
          type: 'auto_advanced',
          recipientUserId: instance.submittedBy,
          title: 'Request Auto-Advanced',
          message: `Your ${instance.workflowName} request (${instance.recordId}) advanced automatically after the approval window expired`,
          referenceId: instance.recordId,
          referenceType: instance.recordType
        });
      }
      await syncRecordState(instance.recordType, instance.recordId, nextState);
    }

    await connection.commit();
    return { processed: true, nextState, autoAdvanced: true, previousState: instance.currentState };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Pending approvals visible to the requesting user.
 * Admin sees all (location-scoped for branch admins); other roles see only
 * requests assigned to their role at their location.
 */
async function getPendingApprovals(req, filters = {}) {
  const { page = 1, limit = 20 } = filters;
  // Status filter: whitelist only; 'all' (or anything unknown) means the
  // dashboard's "All" tab and returns every status.
  let statusClause = `ar.status = 'pending'`;
  if (filters.status === 'all') {
    statusClause = `1=1`;
  } else if (APPROVAL_STATUSES.includes(filters.status)) {
    statusClause = `ar.status = ?`;
  }
  const userId = req.user.id;
  const userRole = req.user.role;
  const userLocationId = req.user.locationId ?? null;
  const isAdmin = ADMIN_ROLES.includes(userRole);

  let whereClause = `WHERE ${statusClause} AND wi.status IN ("active", "completed")`;
  const params = [];
  if (statusClause === `ar.status = ?`) params.push(filters.status);

  if (!isAdmin) {
    whereClause += ' AND ar.assignedToRole = ?';
    params.push(userRole);
  } else if (filters.role) {
    whereClause += ' AND ar.assignedToRole = ?';
    params.push(filters.role);
  }

  // Location scoping — never trust a location passed from the client
  if (userLocationId != null) {
    whereClause += ' AND (ar.assignedLocationId = ? OR ar.assignedLocationId IS NULL OR wi.assignedLocationId = ?)';
    params.push(userLocationId, userLocationId);
  }

  const offset = (page - 1) * limit;
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const [rows] = await pool.query(
    `SELECT
      ar.id, ar.workflowInstanceId, ar.stepOrder, ar.currentState, ar.requiredRole,
      ar.requiredPermission, ar.assignedToRole, ar.assignedLocationId, ar.status,
      ar.requestedAt, ar.deadlineAt, ar.respondedAt, ar.respondedByUserId,
      ar.approvalAction, ar.rejectionReason, ar.notes, ar.autoAdvanced,
      wi.recordId, wi.recordType, wi.currentState AS instanceState, wi.previousState,
      wi.nextState, wi.submittedAt, wi.submittedBy, wi.submittedRole, wi.autoAdvanced AS instanceAutoAdvanced,
      u.username AS submittedByUsername, u.full_name AS submittedByName,
      wd.name AS workflowName, wd.module, wd.approvalTimeoutMinutes
    FROM ApprovalRequest ar
    JOIN WorkflowInstance wi ON ar.workflowInstanceId = wi.id
    JOIN WorkflowDefinition wd ON wi.workflowDefinitionId = wd.id
    LEFT JOIN users u ON wi.submittedBy = u.id
    ${whereClause}
    ORDER BY ar.deadlineAt ASC, ar.requestedAt ASC
    LIMIT ${safeLimit} OFFSET ${safeOffset}`
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM ApprovalRequest ar
     JOIN WorkflowInstance wi ON ar.workflowInstanceId = wi.id
     ${whereClause}`,
    params
  );

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total: countRows[0]?.total || 0,
      totalPages: Math.ceil((countRows[0]?.total || 0) / limit)
    }
  };
}

/** Workflow instance details (access-checked by the controller). */
async function getWorkflowInstance(instanceId) {
  const [rows] = await pool.query(
    `SELECT
      wi.*, wd.name AS workflowName, wd.module, wd.workflowKey, wd.statesJson, wd.transitionsJson,
      u.username AS submittedByUsername, u.full_name AS submittedByName, u.role AS submittedByRole
    FROM WorkflowInstance wi
    JOIN WorkflowDefinition wd ON wi.workflowDefinitionId = wd.id
    LEFT JOIN users u ON wi.submittedBy = u.id
    WHERE wi.id = ?`,
    [instanceId]
  );
  return rows[0] || null;
}

/** Approval/state history for a workflow instance. */
async function getApprovalHistory(instanceId) {
  const [rows] = await pool.query(
    `SELECT
      ah.*, u.username, u.full_name AS fullName, u.role
    FROM ApprovalHistory ah
    LEFT JOIN users u ON ah.actionByUserId = u.id
    WHERE ah.workflowInstanceId = ?
    ORDER BY ah.createdAt ASC, ah.id ASC`,
    [instanceId]
  );
  return rows;
}

/** Workflow definitions (Admin console). */
async function getWorkflowDefinitions() {
  const [rows] = await pool.query(
    `SELECT id, workflowKey, name, description, module, initialState, statesJson, transitionsJson,
            approvalTimeoutMinutes, autoTransitionOnTimeout, timeoutNextState, isActive
     FROM WorkflowDefinition WHERE isActive = TRUE ORDER BY name`
  );
  return rows;
}

/**
 * Workflow stats for dashboards — always derived from live database data.
 * Scoped by role: admins see branch/global totals, other roles see the
 * requests assigned to them plus their own submissions.
 */
async function getWorkflowStats(req) {
  const userId = req.user.id;
  const userRole = req.user.role;
  const userLocationId = req.user.locationId ?? null;
  const isAdmin = ADMIN_ROLES.includes(userRole);

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (!isAdmin) {
    whereClause += ' AND (ar.assignedToRole = ? OR wi.submittedBy = ?)';
    params.push(userRole, userId);
  }
  if (userLocationId != null) {
    whereClause += ' AND (wi.assignedLocationId = ? OR wi.assignedLocationId IS NULL)';
    params.push(userLocationId);
  }

  const [stats] = await pool.query(
    `SELECT
      COUNT(CASE WHEN ar.status = 'pending' THEN 1 END) AS pendingApprovals,
      COUNT(CASE WHEN ar.status = 'pending' AND ar.deadlineAt IS NOT NULL AND ar.deadlineAt < NOW() THEN 1 END) AS overdueApprovals,
      COUNT(CASE WHEN ar.status = 'approved' THEN 1 END) AS approvedApprovals,
      COUNT(CASE WHEN ar.status = 'rejected' THEN 1 END) AS rejectedApprovals,
      COUNT(CASE WHEN ar.status = 'auto_advanced' THEN 1 END) AS autoAdvancedApprovals,
      COUNT(CASE WHEN wi.status = 'active' THEN 1 END) AS activeWorkflows,
      COUNT(CASE WHEN wi.status = 'completed' THEN 1 END) AS completedWorkflows,
      COUNT(CASE WHEN wi.status = 'cancelled' THEN 1 END) AS cancelledWorkflows
    FROM WorkflowInstance wi
    LEFT JOIN ApprovalRequest ar ON wi.id = ar.workflowInstanceId
    ${whereClause}`,
    params
  );

  return stats[0];
}

/**
 * Role-scoped dashboard payload — the single endpoint every role's dashboard
 * uses. Returns only what the caller's role/location is authorized to see:
 *   - counts (pending/overdue/approved/rejected/auto-advanced/own submissions)
 *   - the caller's pending approval queue (with remaining time)
 *   - recent decisions relevant to the caller
 *   - the caller's own submitted workflows with current + next state
 */
async function getRoleDashboardData(req) {
  const userId = req.user.id;
  const userRole = req.user.role;
  const userLocationId = req.user.locationId ?? null;
  const isAdmin = ADMIN_ROLES.includes(userRole);

  // ── Approval queue for this user's role/location ──────────────────
  let queueWhere = `WHERE ar.status = 'pending'`;
  const queueParams = [];
  if (!isAdmin) {
    queueWhere += ' AND ar.assignedToRole = ?';
    queueParams.push(userRole);
  }
  if (userLocationId != null) {
    queueWhere += ' AND (ar.assignedLocationId = ? OR ar.assignedLocationId IS NULL)';
    queueParams.push(userLocationId);
  }

  const [pendingQueue] = await pool.query(
    `SELECT
      ar.id, ar.deadlineAt, ar.requestedAt, ar.currentState, ar.assignedToRole,
      wi.id AS workflowInstanceId, wi.recordId, wi.recordType, wi.submittedAt,
      wi.submittedRole, u.username AS submittedByUsername, u.full_name AS submittedByName,
      wd.name AS workflowName, wd.module,
      GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), ar.deadlineAt)) AS remainingSeconds
    FROM ApprovalRequest ar
    JOIN WorkflowInstance wi ON ar.workflowInstanceId = wi.id
    JOIN WorkflowDefinition wd ON wi.workflowDefinitionId = wd.id
    LEFT JOIN users u ON wi.submittedBy = u.id
    ${queueWhere}
    ORDER BY ar.deadlineAt ASC
    LIMIT 8`,
    queueParams
  );

  // ── Counts (role-scoped) ─────────────────────────────────────────
  let countWhere = 'WHERE 1=1';
  const countParams = [];
  if (!isAdmin) {
    countWhere += ' AND (ar.assignedToRole = ? OR wi.submittedBy = ?)';
    countParams.push(userRole, userId);
  }
  if (userLocationId != null) {
    countWhere += ' AND (wi.assignedLocationId = ? OR wi.assignedLocationId IS NULL)';
    countParams.push(userLocationId);
  }

  const [countRows] = await pool.query(
    `SELECT
      COUNT(CASE WHEN ar.status = 'pending' THEN 1 END) AS pendingCount,
      COUNT(CASE WHEN ar.status = 'pending' AND ar.deadlineAt IS NOT NULL AND ar.deadlineAt < NOW() THEN 1 END) AS overdueCount,
      COUNT(CASE WHEN ar.status = 'approved' THEN 1 END) AS approvedCount,
      COUNT(CASE WHEN ar.status = 'rejected' THEN 1 END) AS rejectedCount,
      COUNT(CASE WHEN ar.status = 'auto_advanced' THEN 1 END) AS autoAdvancedCount,
      COUNT(CASE WHEN wi.status = 'completed' AND wi.autoAdvanced = FALSE THEN 1 END) AS completedByApprovalCount,
      COUNT(DISTINCT CASE WHEN wi.submittedBy = ? THEN wi.id END) AS mySubmissionsCount,
      COUNT(CASE WHEN wi.submittedBy = ? AND wi.status = 'active' THEN 1 END) AS myActiveCount
    FROM WorkflowInstance wi
    LEFT JOIN ApprovalRequest ar ON wi.id = ar.workflowInstanceId
    ${countWhere}`,
    [...countParams, userId, userId]
  );

  // ── Recently decided items relevant to this user ─────────────────
  let recentWhere = `WHERE ar.status IN ('approved', 'rejected', 'auto_advanced')`;
  const recentParams = [];
  if (!isAdmin) {
    recentWhere += ' AND (ar.assignedToRole = ? OR wi.submittedBy = ?)';
    recentParams.push(userRole, userId);
  }
  if (userLocationId != null) {
    recentWhere += ' AND (wi.assignedLocationId = ? OR wi.assignedLocationId IS NULL)';
    recentParams.push(userLocationId);
  }

  const [recentDecisions] = await pool.query(
    `SELECT
      ar.id, ar.status, ar.approvalAction, ar.respondedAt, ar.deadlineAt, ar.notes,
      wi.id AS workflowInstanceId, wi.recordId, wi.recordType, wi.currentState,
      wd.name AS workflowName, wd.module,
      ru.username AS respondedByUsername, ru.full_name AS respondedByName
    FROM ApprovalRequest ar
    JOIN WorkflowInstance wi ON ar.workflowInstanceId = wi.id
    JOIN WorkflowDefinition wd ON wi.workflowDefinitionId = wd.id
    LEFT JOIN users ru ON ar.respondedByUserId = ru.id
    ${recentWhere}
    ORDER BY ar.respondedAt DESC
    LIMIT 8`,
    recentParams
  );

  // ── The user's own submissions (any role) ────────────────────────
  const [mySubmissions] = await pool.query(
    `SELECT
      wi.id AS workflowInstanceId, wi.recordId, wi.recordType, wi.currentState,
      wi.previousState, wi.nextState, wi.status, wi.submittedAt, wi.approvalDeadline,
      wi.approvedAt, wi.autoAdvanced, wi.autoAdvancedAt, wi.completedAt,
      wd.name AS workflowName, wd.module
    FROM WorkflowInstance wi
    JOIN WorkflowDefinition wd ON wi.workflowDefinitionId = wd.id
    WHERE wi.submittedBy = ?
    ORDER BY wi.submittedAt DESC
    LIMIT 8`,
    [userId]
  );

  // ── Unread notification count for this user ──────────────────────
  const [unreadRows] = await pool.query(
    `SELECT COUNT(*) AS unread
     FROM WorkflowNotification
     WHERE isRead = FALSE AND (recipientUserId = ? OR recipientRole = ?)`,
    [userId, userRole]
  );

  return {
    role: userRole,
    isApprovalAuthority: isAdmin,
    counts: {
      pending: Number(countRows[0].pendingCount) || 0,
      overdue: Number(countRows[0].overdueCount) || 0,
      approved: Number(countRows[0].approvedCount) || 0,
      rejected: Number(countRows[0].rejectedCount) || 0,
      autoAdvanced: Number(countRows[0].autoAdvancedCount) || 0,
      completedByApproval: Number(countRows[0].completedByApprovalCount) || 0,
      mySubmissions: Number(countRows[0].mySubmissionsCount) || 0,
      myActive: Number(countRows[0].myActiveCount) || 0,
      unreadNotifications: Number(unreadRows[0].unread) || 0
    },
    pendingQueue,
    recentDecisions,
    mySubmissions
  };
}

module.exports = {
  getWorkflowDefinition,
  getWorkflowDefinitionById,
  validateTransition,
  canUserAccessInstance,
  createWorkflowInstance,
  processApproval,
  autoAdvanceWorkflow,
  getPendingApprovals,
  getWorkflowInstance,
  getApprovalHistory,
  getWorkflowDefinitions,
  getWorkflowStats,
  getRoleDashboardData,
  createApprovalNotification,
  syncRecordState
};
