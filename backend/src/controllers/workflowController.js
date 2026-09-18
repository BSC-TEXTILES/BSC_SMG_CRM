const { errorRes, successRes } = require('../utils/response');
const workflowService = require('../services/workflowService');
const auditService = require('../services/auditService');
const workflowProcessor = require('../services/workflowProcessor');
const pool = require('../config/db');

/**
 * Create workflow instance when a record is submitted
 */
exports.submitForApproval = async (req, res) => {
  try {
    const { workflowKey, recordId, recordType, initialData } = req.body;

    if (!workflowKey || !recordId || !recordType) {
      return errorRes(res, 'workflowKey, recordId, and recordType are required', [], 400);
    }
    if (String(recordId).length > 100 || String(recordType).length > 100) {
      return errorRes(res, 'recordId and recordType must be at most 100 characters', [], 400);
    }

    const result = await workflowService.createWorkflowInstance(req, String(workflowKey), String(recordId), String(recordType), initialData);

    return successRes(res, result, 'Workflow submitted for approval');
  } catch (err) {
    console.error('[WorkflowController.submitForApproval Error]', err);
    return errorRes(res, err.message || 'Failed to submit for approval', [], err.status || 500);
  }
};

/**
 * Approve a workflow request
 */
exports.approve = async (req, res) => {
  try {
    const { approvalRequestId } = req.params;
    const { notes } = req.body;

    if (!/^\d+$/.test(String(approvalRequestId))) {
      return errorRes(res, 'Invalid approval request id', [], 400);
    }

    const result = await workflowService.processApproval(req, parseInt(approvalRequestId, 10), 'approve', notes || '');

    return successRes(res, result, 'Request approved successfully');
  } catch (err) {
    console.error('[WorkflowController.approve Error]', err);
    return errorRes(res, err.message || 'Failed to approve request', [], err.status || 500);
  }
};

/**
 * Reject a workflow request
 */
exports.reject = async (req, res) => {
  try {
    const { approvalRequestId } = req.params;
    const { notes } = req.body;

    if (!/^\d+$/.test(String(approvalRequestId))) {
      return errorRes(res, 'Invalid approval request id', [], 400);
    }
    if (!notes || !notes.trim()) {
      return errorRes(res, 'Rejection reason is required', [], 400);
    }

    const result = await workflowService.processApproval(req, parseInt(approvalRequestId, 10), 'reject', notes.trim());

    return successRes(res, result, 'Request rejected successfully');
  } catch (err) {
    console.error('[WorkflowController.reject Error]', err);
    return errorRes(res, err.message || 'Failed to reject request', [], err.status || 500);
  }
};

/**
 * Get pending approvals for the current user (role/location scoped)
 */
exports.getPendingApprovals = async (req, res) => {
  try {
    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      status: req.query.status,
      role: req.query.role,
      locationId: undefined // never trust a client-sent location scope
    };

    const result = await workflowService.getPendingApprovals(req, filters);

    return successRes(res, result);
  } catch (err) {
    console.error('[WorkflowController.getPendingApprovals Error]', err);
    return errorRes(res, err.message || 'Failed to get pending approvals', [], 500);
  }
};

/**
 * Get workflow instance details (access-controlled: submitter, assigned
 * approver role, Admin of the instance's location, or same-location staff)
 */
exports.getWorkflowInstance = async (req, res) => {
  try {
    const { instanceId } = req.params;
    if (!/^\d+$/.test(String(instanceId))) {
      return errorRes(res, 'Invalid workflow instance id', [], 400);
    }

    const instance = await workflowService.getWorkflowInstance(parseInt(instanceId, 10));
    if (!instance) {
      return errorRes(res, 'Workflow instance not found', [], 404);
    }

    const allowed = await workflowService.canUserAccessInstance(req.user, instance);
    if (!allowed) {
      await auditService.log({
        req,
        action: 'SUSPICIOUS_ACCESS',
        module: 'Workflow',
        details: { attemptedInstanceId: instanceId, endpoint: 'getWorkflowInstance' },
        targetId: instanceId,
        targetType: 'workflow_instance',
        success: false
      });
      return errorRes(res, 'You are not authorized to view this workflow', [], 403);
    }

    const history = await workflowService.getApprovalHistory(instance.id);

    return successRes(res, { ...instance, history });
  } catch (err) {
    console.error('[WorkflowController.getWorkflowInstance Error]', err);
    return errorRes(res, err.message || 'Failed to get workflow instance', [], 500);
  }
};

/**
 * Get workflow definitions (Admin only)
 */
exports.getWorkflowDefinitions = async (req, res) => {
  try {
    const definitions = await workflowService.getWorkflowDefinitions();
    return successRes(res, { definitions });
  } catch (err) {
    console.error('[WorkflowController.getWorkflowDefinitions Error]', err);
    return errorRes(res, err.message || 'Failed to get workflow definitions', [], 500);
  }
};

/**
 * Get workflow stats for dashboard (role/location scoped)
 */
exports.getWorkflowStats = async (req, res) => {
  try {
    const stats = await workflowService.getWorkflowStats(req);
    return successRes(res, { stats });
  } catch (err) {
    console.error('[WorkflowController.getWorkflowStats Error]', err);
    return errorRes(res, err.message || 'Failed to get workflow stats', [], 500);
  }
};

/**
 * Role-scoped workflow dashboard payload — powers the per-role dashboard
 * sections (Admin approval queue, HR/Manager submission tracking).
 * Also opportunistically runs the timeout processor so expired deadlines are
 * advanced even if the background interval was delayed by a restart.
 */
exports.getRoleDashboard = async (req, res) => {
  try {
    // Lazy deadline sweep — idempotent, near-zero cost when nothing expired
    workflowProcessor.processExpiredApprovals().catch(err => {
      console.warn('[WorkflowController] Lazy timeout sweep failed:', err.message);
    });

    const data = await workflowService.getRoleDashboardData(req);
    return successRes(res, data);
  } catch (err) {
    console.error('[WorkflowController.getRoleDashboard Error]', err);
    return errorRes(res, err.message || 'Failed to get workflow dashboard', [], 500);
  }
};

/**
 * Get approval history for a workflow instance (access-controlled)
 */
exports.getApprovalHistory = async (req, res) => {
  try {
    const { instanceId } = req.params;
    if (!/^\d+$/.test(String(instanceId))) {
      return errorRes(res, 'Invalid workflow instance id', [], 400);
    }

    const instance = await workflowService.getWorkflowInstance(parseInt(instanceId, 10));
    if (!instance) {
      return errorRes(res, 'Workflow instance not found', [], 404);
    }

    const allowed = await workflowService.canUserAccessInstance(req.user, instance);
    if (!allowed) {
      await auditService.log({
        req,
        action: 'SUSPICIOUS_ACCESS',
        module: 'Workflow',
        details: { attemptedInstanceId: instanceId, endpoint: 'getApprovalHistory' },
        targetId: instanceId,
        targetType: 'workflow_instance',
        success: false
      });
      return errorRes(res, 'You are not authorized to view this workflow history', [], 403);
    }

    const history = await workflowService.getApprovalHistory(instance.id);
    return successRes(res, { history });
  } catch (err) {
    console.error('[WorkflowController.getApprovalHistory Error]', err);
    return errorRes(res, err.message || 'Failed to get approval history', [], 500);
  }
};

/**
 * Manually trigger auto-advance for a workflow (Admin only).
 * Only advances when the deadline has actually expired — the server-side
 * deadline, not a client countdown, decides.
 */
exports.triggerAutoAdvance = async (req, res) => {
  try {
    const { instanceId } = req.params;
    if (!/^\d+$/.test(String(instanceId))) {
      return errorRes(res, 'Invalid workflow instance id', [], 400);
    }

    const instance = await workflowService.getWorkflowInstance(parseInt(instanceId, 10));
    if (!instance) {
      return errorRes(res, 'Workflow instance not found', [], 404);
    }

    const result = await workflowService.autoAdvanceWorkflow(parseInt(instanceId, 10));
    if (result.processed) {
      await auditService.log({
        req,
        action: 'WORKFLOW_AUTO_ADVANCE',
        module: 'Workflow',
        details: { workflowInstanceId: instanceId, from: result.previousState, to: result.nextState, manual: true },
        targetId: instance.recordId,
        targetType: instance.recordType
      });
    }
    return successRes(res, result, result.processed ? 'Workflow auto-advanced' : 'No auto-advance applied: ' + (result.reason || ''));
  } catch (err) {
    console.error('[WorkflowController.triggerAutoAdvance Error]', err);
    return errorRes(res, err.message || 'Failed to trigger auto-advance', [], 500);
  }
};

/**
 * Get workflow notifications for current user
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const userLocationId = req.user.locationId;
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (safePage - 1) * safeLimit;

    let whereClause = 'WHERE (wn.recipientUserId = ? OR wn.recipientRole = ?)';
    const params = [userId, userRole];

    if (userLocationId != null) {
      whereClause += ' AND (wn.recipientLocationId = ? OR wn.recipientLocationId IS NULL)';
      params.push(userLocationId);
    }

    if (unreadOnly === 'true') {
      whereClause += ' AND wn.isRead = FALSE';
    }

    const [rows] = await pool.query(`
      SELECT wn.*, wi.recordId, wi.recordType, wd.name as workflowName
      FROM WorkflowNotification wn
      LEFT JOIN WorkflowInstance wi ON wn.workflowInstanceId = wi.id
      LEFT JOIN WorkflowDefinition wd ON wi.workflowDefinitionId = wd.id
      ${whereClause}
      ORDER BY wn.createdAt DESC
      LIMIT ${safeLimit} OFFSET ${offset}
    `, params);

    const [countRows] = await pool.query(`
      SELECT COUNT(*) as total
      FROM WorkflowNotification wn
      LEFT JOIN WorkflowInstance wi ON wn.workflowInstanceId = wi.id
      ${whereClause}
    `, params);

    return successRes(res, {
      data: rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: countRows[0]?.total || 0,
        totalPages: Math.ceil((countRows[0]?.total || 0) / safeLimit)
      }
    });
  } catch (err) {
    console.error('[WorkflowController.getNotifications Error]', err);
    return errorRes(res, err.message || 'Failed to get notifications', [], 500);
  }
};

/**
 * Mark notification as read
 */
exports.markNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    if (!/^\d+$/.test(String(notificationId))) {
      return errorRes(res, 'Invalid notification id', [], 400);
    }

    await pool.query(`
      UPDATE WorkflowNotification SET isRead = TRUE, readAt = NOW()
      WHERE id = ? AND recipientUserId = ?
    `, [parseInt(notificationId, 10), userId]);

    return successRes(res, { success: true }, 'Notification marked as read');
  } catch (err) {
    console.error('[WorkflowController.markNotificationRead Error]', err);
    return errorRes(res, err.message || 'Failed to mark notification as read', [], 500);
  }
};

/**
 * Mark all notifications as read
 */
exports.markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(`
      UPDATE WorkflowNotification SET isRead = TRUE, readAt = NOW()
      WHERE recipientUserId = ? AND isRead = FALSE
    `, [userId]);

    return successRes(res, { success: true }, 'All notifications marked as read');
  } catch (err) {
    console.error('[WorkflowController.markAllNotificationsRead Error]', err);
    return errorRes(res, err.message || 'Failed to mark notifications as read', [], 500);
  }
};

/**
 * Reassign a pending approval request to another user/role (Admin only).
 * Fully audited: previous assignment, new assignment, actor and timestamp.
 */
exports.reassignApproval = async (req, res) => {
  try {
    const { approvalRequestId } = req.params;
    const { assignedToUserId, assignedToRole, assignedLocationId } = req.body;

    if (!/^\d+$/.test(String(approvalRequestId))) {
      return errorRes(res, 'Invalid approval request id', [], 400);
    }
    if (!assignedToUserId && !assignedToRole) {
      return errorRes(res, 'Either assignedToUserId or assignedToRole is required', [], 400);
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Lock and load the pending request with its workflow instance
      const [approvalRows] = await connection.query(
        `SELECT ar.*, wi.id AS wiId, wi.recordId, wi.recordType, wd.module
         FROM ApprovalRequest ar
         JOIN WorkflowInstance wi ON ar.workflowInstanceId = wi.id
         JOIN WorkflowDefinition wd ON wi.workflowDefinitionId = wd.id
         WHERE ar.id = ? AND ar.status = 'pending' FOR UPDATE`,
        [parseInt(approvalRequestId, 10)]
      );
      if (approvalRows.length === 0) {
        const err = new Error('Approval request not found or not pending');
        err.status = 404;
        throw err;
      }
      const approval = approvalRows[0];

      const previousAssignment = {
        assignedToUserId: approval.assignedToUserId,
        assignedToRole: approval.assignedToRole,
        assignedLocationId: approval.assignedLocationId
      };

      const now = new Date();
      const updateParams = [now];
      let sql = 'UPDATE ApprovalRequest SET updatedAt = ?';

      if (assignedToUserId) {
        sql += ', assignedToUserId = ?';
        updateParams.push(parseInt(assignedToUserId, 10));
      }
      if (assignedToRole) {
        sql += ', assignedToRole = ?, requiredRole = ?';
        updateParams.push(String(assignedToRole), String(assignedToRole));
      }
      if (assignedLocationId) {
        sql += ', assignedLocationId = ?';
        updateParams.push(parseInt(assignedLocationId, 10));
      }

      sql += ' WHERE id = ?';
      updateParams.push(approval.id);

      await connection.query(sql, updateParams);

      // History entry referencing the REAL workflow instance id
      await connection.query(
        `INSERT INTO ApprovalHistory
           (approvalRequestId, workflowInstanceId, action, fromState, toState,
            actionByUserId, actionByRole, actionDetails, ipAddress, userAgent, createdAt)
         VALUES (?, ?, 'reassigned', ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          approval.id,
          approval.wiId,
          approval.currentState,
          approval.currentState,
          req.user.id,
          req.user.role,
          JSON.stringify({ previousAssignment, assignedToUserId, assignedToRole, assignedLocationId }),
          req.ip || null,
          req.headers['user-agent'] || null
        ]
      );

      // Notify the new assignee role (if role-based reassignment)
      if (assignedToRole && assignedToRole !== previousAssignment.assignedToRole) {
        await workflowService.createApprovalNotification(connection, {
          workflowInstanceId: approval.wiId,
          approvalRequestId: approval.id,
          type: 'assigned',
          recipientRole: assignedToRole,
          locationId: assignedLocationId ? parseInt(assignedLocationId, 10) : approval.assignedLocationId,
          title: 'Approval Assigned to Your Role',
          message: `Approval for ${approval.recordType} ${approval.recordId} was reassigned to ${assignedToRole}`,
          referenceId: approval.recordId,
          referenceType: approval.recordType
        });
      }

      await auditService.log({
        req,
        action: 'WORKFLOW_REASSIGN',
        module: 'Workflow',
        details: { approvalRequestId: approval.id, previousAssignment, assignedToUserId, assignedToRole, assignedLocationId },
        targetId: approval.recordId,
        targetType: approval.recordType
      });

      await connection.commit();

      return successRes(res, { success: true }, 'Approval request reassigned successfully');
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('[WorkflowController.reassignApproval Error]', err);
    return errorRes(res, err.message || 'Failed to reassign approval', [], err.status || 500);
  }
};
