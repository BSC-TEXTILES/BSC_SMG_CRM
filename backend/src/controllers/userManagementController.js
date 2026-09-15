const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { successRes, errorRes } = require('../utils/response');
const { logAction } = require('../utils/logger');

// ── Module Registry — matches sidebar navItems ────────────────────
const MODULE_REGISTRY = [
  { key: 'dashboard', label: 'Dashboard', section: 'Core Workspace' },
  { key: 'wedding_crm', label: 'Wedding Follow-up CRM', section: 'Store Operations' },
  { key: 'footfall', label: 'Hourly Footfall', section: 'Store Operations' },
  { key: 'feedback_collection', label: 'Feedback Collection', section: 'Store Operations' },
  { key: 'feedback_list', label: 'Feedback Call Queue', section: 'Store Operations' },
  { key: 'feedback_qr', label: 'Feedback QR Code', section: 'Store Operations' },
  { key: 'divert', label: 'Sourcing Diverts', section: 'Store Operations' },
  { key: 'candidates', label: 'Candidate CRM', section: 'Core Workspace' },
  { key: 'offer', label: 'Offer Desk', section: 'Core Workspace' },
  { key: 'openings', label: 'Manpower Planning', section: 'Core Workspace' },
  { key: 'employees', label: 'Employee Directory', section: 'Talent Management' },
  { key: 'dept_hiring', label: 'Department Hiring Status', section: 'Talent Management' },
  { key: 'section_allocation', label: 'Section Allocation', section: 'Talent Management' },
  { key: 'broadcast', label: 'Broadcast Center', section: 'Administration' },
  { key: 'settings', label: 'System Settings', section: 'Administration' },
  { key: 'daily_mcheck', label: 'Daily MCheck', section: 'Daily Operations' },
  { key: 'mcheck_reports', label: 'MCheck Reports', section: 'Daily Operations' },
  { key: 'mcheck_history', label: 'MCheck History', section: 'Daily Operations' },
  { key: 'user_management', label: 'User Management', section: 'Administration' }
];

// ── List all users with their permission counts ───────────────────
const listUsers = async (req, res) => {
  try {
    const [rawUsers] = await db.query(`
      SELECT
        u.id, u.username, u.full_name AS fullName, u.email, u.phone,
        u.department, u.designation, u.role, u.active,
        u.location_id, u.location_code, u.max_modules,
        u.last_login_at, u.created_at, u.updated_at,
        l.location_name,
        GROUP_CONCAT(DISTINCT ul.location_id) AS assigned_location_ids,
        GROUP_CONCAT(DISTINCT l2.location_name) AS assigned_location_names,
        (SELECT COUNT(*) FROM user_permissions up WHERE up.user_id = u.id AND up.can_view = TRUE) AS modules_assigned
      FROM users u
      LEFT JOIN locations l ON l.id = u.location_id
      LEFT JOIN user_locations ul ON ul.user_id = u.id
      LEFT JOIN locations l2 ON l2.id = ul.location_id
      GROUP BY u.id
      ORDER BY u.created_at ASC
    `);

    const users = rawUsers.map(u => {
      let assignedLocations = [];
      if (u.assigned_location_ids) {
        const ids = u.assigned_location_ids.split(',').map(Number);
        const names = u.assigned_location_names.split(',');
        assignedLocations = ids.map((id, i) => ({ id, name: names[i] || null }));
      } else {
        // Fallback: no user_locations rows — derive from single location_id
        if (u.location_id) {
          assignedLocations = [{ id: u.location_id, name: u.location_name }];
        }
      }
      const { assigned_location_ids, assigned_location_names, ...rest } = u;
      return { ...rest, assigned_locations: assignedLocations };
    });

    return successRes(res, { users }, 'Users retrieved');
  } catch (err) {
    // Fallback if user_permissions table doesn't exist yet
    try {
      const [rawUsers] = await db.query(`
        SELECT
          u.id, u.username, u.full_name AS fullName, u.email, u.phone,
          u.department, u.designation, u.role, u.active,
          u.location_id, u.location_code,
          u.last_login_at, u.created_at,
          l.location_name,
          GROUP_CONCAT(DISTINCT ul.location_id) AS assigned_location_ids,
          GROUP_CONCAT(DISTINCT l2.location_name) AS assigned_location_names,
          0 AS modules_assigned
        FROM users u
        LEFT JOIN locations l ON l.id = u.location_id
        LEFT JOIN user_locations ul ON ul.user_id = u.id
        LEFT JOIN locations l2 ON l2.id = ul.location_id
        GROUP BY u.id
        ORDER BY u.created_at ASC
      `);

      const users = rawUsers.map(u => {
        let assignedLocations = [];
        if (u.assigned_location_ids) {
          const ids = u.assigned_location_ids.split(',').map(Number);
          const names = u.assigned_location_names.split(',');
          assignedLocations = ids.map((id, i) => ({ id, name: names[i] || null }));
        } else {
          if (u.location_id) {
            assignedLocations = [{ id: u.location_id, name: u.location_name }];
          }
        }
        const { assigned_location_ids, assigned_location_names, ...rest } = u;
        return { ...rest, assigned_locations: assignedLocations };
      });

      return successRes(res, { users }, 'Users retrieved (no permissions table yet)');
    } catch (fallbackErr) {
      return errorRes(res, 'Failed to retrieve users', [fallbackErr.message], 500);
    }
  }
};

// ── Get a single user with full details ───────────────────────────
const getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const [[user]] = await db.query(`
      SELECT
        u.id, u.username, u.full_name AS fullName, u.email, u.phone,
        u.department, u.designation, u.role, u.active,
        u.location_id, u.location_code, u.max_modules,
        u.last_login_at, u.created_at, u.updated_at,
        l.location_name
      FROM users u
      LEFT JOIN locations l ON l.id = u.location_id
      WHERE u.id = ?
    `, [id]);

    if (!user) {
      return errorRes(res, 'User not found', [], 404);
    }

    // Fetch assigned locations from user_locations
    let assignedLocations = [];
    try {
      const [locs] = await db.query(
        `SELECT ul.location_id AS id, l.location_name AS name
         FROM user_locations ul
         LEFT JOIN locations l ON l.id = ul.location_id
         WHERE ul.user_id = ?`,
        [id]
      );
      assignedLocations = locs;
    } catch (e) {
      // user_locations table may not exist yet — fall back to single location
      if (user.location_id) {
        assignedLocations = [{ id: user.location_id, name: user.location_name }];
      }
    }
    if (assignedLocations.length === 0 && user.location_id) {
      assignedLocations = [{ id: user.location_id, name: user.location_name }];
    }
    user.assigned_locations = assignedLocations;

    // Get permissions
    let permissions = [];
    try {
      const [perms] = await db.query(
        `SELECT module, can_view, can_add, can_edit, can_delete, can_export, can_approve, granted_by, granted_at
         FROM user_permissions WHERE user_id = ?`,
        [id]
      );
      permissions = perms;
    } catch (e) {
      // user_permissions table may not exist yet
    }

    // Get recent audit logs for this user
    let recentActivity = [];
    try {
      const [logs] = await db.query(
        `SELECT action, module, details, ip_address, created_at
         FROM audit_logs WHERE username = ? ORDER BY created_at DESC LIMIT 50`,
        [user.username]
      );
      recentActivity = logs;
    } catch (e) {}

    return successRes(res, { user, permissions, recentActivity }, 'User details retrieved');
  } catch (err) {
    return errorRes(res, 'Failed to retrieve user', [err.message], 500);
  }
};

// ── Create a new user ─────────────────────────────────────────────
const createUser = async (req, res) => {
  try {
    const { username, password, role, fullName, email, phone, department, designation, locationId, locationIds, allLocations, maxModules, permissions } = req.body;

    if (!username || !password || !role) {
      return errorRes(res, 'Username, password, and role are required', [], 400);
    }
    if (password.length < 6) {
      return errorRes(res, 'Password must be at least 6 characters', [], 400);
    }

    // Check if username already exists
    const [existing] = await db.query(`SELECT id FROM users WHERE LOWER(username) = ?`, [username.trim().toLowerCase()]);
    if (existing.length > 0) {
      return errorRes(res, 'Username already exists', [], 409);
    }

    // Location scope: explicit allLocations=true grants global access (NULL
    // location). Otherwise the user is pinned to a single store location.
    const wantsAllLocations = allLocations === true;
    const isGlobalRole = role === 'Admin' || role === 'Super Admin';
    if (isGlobalRole && !wantsAllLocations && locationId) {
      const resolvedLocationId = locationId;
      return _insertUser(req, res, { username, password, role, fullName, email, phone, department, designation, resolvedLocationId, locationIds, allLocations, maxModules, permissions });
    }
    const resolvedLocationId = wantsAllLocations ? null : (locationId || 2);

    return _insertUser(req, res, { username, password, role, fullName, email, phone, department, designation, resolvedLocationId, locationIds, allLocations, maxModules, permissions });
  } catch (err) {
    return errorRes(res, 'Failed to create user', [err.message], 500);
  }
};

// Shared insert used by createUser for all location-scope combinations
async function _insertUser(req, res, { username, password, role, fullName, email, phone, department, designation, resolvedLocationId, locationIds, allLocations, maxModules, permissions }) {
  try {
    // Get location_code
    let locationCode = null;
    if (resolvedLocationId) {
      try {
        const [[loc]] = await db.query(`SELECT location_code FROM locations WHERE id = ?`, [resolvedLocationId]);
        locationCode = loc ? loc.location_code : 'DAV';
      } catch (e) {
        locationCode = resolvedLocationId === 1 ? 'BEL' : resolvedLocationId === 3 ? 'SHI' : 'DAV';
      }
    }

    const hashedPassword = await bcrypt.hash(password.trim(), 10);

    const [result] = await db.query(
      `INSERT INTO users (username, password, role, full_name, email, phone, department, designation, active, location_id, location_code, max_modules)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?, ?)`,
      [username.trim(), hashedPassword, role, fullName || role, email || null, phone || null,
       department || null, designation || null, resolvedLocationId, locationCode, maxModules || null]
    );

    const newUserId = result.insertId;

    // ── Multi-location: insert into user_locations ──────────────────
    const wantsAllLocations = allLocations === true;
    if (!wantsAllLocations && Array.isArray(locationIds) && locationIds.length > 0) {
      for (const locId of locationIds) {
        try {
          await db.query(
            `INSERT INTO user_locations (user_id, location_id) VALUES (?, ?)`,
            [newUserId, locId]
          );
        } catch (e) {
          console.warn('[UserMgmt] user_locations insert warning:', e.message);
        }
      }
    } else if (!wantsAllLocations && !locationIds && resolvedLocationId) {
      // Single locationId provided — insert that one into user_locations
      try {
        await db.query(
          `INSERT INTO user_locations (user_id, location_id) VALUES (?, ?)`,
          [newUserId, resolvedLocationId]
        );
      } catch (e) {
        console.warn('[UserMgmt] user_locations insert warning:', e.message);
      }
    }
    // If wantsAllLocations is true, do NOT insert into user_locations
    // (NULL location_id on users table signals global access)

    // Save permissions if provided
    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      const grantedBy = req.user ? req.user.username : 'Admin';
      for (const perm of permissions) {
        try {
          await db.query(
            `INSERT INTO user_permissions (user_id, module, can_view, can_add, can_edit, can_delete, can_export, can_approve, granted_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE can_view=VALUES(can_view), can_add=VALUES(can_add), can_edit=VALUES(can_edit),
               can_delete=VALUES(can_delete), can_export=VALUES(can_export), can_approve=VALUES(can_approve), granted_by=VALUES(granted_by)`,
            [newUserId, perm.module, !!perm.can_view, !!perm.can_add, !!perm.can_edit,
             !!perm.can_delete, !!perm.can_export, !!perm.can_approve, grantedBy]
          );
        } catch (e) {
          console.warn('[UserMgmt] Permission insert warning:', e.message);
        }
      }
    }

    await _audit(req, 'CREATE_USER', { username, role, locationId: resolvedLocationId, allLocations: wantsAllLocations, locationIds });

    return successRes(res, { id: newUserId, username }, 'User created successfully');
  } catch (err) {
    return errorRes(res, 'Failed to create user', [err.message], 500);
  }
}

// ── Update an existing user ───────────────────────────────────────
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phone, department, designation, role, locationId, locationIds, allLocations, maxModules, active } = req.body;

    // Check user exists
    const [[user]] = await db.query(`SELECT id, username FROM users WHERE id = ?`, [id]);
    if (!user) {
      return errorRes(res, 'User not found', [], 404);
    }

    const updates = [];
    const params = [];

    if (fullName !== undefined) { updates.push('full_name = ?'); params.push(fullName); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email || null); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone || null); }
    if (department !== undefined) { updates.push('department = ?'); params.push(department || null); }
    if (designation !== undefined) { updates.push('designation = ?'); params.push(designation || null); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
    if (maxModules !== undefined) { updates.push('max_modules = ?'); params.push(maxModules); }

    // Location scope: honour the explicit allLocations flag when provided
    // (true → global NULL location; false → pinned to one store)
    const scopeProvided = allLocations !== undefined || locationId !== undefined;
    if (scopeProvided) {
      const wantsAllLocations = allLocations === true;
      const resolvedLocationId = wantsAllLocations ? null : (locationId || 2);

      updates.push('location_id = ?');
      params.push(resolvedLocationId);

      let locationCode = null;
      if (resolvedLocationId) {
        try {
          const [[loc]] = await db.query(`SELECT location_code FROM locations WHERE id = ?`, [resolvedLocationId]);
          locationCode = loc ? loc.location_code : 'DAV';
        } catch (e) {
          locationCode = resolvedLocationId === 1 ? 'BEL' : resolvedLocationId === 3 ? 'SHI' : 'DAV';
        }
      }
      updates.push('location_code = ?');
      params.push(locationCode);
    }

    if (updates.length > 0) {
      params.push(id);
      await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    // ── Multi-location: sync user_locations ─────────────────────────
    const wantsAllLocations = allLocations === true;
    if (wantsAllLocations) {
      // Global access — remove all user_locations rows
      try {
        await db.query(`DELETE FROM user_locations WHERE user_id = ?`, [id]);
      } catch (e) {
        console.warn('[UserMgmt] user_locations delete warning:', e.message);
      }
    } else if (Array.isArray(locationIds) && locationIds.length > 0) {
      // Explicit array of locations provided — replace
      try {
        await db.query(`DELETE FROM user_locations WHERE user_id = ?`, [id]);
        for (const locId of locationIds) {
          await db.query(
            `INSERT INTO user_locations (user_id, location_id) VALUES (?, ?)`,
            [id, locId]
          );
        }
      } catch (e) {
        console.warn('[UserMgmt] user_locations sync warning:', e.message);
      }
    }
    // If neither allLocations nor locationIds provided, leave user_locations untouched

    await _audit(req, 'UPDATE_USER', { userId: id, username: user.username, changes: req.body });

    return successRes(res, { id }, 'User updated successfully');
  } catch (err) {
    return errorRes(res, 'Failed to update user', [err.message], 500);
  }
};

// ── Delete a user ─────────────────────────────────────────────────
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Cannot delete built-in system admin
    const [[user]] = await db.query(`SELECT id, username FROM users WHERE id = ?`, [id]);
    if (!user) {
      return errorRes(res, 'User not found', [], 404);
    }

    const protectedUsers = ['admin@bsctextiles.com', 'admin'];
    if (protectedUsers.includes(user.username.toLowerCase())) {
      return errorRes(res, 'Cannot delete the built-in system administrator account', [], 403);
    }

    // Delete permissions first
    try { await db.query(`DELETE FROM user_permissions WHERE user_id = ?`, [id]); } catch (e) {}

    // Delete user_locations
    try { await db.query(`DELETE FROM user_locations WHERE user_id = ?`, [id]); } catch (e) {}

    await db.query(`DELETE FROM users WHERE id = ?`, [id]);

    await _audit(req, 'DELETE_USER', { userId: id, username: user.username });

    return successRes(res, { id }, 'User deleted successfully');
  } catch (err) {
    return errorRes(res, 'Failed to delete user', [err.message], 500);
  }
};

// ── Get user permissions ──────────────────────────────────────────
const getUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;

    const [permissions] = await db.query(
      `SELECT module, can_view, can_add, can_edit, can_delete, can_export, can_approve, granted_by, granted_at
       FROM user_permissions WHERE user_id = ?`,
      [id]
    );

    return successRes(res, { permissions, modules: MODULE_REGISTRY }, 'Permissions retrieved');
  } catch (err) {
    // If table doesn't exist yet, return empty
    return successRes(res, { permissions: [], modules: MODULE_REGISTRY }, 'Permissions retrieved (empty)');
  }
};

// ── Bulk-update user permissions ──────────────────────────────────
const updatePermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return errorRes(res, 'Permissions must be an array', [], 400);
    }

    // Check user exists
    const [[user]] = await db.query(`SELECT id, username, max_modules FROM users WHERE id = ?`, [id]);
    if (!user) {
      return errorRes(res, 'User not found', [], 404);
    }

    // Check max_modules limit
    if (user.max_modules) {
      const viewableCount = permissions.filter(p => p.can_view).length;
      if (viewableCount > user.max_modules) {
        return errorRes(res, `Cannot assign more than ${user.max_modules} modules to this user`, [], 400);
      }
    }

    const grantedBy = req.user ? req.user.username : 'Admin';

    // Delete existing permissions and re-insert
    await db.query(`DELETE FROM user_permissions WHERE user_id = ?`, [id]);

    for (const perm of permissions) {
      if (!perm.module) continue;
      // Only insert if at least one permission is granted
      if (perm.can_view || perm.can_add || perm.can_edit || perm.can_delete || perm.can_export || perm.can_approve) {
        await db.query(
          `INSERT INTO user_permissions (user_id, module, can_view, can_add, can_edit, can_delete, can_export, can_approve, granted_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, perm.module, !!perm.can_view, !!perm.can_add, !!perm.can_edit,
           !!perm.can_delete, !!perm.can_export, !!perm.can_approve, grantedBy]
        );
      }
    }

    await _audit(req, 'UPDATE_PERMISSIONS', { userId: id, username: user.username, moduleCount: permissions.filter(p => p.can_view).length });

    return successRes(res, { id }, 'Permissions updated successfully');
  } catch (err) {
    return errorRes(res, 'Failed to update permissions', [err.message], 500);
  }
};

// ── Toggle user active status ─────────────────────────────────────
const toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const [[user]] = await db.query(`SELECT id, username, active FROM users WHERE id = ?`, [id]);
    if (!user) {
      return errorRes(res, 'User not found', [], 404);
    }

    const protectedUsers = ['admin@bsctextiles.com', 'admin'];
    if (protectedUsers.includes(user.username.toLowerCase())) {
      return errorRes(res, 'Cannot deactivate the built-in system administrator account', [], 403);
    }

    const newStatus = user.active ? 0 : 1;
    await db.query(`UPDATE users SET active = ? WHERE id = ?`, [newStatus, id]);

    await _audit(req, newStatus ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', { userId: id, username: user.username });

    return successRes(res, { id, active: !!newStatus }, `User ${newStatus ? 'activated' : 'deactivated'} successfully`);
  } catch (err) {
    return errorRes(res, 'Failed to toggle user status', [err.message], 500);
  }
};

// ── Reset user password ───────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return errorRes(res, 'Password must be at least 6 characters', [], 400);
    }

    const [[user]] = await db.query(`SELECT id, username FROM users WHERE id = ?`, [id]);
    if (!user) {
      return errorRes(res, 'User not found', [], 404);
    }

    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    await db.query(`UPDATE users SET password = ? WHERE id = ?`, [hashedPassword, id]);

    await _audit(req, 'RESET_PASSWORD', { userId: id, username: user.username });

    return successRes(res, { id }, 'Password reset successfully');
  } catch (err) {
    return errorRes(res, 'Failed to reset password', [err.message], 500);
  }
};

// ── List available modules ────────────────────────────────────────
const listModules = async (req, res) => {
  return successRes(res, { modules: MODULE_REGISTRY }, 'Modules retrieved');
};

// ── Get current user's active permissions ─────────────────────────
const getMyPermissions = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return errorRes(res, 'Authentication required', [], 401);
    }

    if (['Admin', 'Super Admin'].includes(role)) {
      return successRes(res, {
        isAdmin: true,
        custom: true,
        modules: MODULE_REGISTRY.map(m => m.key)
      }, 'Admin full permissions');
    }

    const [rows] = await db.query(
      `SELECT module, can_view, can_add, can_edit, can_delete, can_export, can_approve
       FROM user_permissions WHERE user_id = ?`,
      [userId]
    );

    if (!rows || rows.length === 0) {
      // No custom overrides set, fall back to role defaults
      return successRes(res, { isAdmin: false, custom: false, permissions: [] }, 'Using role defaults');
    }

    const viewableModules = rows.filter(r => r.can_view).map(r => r.module);

    return successRes(res, {
      isAdmin: false,
      custom: true,
      modules: viewableModules,
      permissions: rows
    }, 'User custom permissions retrieved');
  } catch (err) {
    return successRes(res, { isAdmin: false, custom: false, permissions: [] }, 'Fallback to role defaults');
  }
};

// ── Audit helper ──────────────────────────────────────────────────
async function _audit(req, action, details) {
  try {
    const username = req.user ? req.user.username : 'System';
    const detailStr = typeof details === 'object' ? JSON.stringify(details) : String(details);
    await db.query(
      `INSERT INTO audit_logs (username, action, module, details, ip_address) VALUES (?, ?, 'UserManagement', ?, ?)`,
      [username, action, detailStr, req.ip || null]
    );
  } catch (e) {
    console.warn('[UserMgmt] Audit log skipped:', e.message);
  }
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getUserPermissions,
  updatePermissions,
  toggleStatus,
  resetPassword,
  listModules,
  getMyPermissions
};
