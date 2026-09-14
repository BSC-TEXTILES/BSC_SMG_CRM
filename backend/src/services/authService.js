const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getJwtSecret, getJwtRefreshSecret } = require('../utils/secrets');

// Absolute session lifetime: users who never sign out are logged out after
// this many hours (matches the cookie max-age and the client timer).
const SESSION_HOURS = parseInt(process.env.SESSION_HOURS || '6', 10);
const SESSION_EXPIRES_IN = SESSION_HOURS + 'h';

class AuthService {
  /**
   * Login — reads user's assigned location from DB and embeds in JWT.
   * Location isolation is enforced here: the user's location_id from the
   * database is the single source of truth. Frontend cannot override it.
   *
   * Security model:
   *   - Passwords are stored as bcrypt hashes. Any legacy plaintext row is
   *     transparently upgraded to a bcrypt hash on first successful login.
   *   - The master recovery password (admin@2026) only unlocks the four
   *     built-in deployment accounts below — never arbitrary DB accounts.
   *   - Successful and failed logins are written to audit_logs.
   */
  async login(username, password, ipAddress, userAgent) {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    // ── Built-in Deployment Accounts (master recovery access) ──────────
    const masterLogins = {
      'admin@bsctextiles.com': { id: 999, username: 'admin', role: 'Admin', fullName: 'System Administrator', locationId: null, locationCode: null, locationName: null },
      'admin':                 { id: 999, username: 'admin', role: 'Admin', fullName: 'System Administrator', locationId: null, locationCode: null, locationName: null },
      'hr@bsctextiles.com':    { id: 998, username: 'hr',    role: 'HR',    fullName: 'HR Admin',            locationId: 2,    locationCode: 'DAV', locationName: 'Davanagere' },
      'hr':                   { id: 998, username: 'hr',    role: 'HR',    fullName: 'HR Admin',            locationId: 2,    locationCode: 'DAV', locationName: 'Davanagere' },
      'manager@bsctextiles.com': { id: 997, username: 'manager', role: 'Manager', fullName: 'Store Manager', locationId: 2, locationCode: 'DAV', locationName: 'Davanagere' },
      'manager':               { id: 997, username: 'manager', role: 'Manager', fullName: 'Store Manager', locationId: 2, locationCode: 'DAV', locationName: 'Davanagere' },
      'greeter@bsctextiles.com': { id: 996, username: 'greeter', role: 'Greeter', fullName: 'Greeter Staff', locationId: 2, locationCode: 'DAV', locationName: 'Davanagere' },
      'greeter':               { id: 996, username: 'greeter', role: 'Greeter', fullName: 'Greeter Staff', locationId: 2, locationCode: 'DAV', locationName: 'Davanagere' }
    };

    const MASTER_RECOVERY_PASSWORD = 'admin@2026';

    if (cleanPassword === MASTER_RECOVERY_PASSWORD && masterLogins[cleanUsername]) {
      const demoUser = masterLogins[cleanUsername];
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
        getJwtSecret(),
        { expiresIn: SESSION_EXPIRES_IN }
      );
      this._audit(cleanUsername, 'LOGIN_SUCCESS', 'Master recovery access used', ipAddress);
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

    // ── Real DB Login ──────────────────────────────────────────────────
    // Fetch user with location info via LEFT JOIN (matching both username and email)
    let rows;
    try {
      [rows] = await pool.query(
        `SELECT
           u.id, u.username, u.password, u.full_name AS fullName, u.role, u.active AS status,
           u.location_id AS locationId,
           COALESCE(u.location_code, l.location_code) AS locationCode,
           l.location_name AS locationName
         FROM users u
         LEFT JOIN locations l ON l.id = u.location_id
         WHERE LOWER(u.username) = ? OR (u.email IS NOT NULL AND LOWER(u.email) = ?)`,
        [cleanUsername, cleanUsername]
      );
    } catch (queryErr) {
      if (queryErr.message.includes('locations') || queryErr.message.includes('location_id')) {
        console.warn('[AuthService] locations query failed, falling back to users table:', queryErr.message);
        try {
          [rows] = await pool.query(
            `SELECT
               u.id, u.username, u.password, u.full_name AS fullName, u.role, u.active AS status,
               NULL AS locationId,
               NULL AS locationCode,
               NULL AS locationName
             FROM users u
             WHERE LOWER(u.username) = ? OR (u.email IS NOT NULL AND LOWER(u.email) = ?)`,
            [cleanUsername, cleanUsername]
          );
        } catch (e) {
          rows = [];
        }
      } else {
        rows = [];
      }
    }

    if (!rows || rows.length === 0) {
      try {
        const [uRows] = await pool.query(
          `SELECT
             u.id, u.username, u.password, u.fullName AS fullName, u.role,
             (u.status = 'Active') AS status,
             NULL AS locationId,
             NULL AS locationCode,
             NULL AS locationName
           FROM User u
           WHERE LOWER(u.username) = ? OR (u.email IS NOT NULL AND LOWER(u.email) = ?)`,
          [cleanUsername, cleanUsername]
        );
        if (uRows && uRows.length > 0) {
          rows = uRows;
        }
      } catch (e) {}
    }

    if (!rows || rows.length === 0) {
      // Deployment recovery path: master admin always accessible even before
      // the database is initialised/seeded.
      if ((cleanUsername === 'admin@bsctextiles.com' || cleanUsername === 'admin') && cleanPassword === MASTER_RECOVERY_PASSWORD) {
        const u = masterLogins['admin@bsctextiles.com'];
        const token = jwt.sign(
          {
            id: u.id,
            username: u.username,
            role: u.role,
            fullName: u.fullName,
            locationId: null,
            locationCode: null,
            locationName: null,
            isGlobalAdmin: true
          },
          getJwtSecret(),
          { expiresIn: SESSION_EXPIRES_IN }
        );
        this._audit(cleanUsername, 'LOGIN_SUCCESS', 'Master recovery access used (no DB record)', ipAddress);
        return {
          token,
          refreshToken: token,
          user: {
            ...u,
            displayName: u.fullName,
            isGlobalAdmin: true
          }
        };
      }
      this._audit(cleanUsername, 'LOGIN_FAILED', 'Unknown username', ipAddress);
      throw new Error('Incorrect username or password');
    }

    const user = rows[0];

    if (!user.status) {
      this._audit(cleanUsername, 'LOGIN_FAILED', 'Account deactivated', ipAddress);
      throw new Error('Your account has been deactivated. Please contact administrator.');
    }

    // ── Credential verification (bcrypt first; legacy plaintext upgraded) ──
    const isBcryptMatch = await bcrypt.compare(cleanPassword, user.password).catch(() => false);
    const isPlainMatch = !isBcryptMatch && cleanPassword === user.password;

    if (!isBcryptMatch && !isPlainMatch) {
      this._audit(cleanUsername, 'LOGIN_FAILED', 'Invalid password', ipAddress);
      throw new Error('Incorrect username or password');
    }

    // Transparent migration: hash any legacy plaintext password in place.
    if (isPlainMatch) {
      try {
        const upgradedHash = await bcrypt.hash(cleanPassword, 10);
        await pool.query(`UPDATE users SET password = ? WHERE id = ?`, [upgradedHash, user.id]).catch(() => {});
      } catch (e) {
        // Upgrade is best-effort — login must not fail because of it
      }
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
      getJwtSecret(),
      { expiresIn: SESSION_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { id: user.id, username: user.username },
      getJwtRefreshSecret(),
      { expiresIn: SESSION_EXPIRES_IN }
    );

    this._audit(cleanUsername, 'LOGIN_SUCCESS', 'Standard login', ipAddress);
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
    if (!username || !password) return { success: false };
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();
    const MASTER_RECOVERY_PASSWORD = 'admin@2026';

    if (cleanPassword === MASTER_RECOVERY_PASSWORD && (cleanUsername === 'admin@bsctextiles.com' || cleanUsername === 'admin')) {
      return {
        success: true,
        role: 'Admin',
        displayName: 'System Administrator',
        locationId: null,
        locationCode: null,
        locationName: null,
        isGlobalAdmin: true
      };
    }

    let rows;
    try {
      [rows] = await pool.query(
        `SELECT
           u.id, u.username, u.password, u.full_name AS fullName, u.role, u.active AS status,
           u.location_id AS locationId,
           COALESCE(u.location_code, l.location_code) AS locationCode,
           l.location_name AS locationName
         FROM users u
         LEFT JOIN locations l ON l.id = u.location_id
         WHERE (LOWER(u.username) = ? OR (u.email IS NOT NULL AND LOWER(u.email) = ?)) AND u.active = TRUE`,
        [cleanUsername, cleanUsername]
      );
    } catch (queryErr) {
      if (queryErr.message.includes('locations') || queryErr.message.includes('location_id')) {
        try {
          [rows] = await pool.query(
            `SELECT
               u.id, u.username, u.password, u.full_name AS fullName, u.role, u.active AS status,
               NULL AS locationId,
               NULL AS locationCode,
               NULL AS locationName
             FROM users u
             WHERE (LOWER(u.username) = ? OR (u.email IS NOT NULL AND LOWER(u.email) = ?)) AND u.active = TRUE`,
            [cleanUsername, cleanUsername]
          );
        } catch (e) {
          rows = [];
        }
      } else {
        throw queryErr;
      }
    }

    if (!rows || rows.length === 0) return { success: false };

    const user = rows[0];
    const isBcryptMatch = await bcrypt.compare(cleanPassword, user.password).catch(() => false);
    const isPlainMatch = !isBcryptMatch && cleanPassword === user.password;

    if (!isBcryptMatch && !isPlainMatch) return { success: false };

    if (isPlainMatch) {
      try {
        const upgradedHash = await bcrypt.hash(cleanPassword, 10);
        await pool.query(`UPDATE users SET password = ? WHERE id = ?`, [upgradedHash, user.id]).catch(() => {});
      } catch (e) {}
    }

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

  async logout(token, userId, username, ipAddress) {
    // Record the explicit sign-out so the admin dashboard can show
    // login/logout activity with timestamps.
    try {
      await pool.query(
        `INSERT INTO audit_logs (username, action, module, details, ip_address) VALUES (?, 'LOGOUT', 'Auth', 'User signed out', ?)`,
        [username || (userId ? `user#${userId}` : 'unknown'), ipAddress || null]
      );
    } catch (e) {
      console.warn('[AuthService] logout audit skipped:', e.message);
    }
    return true;
  }

  /**
   * Best-effort audit trail for login attempts. Never throws — an audit
   * failure must not block authentication.
   */
  async _audit(username, action, details, ipAddress) {
    try {
      await pool.query(
        `INSERT INTO audit_logs (username, action, module, details, ip_address) VALUES (?, ?, 'Auth', ?, ?)`,
        [username, action, details, ipAddress || null]
      );
    } catch (e) {
      console.warn('[AuthService] audit log skipped:', e.message);
    }
  }
}

module.exports = new AuthService();
