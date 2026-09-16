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
 *
 * The token alone is never trusted as proof of an allowed session: the account
 * must still exist, still be active and not be locked. That is what makes
 * "deactivate account" take effect on live sessions (not just the next login)
 * and keeps the backend authoritative instead of relying on the frontend
 * hiding links.
 */
// Built-in deployment accounts. Their JWTs are issued without a database row
// (master recovery access), so they are the only identities allowed to proceed
// when no row is found for the id inside the token.
const BUILTIN_ACCOUNT_USERNAMES = [
  'admin@bsctextiles.com', 'admin',
  'hr@bsctextiles.com', 'hr',
  'manager@bsctextiles.com', 'manager',
  'greeter@bsctextiles.com', 'greeter'
];

// Short-TTL status cache: keeps the per-request cost of the check negligible
// while still picking up admin changes within a few seconds.
const STATUS_CACHE = new Map();
const STATUS_CACHE_TTL_MS = 5000;

function getCachedUserStatus(userId) {
  const entry = STATUS_CACHE.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.at > STATUS_CACHE_TTL_MS) {
    STATUS_CACHE.delete(userId);
    return null;
  }
  return entry.value;
}

function cacheUserStatus(userId, value) {
  if (STATUS_CACHE.size > 500) STATUS_CACHE.clear();
  STATUS_CACHE.set(userId, { at: Date.now(), value });
}

/**
 * Drops a user's cached status so a status/permission change made by an admin
 * is honoured immediately by subsequent requests.
 */
function invalidateUserStatusCache(userId) {
  if (userId === undefined || userId === null) {
    STATUS_CACHE.clear();
    return;
  }
  STATUS_CACHE.delete(userId);
}

const authenticate = async (req, res, next) => {
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

    // ── Account status enforcement ─────────────────────────────────
    const userId = decoded.id;
    const username = String(decoded.username || '').toLowerCase();
    let status = userId !== undefined && userId !== null ? getCachedUserStatus(userId) : null;

    if (!status) {
      try {
        const [rows] = await pool.query(
          'SELECT active, locked_until FROM users WHERE id = ? LIMIT 1',
          [userId]
        );
        if (rows && rows.length > 0) {
          status = {
            exists: true,
            active: !!rows[0].active,
            locked: !!(rows[0].locked_until && new Date(rows[0].locked_until) > new Date())
          };
        } else {
          status = { exists: false };
        }
        cacheUserStatus(userId, status);
      } catch (dbErr) {
        // Database unreachable — fail open so kiosks/health checks keep working
        // (the same policy the rest of the platform uses for a DB outage).
        console.warn('[authenticate] account status check unavailable:', dbErr.message);
        status = null;
      }
    }

    if (status) {
      if (!status.exists) {
        if (!BUILTIN_ACCOUNT_USERNAMES.includes(username)) {
          res.clearCookie('token', { path: '/' });
          return errorRes(res, 'This account no longer exists', [], 401);
        }
      } else if (!status.active) {
        res.clearCookie('token', { path: '/' });
        return errorRes(res, 'Your account has been deactivated. Contact a system administrator.', [], 401);
      } else if (status.locked) {
        res.clearCookie('token', { path: '/' });
        return errorRes(res, 'Account is temporarily locked. Try again later.', [], 401);
      }
    }

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
  injectLocationId,
  invalidateUserStatusCache
};
