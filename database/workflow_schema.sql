-- Workflow & Approval System Database Schema
-- MySQL 8.0 - Engine: InnoDB, Charset: utf8mb4_unicode_ci

-- 1. Workflow Definition (Configurable workflow templates)
CREATE TABLE IF NOT EXISTS `WorkflowDefinition` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workflowKey` VARCHAR(100) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `module` VARCHAR(100) NOT NULL,
  `initialState` VARCHAR(100) NOT NULL DEFAULT 'draft',
  `statesJson` JSON NOT NULL,
  `transitionsJson` JSON NOT NULL,
  `approvalTimeoutMinutes` INT NOT NULL DEFAULT 20,
  `autoTransitionOnTimeout` BOOLEAN NOT NULL DEFAULT TRUE,
  `timeoutNextState` VARCHAR(100) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Workflow Instance (Each record that enters a workflow)
-- NOTE: No foreign keys to user tables — auth identities live in `users` while
-- legacy `user` rows may not exist; submissions from public/Guest users have a
-- NULL submittedBy. Referential integrity is enforced at the application layer.
CREATE TABLE IF NOT EXISTS `WorkflowInstance` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workflowDefinitionId` INT NOT NULL,
  `recordId` VARCHAR(100) NOT NULL,
  `recordType` VARCHAR(100) NOT NULL,
  `currentState` VARCHAR(100) NOT NULL,
  `previousState` VARCHAR(100) NULL,
  `nextState` VARCHAR(100) NULL,
  `status` ENUM('active', 'completed', 'cancelled', 'expired') NOT NULL DEFAULT 'active',
  `submittedBy` INT NULL,
  `submittedRole` VARCHAR(100) NOT NULL DEFAULT 'Guest',
  `assignedLocationId` INT NULL,
  `assignedDepartmentId` INT NULL,
  `submittedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `approvalDeadline` TIMESTAMP NULL,
  `approvedAt` TIMESTAMP NULL,
  `approvedBy` INT NULL,
  `autoAdvancedAt` TIMESTAMP NULL,
  `autoAdvanced` BOOLEAN NOT NULL DEFAULT FALSE,
  `completedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  INDEX `idx_workflow_record` (`recordType`, `recordId`),
  INDEX `idx_workflow_status` (`status`),
  INDEX `idx_workflow_deadline` (`approvalDeadline`),
  INDEX `idx_workflow_location` (`assignedLocationId`),
  INDEX `idx_workflow_submitted_by` (`submittedBy`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Approval Request (Each approval step in a workflow)
CREATE TABLE IF NOT EXISTS `ApprovalRequest` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workflowInstanceId` INT NOT NULL,
  `stepOrder` INT NOT NULL DEFAULT 1,
  `currentState` VARCHAR(100) NOT NULL,
  `requiredRole` VARCHAR(100) NOT NULL,
  `requiredPermission` VARCHAR(100) NULL,
  `assignedToUserId` INT NULL,
  `assignedToRole` VARCHAR(100) NOT NULL,
  `assignedLocationId` INT NULL,
  `status` ENUM('pending', 'approved', 'rejected', 'auto_advanced', 'cancelled') NOT NULL DEFAULT 'pending',
  `requestedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `deadlineAt` TIMESTAMP NULL,
  `respondedAt` TIMESTAMP NULL,
  `respondedByUserId` INT NULL,
  `approvalAction` VARCHAR(50) NULL,
  `rejectionReason` TEXT NULL,
  `notes` TEXT NULL,
  `autoAdvanced` BOOLEAN NOT NULL DEFAULT FALSE,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  INDEX `idx_approval_instance` (`workflowInstanceId`),
  INDEX `idx_approval_status` (`status`),
  INDEX `idx_approval_deadline` (`deadlineAt`),
  INDEX `idx_approval_assignee` (`assignedToUserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Approval History (Audit trail for each approval action)
CREATE TABLE IF NOT EXISTS `ApprovalHistory` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `approvalRequestId` INT NULL,
  `workflowInstanceId` INT NOT NULL,
  `action` ENUM('submitted', 'approved', 'rejected', 'auto_advanced', 'cancelled', 'reassigned', 'escalated') NOT NULL,
  `fromState` VARCHAR(100) NULL,
  `toState` VARCHAR(100) NULL,
  `actionByUserId` INT NULL,
  `actionByRole` VARCHAR(100) NOT NULL DEFAULT 'System',
  `actionDetails` JSON NULL,
  `ipAddress` VARCHAR(45) NULL,
  `userAgent` TEXT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_history_instance` (`workflowInstanceId`),
  INDEX `idx_history_request` (`approvalRequestId`),
  INDEX `idx_history_action` (`action`),
  INDEX `idx_history_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Workflow Audit Log (General audit for all workflow-related actions)
CREATE TABLE IF NOT EXISTS `WorkflowAuditLog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workflowInstanceId` INT NULL,
  `approvalRequestId` INT NULL,
  `recordId` VARCHAR(100) NULL,
  `recordType` VARCHAR(100) NULL,
  `userId` INT NULL,
  `username` VARCHAR(100) NOT NULL,
  `role` VARCHAR(100) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `module` VARCHAR(100) NOT NULL,
  `previousState` VARCHAR(100) NULL,
  `newState` VARCHAR(100) NULL,
  `previousData` JSON NULL,
  `newData` JSON NULL,
  `details` TEXT NULL,
  `ipAddress` VARCHAR(45) NULL,
  `userAgent` TEXT NULL,
  `correlationId` VARCHAR(100) NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_instance` (`workflowInstanceId`),
  INDEX `idx_audit_record` (`recordType`, `recordId`),
  INDEX `idx_audit_user` (`userId`),
  INDEX `idx_audit_action` (`action`),
  INDEX `idx_audit_module` (`module`),
  INDEX `idx_audit_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Notification Queue (For workflow notifications)
CREATE TABLE IF NOT EXISTS `WorkflowNotification` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workflowInstanceId` INT NULL,
  `approvalRequestId` INT NULL,
  `recipientUserId` INT NULL,
  `recipientRole` VARCHAR(100) NULL,
  `recipientLocationId` INT NULL,
  `type` ENUM('approval_required', 'approved', 'rejected', 'auto_advanced', 'assigned', 'deadline_warning') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `referenceId` VARCHAR(100) NULL,
  `referenceType` VARCHAR(100) NULL,
  `isRead` BOOLEAN NOT NULL DEFAULT FALSE,
  `readAt` TIMESTAMP NULL,
  `sentAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_notif_recipient` (`recipientUserId`, `recipientRole`, `recipientLocationId`),
  INDEX `idx_notif_read` (`isRead`),
  INDEX `idx_notif_type` (`type`),
  INDEX `idx_notif_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Workflow Timeout Processor State (For tracking the background processor)
CREATE TABLE IF NOT EXISTS `WorkflowProcessorState` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `processorName` VARCHAR(100) NOT NULL UNIQUE,
  `lastRunAt` TIMESTAMP NULL,
  `lastRunDurationMs` INT NULL,
  `recordsProcessed` INT NOT NULL DEFAULT 0,
  `recordsAutoAdvanced` INT NOT NULL DEFAULT 0,
  `errorsCount` INT NOT NULL DEFAULT 0,
  `lastError` TEXT NULL,
  `isRunning` BOOLEAN NOT NULL DEFAULT FALSE,
  `nextScheduledAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default workflow definitions
INSERT IGNORE INTO `WorkflowDefinition` (`workflowKey`, `name`, `description`, `module`, `initialState`, `statesJson`, `transitionsJson`, `approvalTimeoutMinutes`, `autoTransitionOnTimeout`, `timeoutNextState`, `isActive`) VALUES
('candidate_hiring', 'Candidate Hiring Workflow', 'Complete candidate recruitment from application to offer', 'candidates', 'draft', 
  '["draft", "submitted", "pending_admin_approval", "approved", "offer_pending", "offer_accepted", "onboarding", "completed", "rejected"]',
  '[{"from": "draft", "to": "submitted", "action": "submit", "allowedRoles": ["HR", "Recruiter", "Admin"]}, {"from": "submitted", "to": "pending_admin_approval", "action": "requires_admin_approval", "requiredRole": "Admin"}, {"from": "pending_admin_approval", "to": "approved", "action": "approve", "requiredRole": "Admin"}, {"from": "pending_admin_approval", "to": "rejected", "action": "reject", "requiredRole": "Admin"}, {"from": "pending_admin_approval", "to": "approved", "action": "auto_advance", "auto": true}, {"from": "approved", "to": "offer_pending", "action": "create_offer", "allowedRoles": ["HR", "Admin"]}, {"from": "offer_pending", "to": "offer_accepted", "action": "candidate_accepts", "allowedRoles": ["Candidate", "HR", "Admin"]}, {"from": "offer_accepted", "to": "onboarding", "action": "start_onboarding", "allowedRoles": ["HR", "Admin"]}, {"from": "onboarding", "to": "completed", "action": "complete_onboarding", "allowedRoles": ["HR", "Admin"]}]',
  20, TRUE, 'approved', TRUE),

('wedding_customer', 'Wedding Customer Follow-up Workflow', 'Wedding customer registration to conversion', 'wedding_crm', 'new',
  '["new", "follow_up_pending", "contacted", "interested", "shopping_date_confirmed", "visited_store", "converted", "not_interested", "closed"]',
  '[{"from": "new", "to": "follow_up_pending", "action": "assign_telecaller", "allowedRoles": ["Admin", "Manager", "Telecaller"]}, {"from": "follow_up_pending", "to": "contacted", "action": "make_call", "allowedRoles": ["Telecaller", "Admin", "Manager"]}, {"from": "contacted", "to": "interested", "action": "show_interest", "allowedRoles": ["Telecaller", "Admin", "Manager"]}, {"from": "interested", "to": "shopping_date_confirmed", "action": "confirm_date", "allowedRoles": ["Telecaller", "Admin", "Manager"]}, {"from": "shopping_date_confirmed", "to": "visited_store", "action": "mark_visited", "allowedRoles": ["Telecaller", "Admin", "Manager"]}, {"from": "visited_store", "to": "converted", "action": "convert", "allowedRoles": ["Admin", "Manager", "Telecaller"]}, {"from": "interested", "to": "not_interested", "action": "mark_not_interested", "allowedRoles": ["Telecaller", "Admin", "Manager"]}, {"from": "not_interested", "to": "closed", "action": "close", "allowedRoles": ["Admin", "Manager"]}, {"from": "converted", "to": "closed", "action": "close", "allowedRoles": ["Admin", "Manager"]}]',
  20, TRUE, 'contacted', TRUE),

('employee_onboarding', 'Employee Onboarding Workflow', 'New employee onboarding process', 'onboarding', 'draft',
  '["draft", "submitted", "pending_admin_approval", "approved", "in_progress", "completed", "rejected"]',
  '[{"from": "draft", "to": "submitted", "action": "submit", "allowedRoles": ["HR", "Admin"]}, {"from": "submitted", "to": "pending_admin_approval", "action": "requires_admin_approval", "requiredRole": "Admin"}, {"from": "pending_admin_approval", "to": "approved", "action": "approve", "requiredRole": "Admin"}, {"from": "pending_admin_approval", "to": "rejected", "action": "reject", "requiredRole": "Admin"}, {"from": "pending_admin_approval", "to": "approved", "action": "auto_advance", "auto": true}, {"from": "approved", "to": "in_progress", "action": "start_onboarding", "allowedRoles": ["HR", "Admin"]}, {"from": "in_progress", "to": "completed", "action": "complete_onboarding", "allowedRoles": ["HR", "Admin"]}]',
  20, TRUE, 'approved', TRUE),

('employee_exit', 'Employee Exit/FnF Workflow', 'Employee exit and full & final settlement process', 'exit', 'draft',
  '["draft", "submitted", "pending_admin_approval", "approved", "in_progress", "completed", "rejected"]',
  '[{"from": "draft", "to": "submitted", "action": "submit", "allowedRoles": ["HR", "Admin"]}, {"from": "submitted", "to": "pending_admin_approval", "action": "requires_admin_approval", "requiredRole": "Admin"}, {"from": "pending_admin_approval", "to": "approved", "action": "approve", "requiredRole": "Admin"}, {"from": "pending_admin_approval", "to": "rejected", "action": "reject", "requiredRole": "Admin"}, {"from": "pending_admin_approval", "to": "approved", "action": "auto_advance", "auto": true}, {"from": "approved", "to": "in_progress", "action": "start_exit", "allowedRoles": ["HR", "Admin"]}, {"from": "in_progress", "to": "completed", "action": "complete_exit", "allowedRoles": ["HR", "Admin"]}]',
  20, TRUE, 'approved', TRUE),

('wedding_registration', 'Wedding Registration Workflow', 'Wedding customer registration approval', 'wedding_registration', 'draft',
  '["draft", "submitted", "pending_admin_approval", "approved", "confirmed", "cancelled"]',
  '[{"from": "draft", "to": "submitted", "action": "submit", "allowedRoles": ["Guest", "Greeter", "Admin", "Manager", "HR", "Recruiter"]}, {"from": "submitted", "to": "pending_admin_approval", "action": "requires_admin_approval", "requiredRole": "Admin"}, {"from": "pending_admin_approval", "to": "approved", "action": "approve", "requiredRole": "Admin"}, {"from": "pending_admin_approval", "to": "cancelled", "action": "reject", "requiredRole": "Admin"}, {"from": "pending_admin_approval", "to": "approved", "action": "auto_advance", "auto": true}, {"from": "approved", "to": "confirmed", "action": "confirm_registration", "allowedRoles": ["Admin", "Manager", "Telecaller", "HR"]}, {"from": "confirmed", "to": "cancelled", "action": "cancel", "allowedRoles": ["Admin", "Manager"]}]',
  20, TRUE, 'approved', TRUE),

('feedback_escalation', 'Feedback Escalation Workflow', 'Negative feedback escalation and resolution', 'feedback', 'new',
  '["new", "pending_admin_approval", "in_progress", "resolved", "escalated", "closed"]',
  '[{"from": "new", "to": "pending_admin_approval", "action": "auto_escalate", "requiredRole": "Admin"}, {"from": "pending_admin_approval", "to": "in_progress", "action": "assign_to_telecaller", "requiredRole": "Admin"}, {"from": "pending_admin_approval", "to": "in_progress", "action": "auto_advance", "auto": true}, {"from": "in_progress", "to": "resolved", "action": "resolve", "allowedRoles": ["Telecaller", "Admin", "Manager"]}, {"from": "in_progress", "to": "escalated", "action": "escalate", "requiredRole": "Admin"}, {"from": "resolved", "to": "closed", "action": "close", "allowedRoles": ["Admin", "Manager"]}, {"from": "escalated", "to": "closed", "action": "close", "requiredRole": "Admin"}]',
  20, TRUE, 'in_progress', TRUE);

-- Seed default processor state
INSERT IGNORE INTO `WorkflowProcessorState` (`processorName`, `nextScheduledAt`) VALUES 
('workflow_timeout_processor', DATE_ADD(NOW(), INTERVAL 1 MINUTE));