const express = require('express');
const router = express.Router();
const weddingController = require('../controllers/weddingController');
const { authenticate, authorize } = require('../middleware/auth');
const { errorRes } = require('../utils/response');
const multer = require('multer');

// CSV uploads are parsed in-memory (max 2 MB) — nothing touches the disk.
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.csv$/i.test(file.originalname) || file.mimetype === 'text/csv';
    cb(ok ? null : new Error('Only .csv files are allowed'), ok);
  }
});

// All wedding CRM routes require authentication
router.use(authenticate);

// ── Dashboard & Stats ─────────────────────────────────────────
router.get('/stats', weddingController.getDashboardStats);

// ── Calling Desk ──────────────────────────────────────────────
router.get('/calling-desk', weddingController.getCallingDesk);

// ── Follow-up Calendar ────────────────────────────────────────
router.get('/calendar', weddingController.getCalendar);

// ── Analytics & Conversion Funnel ─────────────────────────────
router.get('/analytics', weddingController.getAnalytics);

// ── Telecallers List (for assignment dropdown) ────────────────
router.get('/telecallers', weddingController.getTelecallers);

// ── Export Data (Excel / CSV / Report data) ────────────────────
router.get('/export', weddingController.exportData);

// ── Bulk CSV Import (strict validation) ───────────────────────
router.post('/import-csv', (req, res, next) => {
  csvUpload.single('file')(req, res, (err) => {
    if (err) return errorRes(res, err.message || 'CSV upload failed', [], 400);
    return weddingController.importCsv(req, res, next);
  });
});

// ── Duplicate Phone Check ─────────────────────────────────────
router.post('/check-duplicate', weddingController.checkDuplicate);

// ── Log Call Outcome ──────────────────────────────────────────
router.post('/log-call', weddingController.logCall);

// ── Customer CRUD ─────────────────────────────────────────────
router.get('/customers', weddingController.getCustomers);
router.post('/customers', weddingController.createCustomer);
router.get('/customers/:id', weddingController.getCustomerById);
router.put('/customers/:id', weddingController.updateCustomer);
router.delete('/customers/:id', authorize('Admin', 'Super Admin'), weddingController.deleteCustomer);

module.exports = router;
