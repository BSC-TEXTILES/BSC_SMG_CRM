const express = require('express');
const router = express.Router();
const telecallerDashboardController = require('../controllers/telecallerDashboardController');
const { authenticate } = require('../middleware/auth');

// All telecaller dashboard routes require authentication
router.use(authenticate);

// ── Dashboard Stats ────────────────────────────────────────────
router.get('/stats', telecallerDashboardController.getDashboardStats);

// ── Follow-Up Pipeline ─────────────────────────────────────────
router.get('/pipeline', telecallerDashboardController.getFollowUpPipeline);

// ── Call History ───────────────────────────────────────────────
router.get('/call-history', telecallerDashboardController.getCallHistory);

// ── Performance Metrics ────────────────────────────────────────
router.get('/performance', telecallerDashboardController.getPerformanceMetrics);

// ── Customer Detail ────────────────────────────────────────────
router.get('/customers/:id', telecallerDashboardController.getCustomerDetail);

// ── Recent Customers ───────────────────────────────────────────
router.get('/recent-customers', telecallerDashboardController.getRecentCustomers);

module.exports = router;
