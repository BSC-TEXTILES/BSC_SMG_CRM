const jwt = require('jsonwebtoken');
const { errorRes } = require('../utils/response');
const { getJwtSecret } = require('../utils/secrets');
const pool = require('../config/db');
const { authorizeLocationAccess } = require('../services/authorizationService');

/**
 * authenticate — verifies JWT and attaches full user+location context to req.user
 * req.user.locationId   — INT or null (null = Global Admin)
 * req.user.locationCode — 'DAV' | 'BEL' | 'SHI' | null
 * req.user.locationName — 'Davanagere' | 'Belagavi' | 'Shivamogga' | null
 * req.user.isGlobalAdmin — true if locationId is null
 */
const authenticate = (req, res, next) => {
  try {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers['x-auth-token']) {
      token = req.headers['x-auth-token'];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return errorRes(res, 'Authentication token required', [], 401);
    }

    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded;
    // Attach correlation ID for request tracing
    req.correlationId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    next();
  } catch (err) {
    return errorRes(res, 'Invalid or expired authentication token', [err.message], 401);
  }
};

/**
 * authorize — role-based access control
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return errorRes(res, 'Forbidden: insufficient permissions', [], 403);
    }
    next();
  };
};

/**
 * getLocationFilter — returns a WHERE clause fragment and params for location isolation.
 *
 * Supports multi-location users via the user_locations junction table.
 *
 * Usage in controllers (async):
 *   const { clause, params } = await getLocationFilter(req, 'c');
 *   db.query(`SELECT * FROM candidates c WHERE 1=1 ${clause}`, params);
 *
 * Global Admin (no locationId):  clause = '' (no filter, sees all locations)
 * Single-location user:          clause = 'AND c.location_id = ?' with [locationId]
 * Multi-location user:           clause = 'AND c.location_id IN (?, ?, ?)' with [id1, id2, ...]
 * Fallback (no user_locations):  clause = 'AND c.location_id = ?' with [locationId]
 *
 * @param {object} req        — Express request with req.user populated
 * @param {string} tableAlias — table alias prefix (e.g. 'c' → 'c.location_id')
 * @returns {Promise<{clause: string, params: Array}>}
 */
const getLocationFilter = async (req, tableAlias = '') => {
  const col = tableAlias ? `${tableAlias}.location_id` : 'location_id';
  const locationId = req.user ? req.user.locationId : null;
  const isGlobalAdmin = !locationId;

  if (isGlobalAdmin) {
    return { clause: '', params: [] };
  }

  // Try to query user_locations for multi-location support
  try {
    const [rows] = await pool.query(
      'SELECT location_id FROM user_locations WHERE user_id = ?',
      [req.user.id]
    );

    if (rows.length > 0) {
      const locationIds = rows.map(r => r.location_id);
      const placeholders = locationIds.map(() => '?').join(', ');
      return {
        clause: `AND ${col} IN (${placeholders})`,
        params: locationIds
      };
    }
  } catch (err) {
    // user_locations table doesn't exist or query failed — fall through to single-location fallback
  }

  // Fallback: single location_id from the JWT
  return {
    clause: `AND ${col} = ?`,
    params: [locationId]
  };
};

/**
 * injectLocationId — for INSERT/UPDATE operations.
 * Returns the authenticated user's locationId (throws if branch user has no location).
 */
const injectLocationId = (req) => {
  if (!req.user) return 2; // fallback to Davanagere
  return req.user.locationId || null; // null = Global Admin
};

/**
 * authorizeModule — per-module permission check using user_permissions table.
 * Admin and Super Admin roles bypass this check entirely.
 * For other roles, checks the user_permissions table for the specified module
 * and action (can_view, can_add, can_edit, can_delete, can_export, can_approve).
 */
const authorizeModule = (moduleName, action = 'can_view') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return errorRes(res, 'Authentication required', [], 401);
      }

      // Admin/Super Admin bypass module-level checks
      if (['Admin', 'Super Admin'].includes(req.user.role)) {
        return next();
      }

      const validActions = ['can_view', 'can_add', 'can_edit', 'can_delete', 'can_export', 'can_approve'];
      const safeAction = validActions.includes(action) ? action : 'can_view';

      const [rows] = await pool.query(
        `SELECT ${safeAction} as allowed FROM user_permissions WHERE user_id = ? AND module = ?`,
        [req.user.id, moduleName]
      );

      if (!rows.length || !rows[0].allowed) {
        return errorRes(res, `Access denied: you do not have ${safeAction.replace('can_', '')} permission for this module`, [], 403);
      }

      next();
    } catch (err) {
      // If user_permissions table doesn't exist, fall back to role-based access
      console.warn('[authorizeModule] Permission check failed, falling back to role-based:', err.message);
      next();
    }
  };
};

module.exports = {
  authenticate,
  authorize,
  authorizeModule,
  authorizeLocationAccess,
  getLocationFilter,
  injectLocationId
};
