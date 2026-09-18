const express = require('express');
const router = express.Router();
const { authenticate, authorize, authorizeModule } = require('../middleware/auth');
const workflowController = require('../controllers/workflowController');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');

const submitValidation = [
  body('workflowKey').notEmpty().withMessage('workflowKey is required'),
  body('recordId').notEmpty().withMessage('recordId is required'),
  body('recordType').notEmpty().withMessage('recordType is required'),
  body('initialData').optional().isObject()
];

const approveValidation = [
  param('approvalRequestId').notEmpty().withMessage('approvalRequestId is required'),
  body('notes').optional().isString()
];

const rejectValidation = [
  param('approvalRequestId').notEmpty().withMessage('approvalRequestId is required'),
  body('notes').notEmpty().withMessage('Rejection reason is required')
];

// ── Workflow Routes ──────────────────────────────────────────────

// Role-scoped workflow dashboard data (per-role counts, pending queue,
// recent decisions, own submissions). Available to every authenticated role.
router.get('/dashboard', authenticate, workflowController.getRoleDashboard);

// Submit record for approval (creates workflow instance)
router.post('/submit', authenticate, validate(submitValidation), workflowController.submitForApproval);

// Approve a request
router.post('/approve/:approvalRequestId', authenticate, authorize('Admin', 'Super Admin', 'Manager'), validate(approveValidation), workflowController.approve);

// Reject a request
router.post('/reject/:approvalRequestId', authenticate, authorize('Admin', 'Super Admin', 'Manager'), validate(rejectValidation), workflowController.reject);

// Get pending approvals for current user
router.get('/pending', authenticate, workflowController.getPendingApprovals);

// Get workflow instance details
router.get('/instance/:instanceId', authenticate, workflowController.getWorkflowInstance);

// Get approval history for an instance
router.get('/history/:instanceId', authenticate, workflowController.getApprovalHistory);

// Get workflow definitions (Admin)
router.get('/definitions', authenticate, authorize('Admin', 'Super Admin'), workflowController.getWorkflowDefinitions);

// Get workflow stats for dashboard
router.get('/stats', authenticate, workflowController.getWorkflowStats);

// Manually trigger auto-advance (Admin)
router.post('/auto-advance/:instanceId', authenticate, authorize('Admin', 'Super Admin'), workflowController.triggerAutoAdvance);

// Get workflow notifications
router.get('/notifications', authenticate, workflowController.getNotifications);

// Mark notification as read
router.post('/notifications/:notificationId/read', authenticate, workflowController.markNotificationRead);

// Mark all notifications as read
router.post('/notifications/read-all', authenticate, workflowController.markAllNotificationsRead);

// Reassign approval request (Admin)
router.post('/reassign/:approvalRequestId', authenticate, authorize('Admin', 'Super Admin'), [
  body('assignedToUserId').optional().isInt(),
  body('assignedToRole').optional().isString(),
  body('assignedLocationId').optional().isInt()
], workflowController.reassignApproval);

module.exports = router;