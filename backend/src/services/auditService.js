/**
 * BSC Textiles Portal — Centralized Audit Service
 * Provides consistent audit logging across all controllers.
 * Never stores passwords, tokens, or sensitive authentication secrets.
 */

const pool = require('../config/db');

// Standard event types
const AuditEvents = {
  // Auth
  LOGIN: 'LOGIN',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  // User management
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_ACTIVATE: 'USER_ACTIVATE',
  USER_DEACTIVATE: 'USER_DEACTIVATE',
  USER_DELETE: 'USER_DELETE',
  // Roles & Permissions
  ROLE_CHANGE: 'ROLE_CHANGE',
  PERMISSION_CHANGE: 'PERMISSION_CHANGE',
  // Passwords
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  PASSWORD_RESET: 'PASSWORD_RESET',
  // Location
  LOCATION_ASSIGN: 'LOCATION_ASSIGN',
  LOCATION_CHANGE: 'LOCATION_CHANGE',
  // Security
  SECURITY_SETTING_CHANGE: 'SECURITY_SETTING_CHANGE',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED: 'ACCOUNT_UNLOCKED',
  SUSPICIOUS_ACCESS: 'SUSPICIOUS_ACCESS',
  // Data operations
  EXPORT: 'EXPORT',
  DELETE: 'DELETE',
  APPROVAL: 'APPROVAL',
  // DevTools
  DEVTOOL_ACCESS: 'DEVTOOL_ACCESS',
  DEVTOOL_ACTION: 'DEVTOOL_ACTION',
  // Kiosk PINs
  PIN_CREATE: 'PIN_CREATE',
  PIN_ROTATE: 'PIN_ROTATE',
  PIN_REVOKE: 'PIN_REVOKE',
  // Page visibility
  PAGE_VISIBILITY_CHANGE: 'PAGE_VISIBILITY_CHANGE',
  // Designations
  DESIGNATION_CREATE: 'DESIGNATION_CREATE',
  DESIGNATION_UPDATE: 'DESIGNATION_UPDATE',
  DESIGNATION_DELETE: 'DESIGNATION_DELETE',
  // Interview questions
  QUESTION_CREATE: 'QUESTION_CREATE',
  QUESTION_UPDATE: 'QUESTION_UPDATE',
  QUESTION_DELETE: 'QUESTION_DELETE',
  // General
  SETTINGS_CHANGE: 'SETTINGS_CHANGE',
  DATA_ACCESS: 'DATA_ACCESS'
};

/**
 * Sanitize details object — removes any fields that could contain secrets
 */
function sanitizeDetails(details) {
  if (!details || typeof details !== 'object') return details;
  const sensitiveKeys = ['password', 'pwd', 'secret', 'token', 'hash', 'pin', 'key', 'credential', 'apiKey', 'api_key'];
  const sanitized = { ...details };
  for (const k of Object.keys(sanitized)) {
    const lk = k.toLowerCase();
    if (sensitiveKeys.some(sk => lk.includes(sk))) {
      sanitized[k] = '[REDACTED]';
    }
    if (typeof sanitized[k] === 'object' && sanitized[k] !== null) {
      sanitized[k] = sanitizeDetails(sanitized[k]);
    }
  }
  return sanitized;
}

/**
 * Generate a correlation ID for request tracing
 */
function generateCorrelationId() {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Log an audit event
 * @param {object} options
 * @param {object} options.req - Express request (optional, for extracting user/IP/UA)
 * @param {string} options.action - Event type from AuditEvents
 * @param {string} options.module - Module name (e.g., 'UserManagement', 'Security')
 * @param {object} options.details - Event details (will be sanitized)
 * @param {number|string} options.userId - User ID performing the action
 * @param {string} options.username - Username performing the action
 * @param {number|string} options.targetId - Target record ID
 * @param {string} options.targetType - Target record type
 * @param {boolean} options.success - Whether the action succeeded
 * @param {string} options.correlationId - Request correlation ID
 */
async function log({
  req = null,
  action,
  module = 'System',
  details = null,
  userId = null,
  username = null,
  targetId = null,
  targetType = null,
  success = true,
  correlationId = null
} = {}) {
  try {
    // Extract info from request if available
    const resolvedUsername = username || (req && req.user ? req.user.username : 'System');
    const resolvedUserId = userId || (req && req.user ? req.user.id : null);
    const ipAddress = req ? (req.ip || req.connection?.remoteAddress || null) : null;
    const userAgent = req ? (req.get ? req.get('user-agent') : null) : null;
    const resolvedCorrelationId = correlationId || (req ? req.correlationId : null) || generateCorrelationId();
    const locationId = req && req.user ? req.user.locationId : null;

    // Sanitize details to never store secrets
    const sanitizedDetails = sanitizeDetails(details);
    const detailStr = sanitizedDetails ? JSON.stringify(sanitizedDetails) : null;

    await pool.query(
      `INSERT INTO audit_logs 
       (username, user_id, action, module, details, ip_address, user_agent, location_id, success, correlation_id, target_id, target_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resolvedUsername,
        resolvedUserId,
        action,
        module,
        detailStr,
        ipAddress,
        userAgent ? userAgent.substring(0, 500) : null,
        locationId,
        success ? 1 : 0,
        resolvedCorrelationId,
        targetId ? String(targetId) : null,
        targetType || null
      ]
    );
  } catch (err) {
    // Never let audit logging failure break the application
    console.warn('[AuditService] Failed to write audit log:', err.message);
  }
}

/**
 * Query audit logs with filtering and pagination
 */
async function query({
  username = null,
  userId = null,
  action = null,
  module = null,
  fromDate = null,
  toDate = null,
  success = null,
  search = null,
  limit = 50,
  offset = 0
} = {}) {
  try {
    const conditions = [];
    const params = [];

    if (username) { conditions.push('username = ?'); params.push(username); }
    if (userId) { conditions.push('user_id = ?'); params.push(userId); }
    if (action) { conditions.push('action = ?'); params.push(action); }
    if (module) { conditions.push('module = ?'); params.push(module); }
    if (fromDate) { conditions.push('created_at >= ?'); params.push(fromDate); }
    if (toDate) { conditions.push('created_at <= ?'); params.push(toDate); }
    if (success !== null) { conditions.push('success = ?'); params.push(success ? 1 : 0); }
    if (search) {
      conditions.push('(username LIKE ? OR action LIKE ? OR module LIKE ? OR details LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM audit_logs ${where}`, params
    );

    // Get paginated results
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

    const [rows] = await pool.query(
      `SELECT id, username, user_id, action, module, details, ip_address, user_agent,
              location_id, success, correlation_id, target_id, target_type, created_at
       FROM audit_logs ${where}
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, safeLimit, safeOffset]
    );

    // Parse JSON details
    const logs = rows.map(r => {
      let parsedDetails = null;
      try {
        parsedDetails = r.details ? JSON.parse(r.details) : null;
      } catch {
        parsedDetails = r.details ? { raw: r.details } : null;
      }
      return { ...r, details: parsedDetails };
    });

    return { logs, total, limit: safeLimit, offset: safeOffset };
  } catch (err) {
    console.warn('[AuditService] Query failed:', err.message);
    return { logs: [], total: 0, limit, offset };
  }
}

module.exports = {
  AuditEvents,
  log,
  query,
  sanitizeDetails,
  generateCorrelationId
};
