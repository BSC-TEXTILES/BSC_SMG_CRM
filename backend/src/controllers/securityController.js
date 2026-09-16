/**
 * BSC Textiles Portal — Security Controller
 * Administration page for security settings, session management,
 * account lockout, login monitoring, and audit logs.
 */

const pool = require('../config/db');
const { successRes, errorRes } = require('../utils/response');
const auditService = require('../services/auditService');

// ── Security Dashboard Stats ────────────────────────────────────────
const getSecurityDashboard = async (req, res) => {
  try {
    const results = {};

    // Total audit events
    try {
      const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM audit_logs');
      results.totalAuditEvents = total;
    } catch { results.totalAuditEvents = 0; }

    // Today's events
    try {
      const [[{ total }]] = await pool.query(
        'SELECT COUNT(*) as total FROM audit_logs WHERE created_at >= CURDATE()'
      );
      results.todayEvents = total;
    } catch { results.todayEvents = 0; }

    // Failed logins (last 24h)
    try {
      const [[{ total }]] = await pool.query(
        "SELECT COUNT(*) as total FROM audit_logs WHERE action = 'LOGIN_FAILED' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)"
      );
      results.failedLogins24h = total;
    } catch { results.failedLogins24h = 0; }

    // Active users
    try {
      const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM users WHERE active = TRUE');
      results.activeUsers = total;
    } catch { results.activeUsers = 0; }

    // Inactive users
    try {
      const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM users WHERE active = FALSE');
      results.inactiveUsers = total;
    } catch { results.inactiveUsers = 0; }

    // Locked accounts
    try {
      const [[{ total }]] = await pool.query(
        'SELECT COUNT(*) as total FROM users WHERE locked_until IS NOT NULL AND locked_until > NOW()'
      );
      results.lockedAccounts = total;
    } catch { results.lockedAccounts = 0; }

    // Security events by module (last 7 days)
    try {
      const [rows] = await pool.query(
        `SELECT module, COUNT(*) as count FROM audit_logs 
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) 
         GROUP BY module ORDER BY count DESC LIMIT 10`
      );
      results.eventsByModule = rows;
    } catch { results.eventsByModule = []; }

    // Recent suspicious activity
    try {
      const [rows] = await pool.query(
        `SELECT username, action, ip_address, created_at FROM audit_logs 
         WHERE action IN ('LOGIN_FAILED', 'SUSPICIOUS_ACCESS', 'ACCOUNT_LOCKED') 
         ORDER BY created_at DESC LIMIT 20`
      );
      results.suspiciousActivity = rows;
    } catch { results.suspiciousActivity = []; }

    return successRes(res, results, 'Security dashboard loaded');
  } catch (err) {
    return errorRes(res, 'Failed to load security dashboard', [err.message], 500);
  }
};

// ── Security Settings (GET) ──────────────────────────────────────────
const getSecuritySettings = async (req, res) => {
  try {
    const settings = {};
    try {
      const [rows] = await pool.query(
        "SELECT setting_key, setting_value FROM security_settings"
      );
      rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    } catch {
      // Table doesn't exist, return defaults
    }

    const defaults = {
      max_failed_logins: '5',
      lockout_duration_minutes: '30',
      session_timeout_hours: '6',
      password_min_length: '8',
      require_password_complexity: 'true',
      force_password_change_days: '0',
      max_active_sessions: '5',
      enable_rate_limiting: 'true',
      rate_limit_window_minutes: '10',
      rate_limit_max_requests: '50',
      enable_audit_logging: 'true',
      enable_devtools_protection: 'true'
    };

    const merged = { ...defaults, ...settings };
    return successRes(res, { settings: merged }, 'Security settings retrieved');
  } catch (err) {
    return errorRes(res, 'Failed to load security settings', [err.message], 500);
  }
};

// ── Security Settings (UPDATE) ───────────────────────────────────────
const updateSecuritySettings = async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return errorRes(res, 'Settings object is required', [], 400);
    }

    for (const [key, value] of Object.entries(settings)) {
      await pool.query(
        `INSERT INTO security_settings (setting_key, setting_value, updated_by)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by), updated_at = NOW()`,
        [key, String(value), req.user?.username || 'Admin']
      );
    }

    await auditService.log({
      req,
      action: auditService.AuditEvents.SECURITY_SETTING_CHANGE,
      module: 'Security',
      details: { settingsChanged: Object.keys(settings) }
    });

    return successRes(res, {}, 'Security settings updated');
  } catch (err) {
    return errorRes(res, 'Failed to update security settings', [err.message], 500);
  }
};

// ── Recent Login Activity ────────────────────────────────────────────
const getLoginActivity = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 5), 200);
    const [rows] = await pool.query(
      `SELECT username, action, ip_address, user_agent, success, created_at
       FROM audit_logs
       WHERE action IN ('LOGIN', 'LOGIN_FAILED', 'LOGOUT')
       ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );
    return successRes(res, { activity: rows }, 'Login activity retrieved');
  } catch (err) {
    return successRes(res, { activity: [] }, 'Login activity (empty)');
  }
};

// ── Audit Logs (paginated, searchable) ───────────────────────────────
const getAuditLogs = async (req, res) => {
  try {
    const { username, action, module, search, from, to, limit, offset } = req.query;
    const result = await auditService.query({
      username: username || null,
      action: action || null,
      module: module || null,
      search: search || null,
      fromDate: from || null,
      toDate: to || null,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0
    });
    return successRes(res, result, 'Audit logs retrieved');
  } catch (err) {
    return errorRes(res, 'Failed to load audit logs', [err.message], 500);
  }
};

// ── Active Sessions (based on recent logins) ─────────────────────────
const getActiveSessions = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.role, u.last_login_at, u.location_id,
              l.location_name,
              (SELECT ip_address FROM audit_logs WHERE username = u.username AND action = 'LOGIN' ORDER BY created_at DESC LIMIT 1) as last_ip,
              (SELECT user_agent FROM audit_logs WHERE username = u.username AND action = 'LOGIN' ORDER BY created_at DESC LIMIT 1) as last_user_agent
       FROM users u
       LEFT JOIN locations l ON l.id = u.location_id
       WHERE u.active = TRUE AND u.last_login_at >= DATE_SUB(NOW(), INTERVAL 6 HOUR)
       ORDER BY u.last_login_at DESC`
    );
    return successRes(res, { sessions: rows }, 'Active sessions retrieved');
  } catch (err) {
    return successRes(res, { sessions: [] }, 'Active sessions (empty)');
  }
};

// ── Unlock a locked account ──────────────────────────────────────────
const unlockAccount = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return errorRes(res, 'User ID is required', [], 400);

    await pool.query(
      'UPDATE users SET locked_until = NULL, failed_login_count = 0 WHERE id = ?',
      [userId]
    );

    await auditService.log({
      req,
      action: auditService.AuditEvents.ACCOUNT_UNLOCKED,
      module: 'Security',
      details: { targetUserId: userId },
      targetId: userId,
      targetType: 'User'
    });

    return successRes(res, {}, 'Account unlocked successfully');
  } catch (err) {
    return errorRes(res, 'Failed to unlock account', [err.message], 500);
  }
};

module.exports = {
  getSecurityDashboard,
  getSecuritySettings,
  updateSecuritySettings,
  getLoginActivity,
  getAuditLogs,
  getActiveSessions,
  unlockAccount
};
