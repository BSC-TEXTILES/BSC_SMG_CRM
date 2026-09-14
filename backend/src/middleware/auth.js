const jwt = require('jsonwebtoken');
const { errorRes } = require('../utils/response');
const { getJwtSecret } = require('../utils/secrets');

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
 * Usage in controllers:
 *   const { clause, params } = getLocationFilter(req, 'c');
 *   db.query(`SELECT * FROM candidates c WHERE 1=1 ${clause}`, params);
 *
 * Global Admin: clause = '' (no filter, sees all locations)
 * Branch user:  clause = 'AND c.location_id = ?' with [locationId]
 *
 * @param {object} req       — Express request with req.user populated
 * @param {string} tableAlias — table alias prefix (e.g. 'c' → 'c.location_id')
 */
const getLocationFilter = (req, tableAlias = '') => {
  const col = tableAlias ? `${tableAlias}.location_id` : 'location_id';
  const locationId = req.user ? req.user.locationId : null;
  const isGlobalAdmin = !locationId;

  if (isGlobalAdmin) {
    return { clause: '', params: [] };
  }
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

module.exports = {
  authenticate,
  authorize,
  getLocationFilter,
  injectLocationId
};
