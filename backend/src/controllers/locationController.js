/**
 * BSC Location Management Controller
 * Handles: list locations, create, update, get global stats
 */
const db = require('../config/db');

// ── List all locations ───────────────────────────────────────
exports.getLocations = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT l.*,
        (SELECT COUNT(*) FROM users u WHERE u.location_id = l.id AND u.active = TRUE) AS active_users,
        (SELECT COUNT(*) FROM candidates c WHERE c.location_id = l.id) AS total_candidates,
        (SELECT COUNT(*) FROM candidates c WHERE c.location_id = l.id AND c.status IN ('Joined','Mark Joined','Offer Accepted','Confirmed DOJ')) AS joined_count
       FROM locations l
       WHERE l.status = 'Active'
       ORDER BY l.sort_order ASC, l.location_name ASC`
    );
    return res.json({ success: true, locations: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Get single location detail ───────────────────────────────
exports.getLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      `SELECT l.*,
        (SELECT COUNT(*) FROM users u WHERE u.location_id = l.id AND u.active = TRUE) AS active_users,
        (SELECT COUNT(*) FROM candidates c WHERE c.location_id = l.id) AS total_candidates
       FROM locations l WHERE l.id = ?`, [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Location not found' });
    return res.json({ success: true, location: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Create location (Global Admin only) ─────────────────────
exports.createLocation = async (req, res) => {
  try {
    const { location_name, location_code, address, phone: rawPhone, email, sort_order } = req.body;
    if (!location_name || !location_code) {
      return res.status(400).json({ success: false, error: 'location_name and location_code are required' });
    }
    // Normalize phone to +91 format
    let phone = rawPhone || null;
    if (phone) {
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 10) phone = `+91${digits}`;
      else if (digits.length === 12 && digits.startsWith('91')) phone = `+${digits}`;
      else if (digits.length === 11 && digits.startsWith('0')) phone = `+91${digits.slice(1)}`;
    }
    const [result] = await db.query(
      `INSERT INTO locations (location_name, location_code, address, phone, email, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [location_name, location_code.toUpperCase().trim(), address || null, phone || null, email || null, sort_order || 99]
    );
    return res.json({ success: true, locationId: result.insertId, message: 'Location created successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Update location (Global Admin only) ─────────────────────
exports.updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { location_name, address, phone: rawPhone, email, status, sort_order } = req.body;
    // Normalize phone to +91 format
    let phone = rawPhone;
    if (phone && typeof phone === 'string') {
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 10) phone = `+91${digits}`;
      else if (digits.length === 12 && digits.startsWith('91')) phone = `+${digits}`;
      else if (digits.length === 11 && digits.startsWith('0')) phone = `+91${digits.slice(1)}`;
    }
    await db.query(
      `UPDATE locations SET
         location_name = COALESCE(?, location_name),
         address = COALESCE(?, address),
         phone = COALESCE(?, phone),
         email = COALESCE(?, email),
         status = COALESCE(?, status),
         sort_order = COALESCE(?, sort_order)
       WHERE id = ?`,
      [location_name, address, phone, email, status, sort_order, id]
    );
    return res.json({ success: true, message: 'Location updated' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Global dashboard stats (Global Admin only) ───────────────
exports.getGlobalStats = async (req, res) => {
  try {
    const [locations] = await db.query(
      `SELECT id, location_name, location_code FROM locations WHERE status = 'Active' ORDER BY sort_order ASC`
    );

    const stats = [];
    for (const loc of locations) {
      const [[cand]]  = await db.query(`SELECT COUNT(*) AS cnt FROM candidates WHERE location_id = ?`, [loc.id]);
      const [[joined]] = await db.query(
        `SELECT COUNT(*) AS cnt FROM candidates WHERE location_id = ? AND status IN ('Joined','Mark Joined','Offer Accepted','Confirmed DOJ')`, [loc.id]
      );
      const [[pending]] = await db.query(
        `SELECT COUNT(*) AS cnt FROM candidates WHERE location_id = ? AND status NOT IN ('Joined','Mark Joined','Rejected','Dropped')`, [loc.id]
      );
      const [[users]] = await db.query(`SELECT COUNT(*) AS cnt FROM users WHERE location_id = ? AND active = TRUE`, [loc.id]);

      stats.push({
        locationId: loc.id,
        locationCode: loc.location_code,
        locationName: loc.location_name,
        totalCandidates: cand.cnt,
        joined: joined.cnt,
        pending: pending.cnt,
        activeUsers: users.cnt
      });
    }

    const totals = stats.reduce((acc, s) => ({
      totalCandidates: acc.totalCandidates + s.totalCandidates,
      joined: acc.joined + s.joined,
      pending: acc.pending + s.pending,
      activeUsers: acc.activeUsers + s.activeUsers
    }), { totalCandidates: 0, joined: 0, pending: 0, activeUsers: 0 });

    return res.json({ success: true, locations: stats, totals, locationCount: locations.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
