const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const weddingRegistrationController = require('../controllers/weddingRegistrationController');
const { authenticate, authorize } = require('../middleware/auth');
const { errorRes } = require('../utils/response');

// Rate limiter for public tracking (prevent brute-force)
const trackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many tracking attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Public registration route (no auth required for customer registration)
router.post('/public/wedding-registration', weddingRegistrationController.createRegistration);
router.get('/public/wedding-registration/next-id', weddingRegistrationController.getNextRegistrationId);
router.post('/public/wedding-registration/check-duplicate', weddingRegistrationController.checkDuplicate);

// Public tracking route (no auth, rate-limited)
router.post('/public/wedding-registration/track', trackingLimiter, weddingRegistrationController.trackRegistration);

// All other routes require authentication
router.use(authenticate);

// Dashboard Stats
router.get('/wedding-registrations/stats', weddingRegistrationController.getDashboardStats);

// Registration CRUD
router.get('/wedding-registrations', weddingRegistrationController.getRegistrations);
router.get('/wedding-registrations/:id', weddingRegistrationController.getRegistrationById);
router.post('/wedding-registrations', weddingRegistrationController.createRegistration);
router.put('/wedding-registrations/:id', weddingRegistrationController.updateRegistration);
router.delete('/wedding-registrations/:id', authorize('Admin', 'Super Admin', 'HR', 'Manager'), weddingRegistrationController.deleteRegistration);

// Duplicate Check
router.post('/wedding-registrations/check-duplicate', weddingRegistrationController.checkDuplicate);

// Export
router.get('/wedding-registrations/export', weddingRegistrationController.exportRegistrations);

module.exports = router;