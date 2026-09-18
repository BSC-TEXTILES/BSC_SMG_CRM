const pool = require('../config/db');
const workflowService = require('./workflowService');
const { logAction } = require('../utils/logger');

let processorInterval = null;
let isProcessing = false;

/**
 * Process all expired approvals
 */
async function processExpiredApprovals() {
  if (isProcessing) {
    return { processed: 0, autoAdvanced: 0, errors: 0, skipped: true };
  }
  
  isProcessing = true;
  const startTime = Date.now();
  let processed = 0;
  let autoAdvanced = 0;
  let errors = 0;
  
  try {
    // Update processor state
    try {
      await pool.query(`
        UPDATE WorkflowProcessorState SET
          isRunning = TRUE,
          lastRunAt = NOW()
        WHERE processorName = 'workflow_timeout_processor'
      `);
    } catch (stateErr) { /* state table may not exist yet on first boot */ }

    // Find every ACTIVE workflow whose pending approval deadline has expired.
    // Driven by the pending ApprovalRequest deadline (not a one-shot instance
    // flag) so chained approval steps after an auto-advance are also enforced.
    // autoAdvanceWorkflow() itself is idempotent (row locks + re-validation),
    // so duplicate sweeps can never double-transition a record.
    const [expiredInstances] = await pool.query(`
      SELECT DISTINCT wi.id, wi.recordId, wi.recordType, wi.currentState, wi.approvalDeadline,
             wd.workflowKey, wd.module
      FROM WorkflowInstance wi
      JOIN WorkflowDefinition wd ON wi.workflowDefinitionId = wd.id
      JOIN ApprovalRequest ar ON ar.workflowInstanceId = wi.id AND ar.status = 'pending'
      WHERE wi.status = 'active'
        AND ar.deadlineAt IS NOT NULL
        AND ar.deadlineAt < NOW()
    `);
    
    console.log(`[Workflow Processor] Found ${expiredInstances.length} expired approvals to process`);
    
    for (const instance of expiredInstances) {
      try {
        // Use the workflow service to auto-advance
        const result = await workflowService.autoAdvanceWorkflow(instance.id);
        
        if (result.processed) {
          autoAdvanced++;
        }
        processed++;
        
        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (err) {
        console.error(`[Workflow Processor] Error processing instance ${instance.id}:`, err.message);
        errors++;
      }
    }
    
    // Also check for pending approvals that are about to expire (warning notifications)
    await sendDeadlineWarnings();
    
    const duration = Date.now() - startTime;
    
    // Update processor state
    await pool.query(`
      UPDATE WorkflowProcessorState SET
        isRunning = FALSE,
        lastRunDurationMs = ?,
        recordsProcessed = ?,
        recordsAutoAdvanced = ?,
        errorsCount = ?,
        lastError = NULL,
        nextScheduledAt = DATE_ADD(NOW(), INTERVAL 1 MINUTE)
      WHERE processorName = 'workflow_timeout_processor'
    `, [Date.now() - startTime, processed, autoAdvanced, errors]);
    
    if (processed > 0 || autoAdvanced > 0) {
      console.log(`[Workflow Processor] Completed in ${duration}ms: processed=${processed}, autoAdvanced=${autoAdvanced}, errors=${errors}`);
    }
    
    return { processed, autoAdvanced, errors };
    
  } catch (err) {
    console.error('[Workflow Processor] Fatal error:', err);
    
    await pool.query(`
      UPDATE WorkflowProcessorState SET
        isRunning = FALSE,
        lastRunDurationMs = ?,
        errorsCount = ?,
        lastError = ?
      WHERE processorName = 'workflow_timeout_processor'
    `, [Date.now() - startTime, errors + 1, err.message]);
    
    throw err;
  } finally {
    isProcessing = false;
  }
}

/**
 * Send deadline warning notifications (e.g., 5 minutes before deadline)
 */
async function sendDeadlineWarnings() {
  try {
    // Find approvals expiring in 5 minutes
    const [warningApprovals] = await pool.query(`
      SELECT ar.id, ar.workflowInstanceId, ar.deadlineAt, ar.assignedToRole, ar.assignedLocationId,
             wi.recordId, wi.recordType, wi.recordType
      FROM ApprovalRequest ar
      JOIN WorkflowInstance wi ON ar.workflowInstanceId = wi.id
      WHERE ar.status = 'pending'
        AND ar.deadlineAt IS NOT NULL
        AND ar.deadlineAt BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 5 MINUTE)
        AND NOT EXISTS (
          SELECT 1 FROM WorkflowNotification wn 
          WHERE wn.approvalRequestId = ar.id 
            AND wn.type = 'deadline_warning'
            AND wn.createdAt > DATE_SUB(NOW(), INTERVAL 10 MINUTE)
        )
    `);
    
    for (const approval of warningApprovals) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        
        const workflowService = require('./workflowService');
        await workflowService.createApprovalNotification(connection, {
          workflowInstanceId: approval.workflowInstanceId,
          approvalRequestId: approval.id,
          type: 'deadline_warning',
          recipientRole: approval.assignedToRole,
          locationId: approval.assignedLocationId,
          title: 'Approval Deadline Approaching',
          message: `Approval request expires in 5 minutes`,
          referenceId: approval.recordId,
          referenceType: approval.recordType
        });
        
        await connection.commit();
      } catch (err) {
        await connection.rollback();
        console.error('[Workflow Processor] Warning notification error:', err.message);
      } finally {
        connection.release();
      }
    }
  } catch (err) {
    console.error('[Workflow Processor] Deadline warning error:', err.message);
  }
}

/**
 * Start the workflow processor
 * Runs every minute to check for expired approvals
 */
function startWorkflowProcessor() {
  if (processorInterval) {
    console.log('[Workflow Processor] Already running');
    return;
  }
  
  console.log('[Workflow Processor] Starting workflow timeout processor (1-minute interval)...');
  
  // Run immediately on startup
  processExpiredApprovals().catch(err => {
    console.error('[Workflow Processor] Initial run error:', err);
  });
  
  // Then run every minute
  processorInterval = setInterval(() => {
    processExpiredApprovals().catch(err => {
      console.error('[Workflow Processor] Interval error:', err);
    });
  }, 60 * 1000); // 1 minute
  
  // Handle graceful shutdown
  process.on('SIGINT', stopWorkflowProcessor);
  process.on('SIGTERM', stopWorkflowProcessor);
  
  console.log('[Workflow Processor] Started successfully');
}

/**
 * Stop the workflow processor
 */
function stopWorkflowProcessor() {
  if (processorInterval) {
    clearInterval(processorInterval);
    processorInterval = null;
    console.log('[Workflow Processor] Stopped');
  }
}

/**
 * Get processor status
 */
async function getProcessorStatus() {
  const [rows] = await pool.query(`
    SELECT * FROM WorkflowProcessorState WHERE processorName = 'workflow_timeout_processor'
  `);
  return rows[0] || null;
}

/**
 * Manual trigger for testing
 */
async function manualProcess() {
  return await processExpiredApprovals();
}

module.exports = {
  startWorkflowProcessor,
  stopWorkflowProcessor,
  getProcessorStatus,
  processExpiredApprovals,
  manualProcess
};