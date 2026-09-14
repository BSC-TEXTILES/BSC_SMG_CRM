const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class AuthService {
  /**
   * Login — reads user's assigned location from DB and embeds in JWT.
   * Location isolation is enforced here: the user's location_id from the
   * database is the single source of truth. Frontend cannot override it.
   */
  async login(username, password, ipAddress, userAgent) {
    // ── Demo / Fallback Credentials ───────────────────────────────────
    // Demo admin users get Global Admin access (location_id = null)
    if (password === 'bsc@2026' || password === 'bsc@123') {
      const demoUsers = {
        'admin@bsctextiles.com':   { id: 999, username: 'Admin',         role: 'Admin',    fullName: 'System Admin',  locationId: null, locationCode: null, locationName: null },
        'hr@bsctextiles.com':      { id: 998, username: 'HR Admin',      role: 'HR',       fullName: 'HR Admin',      locationId: 2,    locationCode: 'DAV', locationName: 'Davanagere' },
        'manager@bsctextiles.com': { id: 997, username: 'Store Manager', role: 'Manager',  fullName: 'Store Manager', locationId: 2,    locationCode: 'DAV', locationName: 'Davanagere' },
        'greeter@bsctextiles.com': { id: 996, username: 'Greeter',       role: 'Greeter',  fullName: 'Greeter Staff', locationId: 2,    locationCode: 'DAV', locationName: 'Davanagere' }
      };
      const demoUser = demoUsers[username.toLowerCase().trim()];
      if (demoUser) {
        const token = jwt.sign(
          {
            id: demoUser.id,
            username: demoUser.username,
            role: demoUser.role,
            fullName: demoUser.fullName,
            locationId: demoUser.locationId,
            locationCode: demoUser.locationCode,
            locationName: demoUser.locationName,
            isGlobalAdmin: demoUser.locationId === null
          },
          process.env.JWT_SECRET || 'bsc_hrms_super_secret_jwt_key_2026',
          { expiresIn: '24h' }
        );
        return {
          token,
          refreshToken: token,
          user: {
            ...demoUser,
            displayName: demoUser.fullName,
            isGlobalAdmin: demoUser.locationId === null
          }
        };
      }
    }

    // ── Real DB Login ──────────────────────────────────────────────────
    // Fetch user with location info via LEFT JOIN
    const [rows] = await pool.query(
      `SELECT 
         u.id, u.username, u.password, u.full_name AS fullName, u.role, u.active AS status,
         u.location_id AS locationId,
         COALESCE(u.location_code, l.location_code) AS locationCode,
         l.location_name AS locationName
       FROM users u
       LEFT JOIN locations l ON l.id = u.location_id
       WHERE LOWER(u.username) = LOWER(?)`,
      [username.trim()]
    );

    if (rows.length === 0) {
      throw new Error('Incorrect username or password');
    }

    const user = rows[0];

    if (!user.status) {
      throw new Error('Your account has been deactivated. Please contact administrator.');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Incorrect username or password');
    }

    // Resolve location info
    const locationId   = user.locationId   || null;
    const locationCode = user.locationCode || null;
    const locationName = user.locationName || null;
    const isGlobalAdmin = locationId === null; // null location = Global Admin (all locations)

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        locationId,
        locationCode,
        locationName,
        isGlobalAdmin
      },
      process.env.JWT_SECRET || 'bsc_hrms_super_secret_jwt_key_2026',
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_REFRESH_SECRET || 'bsc_hrms_super_secret_refresh_key_2026',
      { expiresIn: '7d' }
    );

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        displayName: user.fullName || user.role,
        locationId,
        locationCode,
        locationName,
        isGlobalAdmin
      }
    };
  }

  async verifyUser(username, password) {
    const [rows] = await pool.query(
      `SELECT 
         u.id, u.username, u.password, u.full_name AS fullName, u.role, u.active AS status,
         u.location_id AS locationId,
         COALESCE(u.location_code, l.location_code) AS locationCode,
         l.location_name AS locationName
       FROM users u
       LEFT JOIN locations l ON l.id = u.location_id
       WHERE LOWER(u.username) = LOWER(?) AND u.active = TRUE`,
      [username.trim()]
    );

    if (rows.length === 0) return { success: false };

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return { success: false };

    return {
      success: true,
      role: user.role,
      displayName: user.fullName || user.role,
      locationId: user.locationId || null,
      locationCode: user.locationCode || null,
      locationName: user.locationName || null,
      isGlobalAdmin: !user.locationId
    };
  }

  async logout(token, userId) {
    // Session cleanup — no sessions table yet
    return true;
  }
}

module.exports = new AuthService();
