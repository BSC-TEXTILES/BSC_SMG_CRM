const pool = require('../config/db');
const { successRes, errorRes } = require('../utils/response');
const { getLocationFilter, injectLocationId } = require('../middleware/auth');
const { encryptField, decryptRows, decryptRow } = require('../utils/crypto');
const { parseCsv, rowsToObjects } = require('../utils/csv');

// Free-text PII fields stored encrypted at rest (AES-256-GCM, see utils/crypto.js)
const ENCRYPTED_FIELDS = ['customer_notes'];
const CALL_LOG_ENCRYPTED_FIELDS = ['remarks'];

/**
 * Helper to build location filter dynamically.
 * If user is Global Admin and query.locationId / location_id is passed, filters by that location.
 * Otherwise uses standard getLocationFilter based on user's assigned branch.
 */
function resolveLocFilter(req, tableAlias = 'w') {
  const col = tableAlias ? `${tableAlias}.location_id` : 'location_id';
  const userLoc = req.user ? req.user.locationId : null;
  const isGlobal = !userLoc;

  if (isGlobal) {
    const locParam = req.query.locationId || req.query.location_id;
    if (locParam && locParam !== 'all' && !isNaN(parseInt(locParam, 10))) {
      return {
        clause: `AND ${col} = ?`,
        params: [parseInt(locParam, 10)]
      };
    }
    return { clause: '', params: [] };
  }

  // Branch user is strictly locked to their location
  return {
    clause: `AND ${col} = ?`,
    params: [userLoc]
  };
}

let tablesChecked = false;
async function ensureTables() {
  if (tablesChecked) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`wedding_customers\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`customer_code\` VARCHAR(50) NOT NULL UNIQUE,
        \`location_id\` INT NOT NULL DEFAULT 2,
        \`customer_name\` VARCHAR(150) NOT NULL,
        \`mobile_number\` VARCHAR(20) NOT NULL,
        \`email\` VARCHAR(150) NULL,
        \`wedding_date\` DATE NULL,
        \`expected_shopping_date\` DATE NOT NULL,
        \`preferred_shopping_category\` VARCHAR(150) NULL,
        \`estimated_family_size\` INT NULL DEFAULT 1,
        \`assigned_telecaller\` VARCHAR(150) NULL,
        \`assigned_telecaller_id\` INT NULL,
        \`follow_up_date\` DATE NOT NULL,
        \`preferred_call_time\` VARCHAR(50) NULL,
        \`customer_notes\` TEXT NULL,
        \`customer_status\` VARCHAR(50) NOT NULL DEFAULT 'New',
        \`call_status\` VARCHAR(50) NOT NULL DEFAULT 'Pending',
        \`total_calls_count\` INT NOT NULL DEFAULT 0,
        \`last_call_date\` DATETIME NULL,
        \`last_call_outcome\` VARCHAR(100) NULL,
        \`created_by\` VARCHAR(150) NULL,
        \`created_by_user_id\` INT NULL,
        \`is_deleted\` TINYINT(1) NOT NULL DEFAULT 0,
        \`deleted_at\` DATETIME NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_wed_loc_status\` (\`location_id\`, \`customer_status\`, \`follow_up_date\`),
        INDEX \`idx_wed_mobile_loc\` (\`mobile_number\`, \`location_id\`),
        INDEX \`idx_wed_follow_up\` (\`follow_up_date\`),
        INDEX \`idx_wed_shop_date\` (\`expected_shopping_date\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`wedding_call_logs\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`customer_id\` INT NOT NULL,
        \`location_id\` INT NOT NULL DEFAULT 2,
        \`call_date\` DATE NOT NULL,
        \`call_time\` VARCHAR(20) NOT NULL,
        \`telecaller_name\` VARCHAR(150) NOT NULL,
        \`telecaller_id\` INT NULL,
        \`call_status\` VARCHAR(50) NOT NULL DEFAULT 'Completed',
        \`call_outcome\` VARCHAR(50) NOT NULL,
        \`remarks\` TEXT NULL,
        \`next_follow_up_date\` DATE NULL,
        \`next_follow_up_time\` VARCHAR(50) NULL,
        \`expected_shopping_date_updated\` DATE NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_call_cust\` (\`customer_id\`),
        INDEX \`idx_call_date\` (\`call_date\`),
        INDEX \`idx_call_loc\` (\`location_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`wedding_audit_logs\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`customer_id\` INT NULL,
        \`location_id\` INT NOT NULL DEFAULT 2,
        \`user_name\` VARCHAR(150) NOT NULL,
        \`action\` VARCHAR(100) NOT NULL,
        \`details\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_audit_cust\` (\`customer_id\`),
        INDEX \`idx_audit_loc\` (\`location_id\`),
        INDEX \`idx_audit_action\` (\`action\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const [cnt] = await pool.query(`SELECT COUNT(*) AS total FROM wedding_customers WHERE is_deleted = 0`);
    if (!cnt || cnt[0]?.total === 0) {
      await pool.query(`
        INSERT IGNORE INTO wedding_customers (
          customer_code, location_id, customer_name, mobile_number, email, wedding_date,
          expected_shopping_date, preferred_shopping_category, estimated_family_size,
          assigned_telecaller, follow_up_date, preferred_call_time, customer_notes,
          customer_status, call_status
        ) VALUES
        ('WED-DAV-2026-0001', 2, 'Ananya Sharma', '9845012345', 'ananya.s@example.com', DATE_ADD(CURDATE(), INTERVAL 45 DAY), DATE_ADD(CURDATE(), INTERVAL 15 DAY), 'Bridal Lehengas', 4, 'Pooja Telecaller', CURDATE(), 'Morning (10 AM - 1 PM)', 'Interested in premium bridal lehengas', 'Follow-up Pending', 'Call Back Requested'),
        ('WED-DAV-2026-0002', 2, 'Rajeshwari Patil', '9741098765', 'rajeshwari.p@example.com', DATE_ADD(CURDATE(), INTERVAL 60 DAY), DATE_ADD(CURDATE(), INTERVAL 20 DAY), 'Pure Silk Sarees', 6, 'Sneha Follow-up', DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'Afternoon (1 PM - 4 PM)', 'Pure Kanchipuram silk sarees for marriage ceremony', 'Contacted', 'No Answer'),
        ('WED-DAV-2026-0003', 2, 'Vijay Kumar Hegde', '9448054321', 'vijay.hegde@example.com', DATE_ADD(CURDATE(), INTERVAL 30 DAY), DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'Sherwanis & Suits', 3, 'Pooja Telecaller', CURDATE(), 'Evening (4 PM - 7 PM)', 'Groom sherwani and family shopping confirmed', 'Shopping Date Confirmed', 'Completed'),
        ('WED-BEL-2026-0001', 1, 'Deepa Kulkarni', '9980112233', 'deepa.k@example.com', DATE_ADD(CURDATE(), INTERVAL 40 DAY), DATE_ADD(CURDATE(), INTERVAL 10 DAY), 'Pure Silk Sarees', 5, 'Kiran CRM Desk', CURDATE(), 'Morning (10 AM - 1 PM)', 'Visited Belagavi store, follow up scheduled', 'New', 'Pending'),
        ('WED-SHI-2026-0001', 3, 'Manjunath Gowda', '9632009988', 'manjunath.g@example.com', DATE_ADD(CURDATE(), INTERVAL 50 DAY), DATE_ADD(CURDATE(), INTERVAL 18 DAY), 'Family Matching Sets', 8, 'Pooja Telecaller', DATE_ADD(CURDATE(), INTERVAL 2 DAY), 'Morning (10 AM - 1 PM)', 'Family wedding group for Shivamogga store', 'Interested', 'Completed')
      `);
    }

    tablesChecked = true;
  } catch (err) {
    console.error('[WeddingController.ensureTables Error]', err.message);
  }
}

class WeddingController {
  // ── 1. Dashboard KPI Stats ──────────────────────────────────────────
  async getDashboardStats(req, res) {
    try {
      await ensureTables();
      const { clause, params } = resolveLocFilter(req, 'w');

      const [rows] = await pool.query(`
        SELECT
          COUNT(*) AS totalCustomers,
          SUM(CASE WHEN w.follow_up_date = CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed') THEN 1 ELSE 0 END) AS todayFollowUps,
          SUM(CASE WHEN w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed') THEN 1 ELSE 0 END) AS overdueFollowUps,
          SUM(CASE WHEN w.call_status IN ('Pending', 'Call Back Requested', 'No Answer', 'Busy') THEN 1 ELSE 0 END) AS callsPending,
          SUM(CASE WHEN w.call_status = 'Completed' THEN 1 ELSE 0 END) AS callsCompleted,
          SUM(CASE WHEN w.customer_status = 'Shopping Date Confirmed' THEN 1 ELSE 0 END) AS shoppingConfirmed,
          SUM(CASE WHEN w.customer_status IN ('Visited Store', 'Converted') THEN 1 ELSE 0 END) AS visitedConverted,
          SUM(CASE WHEN w.customer_status = 'Not Interested' THEN 1 ELSE 0 END) AS notInterested
        FROM wedding_customers w
        WHERE w.is_deleted = 0 ${clause}
      `, params);

      const raw = rows[0] || {};
      const stats = {
        totalCustomers: Number(raw.totalCustomers) || 0,
        todayFollowUps: Number(raw.todayFollowUps) || 0,
        overdueFollowUps: Number(raw.overdueFollowUps) || 0,
        callsPending: Number(raw.callsPending) || 0,
        callsCompleted: Number(raw.callsCompleted) || 0,
        shoppingConfirmed: Number(raw.shoppingConfirmed) || 0,
        visitedConverted: Number(raw.visitedConverted) || 0,
        notInterested: Number(raw.notInterested) || 0,
        // Aliases for compatibility
        total_customers: Number(raw.totalCustomers) || 0,
        due_today: Number(raw.todayFollowUps) || 0,
        overdue: Number(raw.overdueFollowUps) || 0,
        calls_pending: Number(raw.callsPending) || 0,
        calls_completed: Number(raw.callsCompleted) || 0,
        shopping_confirmed: Number(raw.shoppingConfirmed) || 0,
        visited_converted: Number(raw.visitedConverted) || 0,
        not_interested: Number(raw.notInterested) || 0
      };

      // Location breakdown if Global Admin
      let locationStats = [];
      if (!req.user || !req.user.locationId) {
        const [locRows] = await pool.query(`
          SELECT 
            l.id AS location_id,
            l.location_code,
            l.location_name,
            COUNT(w.id) AS total_customers,
            SUM(CASE WHEN w.follow_up_date = CURDATE() THEN 1 ELSE 0 END) AS today_follow_ups,
            SUM(CASE WHEN w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed') THEN 1 ELSE 0 END) AS overdue_follow_ups
          FROM locations l
          LEFT JOIN wedding_customers w ON w.location_id = l.id AND w.is_deleted = 0
          GROUP BY l.id, l.location_code, l.location_name
          ORDER BY l.sort_order ASC
        `);
        locationStats = locRows || [];
      }

      return successRes(res, {
        stats,
        locationStats
      }, 'Dashboard stats fetched successfully');
    } catch (err) {
      console.error('[WeddingController.getDashboardStats Error]', err);
      return errorRes(res, 'Failed to fetch wedding dashboard stats', [err.message], 500);
    }
  }

  // ── 2. Get Filtered & Paginated Customers ───────────────────────────
  async getCustomers(req, res) {
    try {
      await ensureTables();
      const {
        dateView = req.query.date_filter || 'all',
        customerStatus = req.query.status,
        callStatus = req.query.call_status,
        telecaller = req.query.telecaller_id,
        search,
        startDate = req.query.from_date,
        endDate = req.query.to_date,
        page = 1,
        limit = 50
      } = req.query;

      const { clause: locClause, params: queryParams } = resolveLocFilter(req, 'w');
      let whereClauses = [`w.is_deleted = 0`, `1=1 ${locClause}`];

      // Date Quick-view Filter
      if (dateView === 'today') {
        whereClauses.push(`w.follow_up_date = CURDATE()`);
      } else if (dateView === 'tomorrow') {
        whereClauses.push(`w.follow_up_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)`);
      } else if (dateView === 'overdue') {
        whereClauses.push(`w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')`);
      } else if (dateView === 'this_week') {
        whereClauses.push(`YEARWEEK(w.follow_up_date, 1) = YEARWEEK(CURDATE(), 1)`);
      } else if (dateView === 'next_week') {
        whereClauses.push(`YEARWEEK(w.follow_up_date, 1) = YEARWEEK(CURDATE(), 1) + 1`);
      } else if (dateView === 'custom' && startDate && endDate) {
        whereClauses.push(`w.follow_up_date BETWEEN ? AND ?`);
        queryParams.push(startDate, endDate);
      }

      // Customer Status Filter
      if (customerStatus && customerStatus !== 'all') {
        whereClauses.push(`w.customer_status = ?`);
        queryParams.push(customerStatus);
      }

      // Call Status Filter
      if (callStatus && callStatus !== 'all') {
        whereClauses.push(`w.call_status = ?`);
        queryParams.push(callStatus);
      }

      // Assigned Telecaller Filter
      if (telecaller && telecaller !== 'all') {
        if (!isNaN(parseInt(telecaller, 10))) {
          whereClauses.push(`(w.assigned_telecaller_id = ? OR w.assigned_telecaller = ?)`);
          queryParams.push(parseInt(telecaller, 10), telecaller);
        } else {
          whereClauses.push(`w.assigned_telecaller = ?`);
          queryParams.push(telecaller);
        }
      }

      // Fast Search Filter
      if (search && search.trim()) {
        const q = `%${search.trim().toLowerCase()}%`;
        whereClauses.push(`(
          LOWER(w.customer_name) LIKE ? OR
          w.mobile_number LIKE ? OR
          LOWER(w.customer_code) LIKE ? OR
          LOWER(COALESCE(w.email, '')) LIKE ?
        )`);
        queryParams.push(q, q, q, q);
      }

      const whereSql = whereClauses.join(' AND ');

      // Total count
      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total FROM wedding_customers w WHERE ${whereSql}`,
        queryParams
      );
      const total = countResult[0]?.total || 0;

      // Pagination (guard against non-numeric input — LIMIT ? must bind an integer)
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 50));
      const offset = (pageNum - 1) * limitNum;

      const [customers] = await pool.query(`
        SELECT 
          w.*,
          l.location_code,
          l.location_name,
          CASE 
            WHEN w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
            THEN DATEDIFF(CURDATE(), w.follow_up_date)
            ELSE 0 
          END AS overdue_days
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE ${whereSql}
        ORDER BY 
          CASE WHEN w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed') THEN 0 ELSE 1 END,
          w.follow_up_date ASC,
          w.id DESC
        LIMIT ? OFFSET ?
      `, [...queryParams, limitNum, offset]);

      decryptRows(customers, ENCRYPTED_FIELDS);

      return successRes(res, {
        customers: customers || [],
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      }, 'Customers fetched successfully');
    } catch (err) {
      console.error('[WeddingController.getCustomers Error]', err);
      return errorRes(res, 'Failed to fetch wedding customers', [err.message], 500);
    }
  }

  // ── 3. Duplicate Mobile Check ───────────────────────────────────────
  async checkDuplicate(req, res) {
    try {
      const mobile = req.body.mobile || req.body.phone || req.body.mobile_number;
      const customerId = req.body.customerId || req.body.customer_id;

      if (!mobile || !mobile.trim()) {
        return errorRes(res, 'Mobile number is required', [], 400);
      }

      const cleanMobile = mobile.trim();
      const { clause: locClause, params } = resolveLocFilter(req, 'w');

      let sql = `
        SELECT w.id, w.customer_code, w.customer_name, w.mobile_number, w.customer_status, w.assigned_telecaller, l.location_name
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE w.mobile_number = ? AND w.is_deleted = 0 ${locClause}
      `;
      const queryParams = [cleanMobile, ...params];

      if (customerId) {
        sql += ` AND w.id != ?`;
        queryParams.push(parseInt(customerId, 10));
      }

      const [rows] = await pool.query(sql, queryParams);

      if (rows && rows.length > 0) {
        return successRes(res, {
          exists: true,
          customer: rows[0],
          existingCustomer: rows[0]
        }, 'Duplicate customer found with this mobile number');
      }

      return successRes(res, { exists: false }, 'Mobile number is unique');
    } catch (err) {
      console.error('[WeddingController.checkDuplicate Error]', err);
      return errorRes(res, 'Failed to check duplicate', [err.message], 500);
    }
  }

  // ── 4. Create Wedding Customer ──────────────────────────────────────
  async createCustomer(req, res) {
    try {
      const customerName = (req.body.customer_name || req.body.customerName || '').trim();
      const mobileNumber = (req.body.mobile_number || req.body.phone || req.body.mobile || '').trim();
      const email = (req.body.email || '').trim() || null;
      const weddingDate = req.body.wedding_date || req.body.weddingDate || null;
      const expectedShoppingDate = req.body.expected_shopping_date || req.body.expectedShoppingDate;
      const preferredCategory = req.body.preferred_shopping_category || req.body.preferredShoppingCategory || (Array.isArray(req.body.shopping_categories) ? req.body.shopping_categories.join(', ') : req.body.shopping_categories) || 'General Wedding Shopping';
      const estimatedFamilySize = parseInt(req.body.estimated_family_size || req.body.estimatedFamilySize || 1, 10);
      let assignedTelecaller = (req.body.assigned_telecaller || req.body.assignedTelecaller || '').trim() || null;
      let assignedTelecallerId = req.body.assigned_telecaller_id ? parseInt(req.body.assigned_telecaller_id, 10) : null;
      const followUpDate = req.body.follow_up_date || req.body.followUpDate;
      const preferredCallTime = req.body.preferred_call_time || req.body.preferredCallTime || 'Morning (10 AM - 1 PM)';
      const customerNotes = req.body.customer_notes || req.body.customerNotes || req.body.initial_notes || null;
      const requestedLocationId = req.body.location_id || req.body.locationId;

      if (!customerName) {
        return errorRes(res, 'Customer name is required', [], 400);
      }
      if (!mobileNumber) {
        return errorRes(res, 'Mobile number is required', [], 400);
      }
      if (!expectedShoppingDate) {
        return errorRes(res, 'Expected shopping date is required', [], 400);
      }
      if (!followUpDate) {
        return errorRes(res, 'Follow-up date is required', [], 400);
      }

      // Enforce location security: branch user strictly locked to their location
      let locationId = req.user ? req.user.locationId : null;
      if (!locationId) {
        // Global admin can specify location or defaults to 2 (Davanagere)
        locationId = requestedLocationId ? parseInt(requestedLocationId, 10) : 2;
      }

      // Fetch location code for code generation
      const [locRows] = await pool.query(`SELECT location_code FROM locations WHERE id = ?`, [locationId]);
      const locCode = locRows[0]?.location_code || 'BSC';

      // Duplicate mobile check per location
      const [dup] = await pool.query(`
        SELECT id, customer_code, customer_name FROM wedding_customers 
        WHERE mobile_number = ? AND location_id = ? AND is_deleted = 0
      `, [mobileNumber, locationId]);

      if (dup && dup.length > 0) {
        return errorRes(res, `Customer with mobile ${mobileNumber} already exists (${dup[0].customer_name} - ${dup[0].customer_code})`, [], 409);
      }

      // If assigned_telecaller_id provided without name, find name
      if (assignedTelecallerId && !assignedTelecaller) {
        const [u] = await pool.query(`SELECT full_name FROM users WHERE id = ?`, [assignedTelecallerId]);
        if (u && u.length > 0) assignedTelecaller = u[0].full_name;
      }
      if (!assignedTelecaller) {
        assignedTelecaller = req.user?.fullName || 'Staff';
        assignedTelecallerId = req.user?.id || null;
      }

      // Generate sequence code: WED-[LOC]-[YEAR]-[SEQ]
      // Collision-proof: derive the next sequence from the highest existing
      // suffix (COUNT(*)+1 collides once any customer is deleted, since the
      // column is UNIQUE). A short retry loop absorbs concurrent inserts.
      const year = new Date().getFullYear();
      const codePrefix = `WED-${locCode}-${year}-`;
      let customerCode = null;
      for (let attempt = 0; attempt < 5 && !customerCode; attempt++) {
        const [lastRows] = await pool.query(
          `SELECT customer_code FROM wedding_customers WHERE customer_code LIKE ? ORDER BY id DESC LIMIT 1`,
          [`${codePrefix}%`]
        );
        const lastSeq = lastRows && lastRows[0]
          ? parseInt(String(lastRows[0].customer_code).slice(-4), 10) || 0
          : 0;
        const candidate = `${codePrefix}${String(lastSeq + 1).padStart(4, '0')}`;
        const [exists] = await pool.query(
          `SELECT id FROM wedding_customers WHERE customer_code = ?`,
          [candidate]
        );
        if (!exists || exists.length === 0) {
          customerCode = candidate;
        }
      }
      if (!customerCode) {
        return errorRes(res, 'Could not allocate a unique customer code, please retry', [], 500);
      }

      const [insertResult] = await pool.query(`
        INSERT INTO wedding_customers (
          customer_code,
          location_id,
          customer_name,
          mobile_number,
          email,
          wedding_date,
          expected_shopping_date,
          preferred_shopping_category,
          estimated_family_size,
          assigned_telecaller,
          assigned_telecaller_id,
          follow_up_date,
          preferred_call_time,
          customer_notes,
          customer_status,
          call_status,
          created_by,
          created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 'Pending', ?, ?)
      `, [
        customerCode,
        locationId,
        customerName,
        mobileNumber,
        email,
        weddingDate,
        expectedShoppingDate,
        preferredCategory,
        estimatedFamilySize,
        assignedTelecaller,
        assignedTelecallerId,
        followUpDate,
        preferredCallTime,
        encryptField(customerNotes),
        req.user?.fullName || 'Staff',
        req.user?.id || null
      ]);

      const newId = insertResult.insertId;

      // Audit Log
      await pool.query(`
        INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
        VALUES (?, ?, ?, 'Customer Added', ?)
      `, [
        newId,
        locationId,
        req.user?.fullName || 'Staff',
        `Created wedding customer ${customerName} (${customerCode}). Expected shopping: ${expectedShoppingDate}, Follow-up: ${followUpDate}`
      ]);

      return successRes(res, {
        id: newId,
        customer_code: customerCode,
        customer: {
          id: newId,
          customer_code: customerCode,
          customer_name: customerName,
          mobile_number: mobileNumber,
          location_id: locationId
        }
      }, 'Wedding customer added successfully', 201);
    } catch (err) {
      console.error('[WeddingController.createCustomer Error]', err);
      return errorRes(res, 'Failed to add wedding customer', [err.message], 500);
    }
  }

  // ── 5. Get Customer Profile & Full History ──────────────────────────
  async getCustomerById(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const { clause: locClause, params } = resolveLocFilter(req, 'w');

      const [rows] = await pool.query(`
        SELECT 
          w.*,
          l.location_code,
          l.location_name,
          CASE 
            WHEN w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
            THEN DATEDIFF(CURDATE(), w.follow_up_date)
            ELSE 0 
          END AS overdue_days
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE w.id = ? AND w.is_deleted = 0 ${locClause}
      `, [id, ...params]);

      if (!rows || rows.length === 0) {
        return errorRes(res, 'Customer not found or access denied', [], 404);
      }

      const customer = rows[0];
      decryptRow(customer, ENCRYPTED_FIELDS);

      // Call logs timeline
      const [callLogs] = await pool.query(`
        SELECT * FROM wedding_call_logs
        WHERE customer_id = ?
        ORDER BY call_date DESC, id DESC
      `, [id]);
      decryptRows(callLogs, CALL_LOG_ENCRYPTED_FIELDS);

      // Audit trail
      const [auditLogs] = await pool.query(`
        SELECT * FROM wedding_audit_logs 
        WHERE customer_id = ? 
        ORDER BY created_at DESC
      `, [id]);

      return successRes(res, {
        customer,
        callLogs: callLogs || [],
        timeline: callLogs || [],
        auditLogs: auditLogs || []
      }, 'Customer details fetched successfully');
    } catch (err) {
      console.error('[WeddingController.getCustomerById Error]', err);
      return errorRes(res, 'Failed to fetch customer details', [err.message], 500);
    }
  }

  // ── 6. Update Customer Details (CRUD) ───────────────────────────────
  async updateCustomer(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const { clause: locClause, params: locParams } = resolveLocFilter(req, 'w');

      const [existing] = await pool.query(`
        SELECT * FROM wedding_customers w WHERE w.id = ? AND w.is_deleted = 0 ${locClause}
      `, [id, ...locParams]);

      if (!existing || existing.length === 0) {
        return errorRes(res, 'Customer not found or unauthorized', [], 404);
      }

      const prev = existing[0];
      const customerName = req.body.customer_name || req.body.customerName;
      const mobileNumber = req.body.mobile_number || req.body.phone || req.body.mobile;
      const email = req.body.email;
      const weddingDate = req.body.wedding_date || req.body.weddingDate;
      const expectedShoppingDate = req.body.expected_shopping_date || req.body.expectedShoppingDate;
      const preferredCategory = req.body.preferred_shopping_category || req.body.preferredShoppingCategory || req.body.shopping_categories;
      const estimatedFamilySize = req.body.estimated_family_size || req.body.estimatedFamilySize;
      const assignedTelecaller = req.body.assigned_telecaller || req.body.assignedTelecaller;
      const assignedTelecallerId = req.body.assigned_telecaller_id || req.body.assignedTelecallerId;
      const followUpDate = req.body.follow_up_date || req.body.followUpDate;
      const preferredCallTime = req.body.preferred_call_time || req.body.preferredCallTime;
      const customerNotes = req.body.customer_notes || req.body.customerNotes || req.body.initial_notes;
      const customerStatus = req.body.customer_status || req.body.customerStatus || req.body.current_status;
      const callStatus = req.body.call_status || req.body.callStatus;

      // Duplicate check if mobile is being changed
      if (mobileNumber && mobileNumber.trim() !== prev.mobile_number) {
        const [dup] = await pool.query(`
          SELECT id FROM wedding_customers 
          WHERE mobile_number = ? AND location_id = ? AND id != ? AND is_deleted = 0
        `, [mobileNumber.trim(), prev.location_id, id]);

        if (dup && dup.length > 0) {
          return errorRes(res, `Another customer already exists with mobile ${mobileNumber}`, [], 409);
        }
      }

      await pool.query(`
        UPDATE wedding_customers SET
          customer_name = ?,
          mobile_number = ?,
          email = ?,
          wedding_date = ?,
          expected_shopping_date = ?,
          preferred_shopping_category = ?,
          estimated_family_size = ?,
          assigned_telecaller = ?,
          assigned_telecaller_id = ?,
          follow_up_date = ?,
          preferred_call_time = ?,
          customer_notes = ?,
          customer_status = ?,
          call_status = ?
        WHERE id = ?
      `, [
        customerName ? customerName.trim() : prev.customer_name,
        mobileNumber ? mobileNumber.trim() : prev.mobile_number,
        email !== undefined ? (email ? email.trim() : null) : prev.email,
        weddingDate !== undefined ? weddingDate : prev.wedding_date,
        expectedShoppingDate || prev.expected_shopping_date,
        preferredCategory || prev.preferred_shopping_category,
        estimatedFamilySize ? parseInt(estimatedFamilySize, 10) : prev.estimated_family_size,
        assignedTelecaller || prev.assigned_telecaller,
        assignedTelecallerId ? parseInt(assignedTelecallerId, 10) : prev.assigned_telecaller_id,
        followUpDate || prev.follow_up_date,
        preferredCallTime || prev.preferred_call_time,
        customerNotes !== undefined ? encryptField(customerNotes) : prev.customer_notes,
        customerStatus || prev.customer_status,
        callStatus || prev.call_status,
        id
      ]);

      // Audit log
      const changes = [];
      if (customerStatus && customerStatus !== prev.customer_status) changes.push(`Status: ${prev.customer_status} → ${customerStatus}`);
      if (followUpDate && followUpDate !== prev.follow_up_date) changes.push(`Follow-up: ${prev.follow_up_date} → ${followUpDate}`);
      if (assignedTelecaller && assignedTelecaller !== prev.assigned_telecaller) changes.push(`Telecaller: ${prev.assigned_telecaller} → ${assignedTelecaller}`);
      if (expectedShoppingDate && expectedShoppingDate !== prev.expected_shopping_date) changes.push(`Shopping Date: ${prev.expected_shopping_date} → ${expectedShoppingDate}`);

      await pool.query(`
        INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
        VALUES (?, ?, ?, 'Customer Edited', ?)
      `, [
        id,
        prev.location_id,
        req.user?.fullName || 'Staff',
        changes.length > 0 ? changes.join(', ') : 'Updated customer profile details'
      ]);

      return successRes(res, { id }, 'Customer updated successfully');
    } catch (err) {
      console.error('[WeddingController.updateCustomer Error]', err);
      return errorRes(res, 'Failed to update customer', [err.message], 500);
    }
  }

  // ── 7. Soft Delete Customer ─────────────────────────────────────────
  async deleteCustomer(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const { clause: locClause, params } = resolveLocFilter(req, 'w');

      const [existing] = await pool.query(`
        SELECT * FROM wedding_customers w WHERE w.id = ? AND w.is_deleted = 0 ${locClause}
      `, [id, ...params]);

      if (!existing || existing.length === 0) {
        return errorRes(res, 'Customer not found or unauthorized', [], 404);
      }

      const prev = existing[0];

      await pool.query(`
        UPDATE wedding_customers SET is_deleted = 1, deleted_at = NOW() WHERE id = ?
      `, [id]);

      await pool.query(`
        INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
        VALUES (?, ?, ?, 'Customer Deleted', ?)
      `, [
        id,
        prev.location_id,
        req.user?.fullName || 'Staff',
        `Archived customer ${prev.customer_name} (${prev.customer_code})`
      ]);

      return successRes(res, { id }, 'Customer archived successfully');
    } catch (err) {
      console.error('[WeddingController.deleteCustomer Error]', err);
      return errorRes(res, 'Failed to delete customer', [err.message], 500);
    }
  }

  // ── 8. Log Call & Auto-manage Follow-up ──────────────────────────────
  async logCall(req, res) {
    try {
      await ensureTables();
      const customerId = req.body.customerId || req.body.customer_id;
      const rawCallDate = req.body.callDate || req.body.call_date;
      const callTime = req.body.callTime || req.body.call_time;
      const callStatus = req.body.callStatus || req.body.call_status || 'Completed';
      const callOutcome = req.body.callOutcome || req.body.call_outcome || req.body.outcome;
      const remarks = req.body.remarks || req.body.call_notes || req.body.customer_feedback;
      const rawNextFollowUpDate = req.body.nextFollowUpDate || req.body.next_follow_up_date;
      const nextFollowUpTime = req.body.nextFollowUpTime || req.body.next_follow_up_time;
      const rawExpectedShoppingDate = req.body.expectedShoppingDate || req.body.expected_shopping_date;

      if (!customerId) {
        return errorRes(res, 'Customer ID is required', [], 400);
      }
      if (!callOutcome) {
        return errorRes(res, 'Call outcome is required', [], 400);
      }

      // Sanitize dates to valid 'YYYY-MM-DD' or null to prevent MySQL truncation errors
      const sanitizeDate = (val) => {
        if (!val || typeof val !== 'string' || !val.trim()) return null;
        const clean = val.trim().slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : null;
      };

      const nextFollowUpDate = sanitizeDate(rawNextFollowUpDate);
      const expectedShoppingDate = sanitizeDate(rawExpectedShoppingDate);

      // Branch users are isolated to their location, Global Admin can manage any
      const userLoc = req.user ? req.user.locationId : null;
      let locClause = '';
      let locParams = [];
      if (userLoc) {
        locClause = 'AND w.location_id = ?';
        locParams = [userLoc];
      }

      const [customers] = await pool.query(`
        SELECT * FROM wedding_customers w WHERE w.id = ? AND w.is_deleted = 0 ${locClause}
      `, [parseInt(customerId, 10), ...locParams]);

      if (!customers || customers.length === 0) {
        return errorRes(res, 'Customer not found or access denied', [], 404);
      }

      const cust = customers[0];
      // Business date in the store's timezone (IST)
      const istToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const actualCallDate = sanitizeDate(rawCallDate) || istToday;
      const actualCallTime = callTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
      const telecallerName = req.user?.fullName || 'Telecaller';
      const telecallerId = req.user?.id || null;

      // 1. Insert into wedding_call_logs
      await pool.query(`
        INSERT INTO wedding_call_logs (
          customer_id,
          location_id,
          call_date,
          call_time,
          telecaller_name,
          telecaller_id,
          call_status,
          call_outcome,
          remarks,
          next_follow_up_date,
          next_follow_up_time,
          expected_shopping_date_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        cust.id,
        cust.location_id,
        actualCallDate,
        actualCallTime,
        telecallerName,
        telecallerId,
        callStatus,
        callOutcome,
        encryptField(remarks || null),
        nextFollowUpDate || null,
        nextFollowUpTime || null,
        expectedShoppingDate || null
      ]);

      // 2. Determine automated status transitions
      let newCustomerStatus = cust.customer_status;
      let newCallStatus = callStatus;

      switch (callOutcome) {
        case 'Shopping Confirmed':
          newCustomerStatus = 'Shopping Date Confirmed';
          newCallStatus = 'Completed';
          break;
        case 'Interested':
          newCustomerStatus = 'Interested';
          newCallStatus = 'Completed';
          break;
        case 'Not Interested':
          newCustomerStatus = 'Not Interested';
          newCallStatus = 'Completed';
          break;
        case 'Connected':
          if (newCustomerStatus === 'New' || newCustomerStatus === 'Follow-up Pending') {
            newCustomerStatus = 'Contacted';
          }
          newCallStatus = 'Connected';
          break;
        case 'Call Back Requested':
          newCustomerStatus = 'Follow-up Pending';
          newCallStatus = 'Call Back Requested';
          break;
        case 'No Answer':
          newCallStatus = 'No Answer';
          break;
        case 'Busy':
          newCallStatus = 'Busy';
          break;
        default:
          newCallStatus = 'Completed';
          break;
      }

      // If caller manually passed new_customer_status, prioritize that
      if (req.body.new_customer_status || req.body.customer_status) {
        newCustomerStatus = req.body.new_customer_status || req.body.customer_status;
      }

      // 3. Update customer record
      const updateFields = [
        `total_calls_count = total_calls_count + 1`,
        `last_call_date = NOW()`,
        `last_call_outcome = ?`,
        `call_status = ?`,
        `customer_status = ?`
      ];
      const updateParams = [callOutcome, newCallStatus, newCustomerStatus];

      // Schedule next follow-up if provided (unless Not Interested)
      if (callOutcome !== 'Not Interested') {
        if (nextFollowUpDate) {
          updateFields.push(`follow_up_date = ?`);
          updateParams.push(nextFollowUpDate);
        }
        if (nextFollowUpTime) {
          updateFields.push(`preferred_call_time = ?`);
          updateParams.push(nextFollowUpTime);
        }
      }

      // Update expected shopping date if confirmed
      if (expectedShoppingDate) {
        updateFields.push(`expected_shopping_date = ?`);
        updateParams.push(expectedShoppingDate);
      }

      updateParams.push(cust.id);

      await pool.query(`
        UPDATE wedding_customers SET ${updateFields.join(', ')} WHERE id = ?
      `, updateParams);

      // 4. Audit Log
      await pool.query(`
        INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
        VALUES (?, ?, ?, 'Call Logged', ?)
      `, [
        cust.id,
        cust.location_id,
        telecallerName,
        `Logged call outcome: ${callOutcome}. Status: ${newCustomerStatus}. ${nextFollowUpDate ? `Next call: ${nextFollowUpDate}` : ''}`
      ]);

      return successRes(res, {
        customerId: cust.id,
        outcome: callOutcome,
        customerStatus: newCustomerStatus,
        nextFollowUpDate
      }, 'Call logged and follow-up updated successfully');
    } catch (err) {
      console.error('[WeddingController.logCall Error]', err);
      return errorRes(res, 'Failed to log call', [err.message], 500);
    }
  }

  // ── 9. Telecaller Calling Desk Queue ─────────────────────────────────
  async getCallingDesk(req, res) {
    try {
      await ensureTables();
      const { clause: locClause, params } = resolveLocFilter(req, 'w');

      // Overall desk counters
      const [counterRows] = await pool.query(`
        SELECT 
          SUM(CASE WHEN w.follow_up_date = CURDATE() AND w.call_status IN ('Pending', 'Call Back Requested', 'No Answer', 'Busy') THEN 1 ELSE 0 END) AS pendingCalls,
          SUM(CASE WHEN w.last_call_date >= CURDATE() THEN 1 ELSE 0 END) AS completedToday,
          SUM(CASE WHEN w.call_status = 'No Answer' AND w.follow_up_date <= CURDATE() THEN 1 ELSE 0 END) AS noAnswerCount,
          SUM(CASE WHEN w.call_status = 'Call Back Requested' THEN 1 ELSE 0 END) AS callbackCount,
          SUM(CASE WHEN w.follow_up_date <= CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed') THEN 1 ELSE 0 END) AS remainingCalls
        FROM wedding_customers w
        WHERE w.is_deleted = 0 ${locClause}
      `, params);

      const baseSelect = `
        SELECT 
          w.*,
          l.location_code,
          l.location_name,
          CASE 
            WHEN w.follow_up_date < CURDATE() THEN DATEDIFF(CURDATE(), w.follow_up_date)
            ELSE 0 
          END AS overdue_days
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE w.is_deleted = 0 ${locClause}
      `;

      // 1. Overdue (< CURDATE() and open)
      const [overdue] = await pool.query(`
        ${baseSelect}
        AND w.follow_up_date < CURDATE() 
        AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
        ORDER BY w.follow_up_date ASC, w.id ASC
        LIMIT 60
      `, params);

      // 2. Due Today (= CURDATE())
      const [dueToday] = await pool.query(`
        ${baseSelect}
        AND w.follow_up_date = CURDATE()
        AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
        ORDER BY 
          CASE WHEN w.call_status = 'Call Back Requested' THEN 0 WHEN w.call_status = 'Pending' THEN 1 ELSE 2 END,
          w.id ASC
        LIMIT 60
      `, params);

      // 3. Callback Requests (any date open)
      const [callbackRequests] = await pool.query(`
        ${baseSelect}
        AND w.call_status = 'Call Back Requested'
        AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
        ORDER BY w.follow_up_date ASC, w.id ASC
        LIMIT 40
      `, params);

      // 4. Upcoming (next 7 days)
      const [upcoming] = await pool.query(`
        ${baseSelect}
        AND w.follow_up_date > CURDATE() AND w.follow_up_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
        ORDER BY w.follow_up_date ASC, w.id ASC
        LIMIT 60
      `, params);

      const sum = counterRows[0] || {};

      // Restore conversation history for the queues before returning (see ENCRYPTED_FIELDS)
      for (const q of [overdue, dueToday, callbackRequests, upcoming]) {
        decryptRows(q, ENCRYPTED_FIELDS);
      }

      return successRes(res, {
        summary: {
          pendingCalls: Number(sum.pendingCalls) || 0,
          completedToday: Number(sum.completedToday) || 0,
          noAnswerCount: Number(sum.noAnswerCount) || 0,
          callbackCount: Number(sum.callbackCount) || 0,
          remainingCalls: Number(sum.remainingCalls) || 0
        },
        counts: {
          overdue: overdue.length,
          due_today: dueToday.length,
          dueToday: dueToday.length,
          callbacks: callbackRequests.length,
          callbackRequests: callbackRequests.length,
          upcoming: upcoming.length,
          pending: Number(sum.pendingCalls) || 0,
          completed: Number(sum.completedToday) || 0,
          no_answer: Number(sum.noAnswerCount) || 0,
          remaining: Number(sum.remainingCalls) || 0
        },
        queues: {
          overdue: overdue || [],
          dueToday: dueToday || [],
          due_today: dueToday || [],
          callbackRequests: callbackRequests || [],
          callbacks: callbackRequests || [],
          upcoming: upcoming || []
        }
      }, 'Calling desk queue loaded successfully');
    } catch (err) {
      console.error('[WeddingController.getCallingDesk Error]', err);
      return errorRes(res, 'Failed to fetch calling desk', [err.message], 500);
    }
  }

  // ── 10. Date-wise Calendar ──────────────────────────────────────────
  async getCalendar(req, res) {
    try {
      const { year, month, date } = req.query;
      const targetYear = parseInt(year, 10) || new Date().getFullYear();
      const targetMonth = parseInt(month, 10) || (new Date().getMonth() + 1);

      const { clause: locClause, params } = resolveLocFilter(req, 'w');

      const [rows] = await pool.query(`
        SELECT 
          w.follow_up_date AS date,
          COUNT(*) AS total,
          SUM(CASE WHEN w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed') THEN 1 ELSE 0 END) AS overdue_count,
          SUM(CASE WHEN w.follow_up_date = CURDATE() THEN 1 ELSE 0 END) AS today_count,
          SUM(CASE WHEN w.customer_status = 'Shopping Date Confirmed' THEN 1 ELSE 0 END) AS shopping_confirmed_count,
          SUM(CASE WHEN w.call_status = 'Completed' THEN 1 ELSE 0 END) AS completed_count
        FROM wedding_customers w
        WHERE w.is_deleted = 0 
          AND YEAR(w.follow_up_date) = ? 
          AND MONTH(w.follow_up_date) = ?
          ${locClause}
        GROUP BY w.follow_up_date
        ORDER BY w.follow_up_date ASC
      `, [targetYear, targetMonth, ...params]);

      // All customers in that month for instant client-side date inspection
      const [allCustomersInMonth] = await pool.query(`
        SELECT 
          w.*,
          l.location_name,
          CASE 
            WHEN w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
            THEN DATEDIFF(CURDATE(), w.follow_up_date)
            ELSE 0 
          END AS overdue_days
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE w.is_deleted = 0 
          AND YEAR(w.follow_up_date) = ? 
          AND MONTH(w.follow_up_date) = ?
          ${locClause}
        ORDER BY w.follow_up_date ASC, w.id DESC
      `, [targetYear, targetMonth, ...params]);

      decryptRows(allCustomersInMonth, ENCRYPTED_FIELDS);

      return successRes(res, {
        year: targetYear,
        month: targetMonth,
        days: rows || [],
        customers: allCustomersInMonth || []
      }, 'Calendar follow-up data fetched successfully');
    } catch (err) {
      console.error('[WeddingController.getCalendar Error]', err);
      return errorRes(res, 'Failed to fetch calendar data', [err.message], 500);
    }
  }

  // ── 11. Analytics & Conversion Funnel ───────────────────────────────
  async getAnalytics(req, res) {
    try {
      const { clause: locClause, params } = resolveLocFilter(req, 'w');

      // 1. Conversion Funnel
      const [funnelRows] = await pool.query(`
        SELECT 
          COUNT(*) AS total_customers,
          SUM(CASE WHEN w.call_status IN ('Connected', 'Completed') OR w.total_calls_count > 0 THEN 1 ELSE 0 END) AS contacted,
          SUM(CASE WHEN w.customer_status IN ('Interested', 'Shopping Date Confirmed', 'Visited Store', 'Converted') THEN 1 ELSE 0 END) AS interested,
          SUM(CASE WHEN w.customer_status IN ('Shopping Date Confirmed', 'Visited Store', 'Converted') THEN 1 ELSE 0 END) AS shopping_confirmed,
          SUM(CASE WHEN w.customer_status IN ('Visited Store', 'Converted') THEN 1 ELSE 0 END) AS visited,
          SUM(CASE WHEN w.customer_status = 'Converted' THEN 1 ELSE 0 END) AS converted
        FROM wedding_customers w
        WHERE w.is_deleted = 0 ${locClause}
      `, params);

      // 2. Call outcomes breakdown
      const [outcomes] = await pool.query(`
        SELECT 
          COALESCE(w.last_call_outcome, 'No Calls Yet') AS outcome,
          COUNT(*) AS count
        FROM wedding_customers w
        WHERE w.is_deleted = 0 ${locClause}
        GROUP BY w.last_call_outcome
      `, params);

      // 3. Telecaller Performance Table
      const [telecallers] = await pool.query(`
        SELECT 
          COALESCE(w.assigned_telecaller, 'Unassigned') AS telecaller,
          COUNT(w.id) AS assigned_customers,
          SUM(CASE WHEN w.call_status = 'Completed' THEN 1 ELSE 0 END) AS calls_completed,
          SUM(CASE WHEN w.call_status = 'Connected' THEN 1 ELSE 0 END) AS connected,
          SUM(CASE WHEN w.call_status = 'No Answer' THEN 1 ELSE 0 END) AS no_answer,
          SUM(CASE WHEN w.call_status = 'Call Back Requested' THEN 1 ELSE 0 END) AS callbacks,
          SUM(CASE WHEN w.customer_status = 'Interested' THEN 1 ELSE 0 END) AS interested,
          SUM(CASE WHEN w.customer_status = 'Shopping Date Confirmed' THEN 1 ELSE 0 END) AS shopping_confirmed,
          SUM(CASE WHEN w.customer_status = 'Converted' THEN 1 ELSE 0 END) AS conversions,
          SUM(CASE WHEN w.follow_up_date <= CURDATE() AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed') THEN 1 ELSE 0 END) AS pending_followups
        FROM wedding_customers w
        WHERE w.is_deleted = 0 ${locClause}
        GROUP BY w.assigned_telecaller
        ORDER BY assigned_customers DESC
      `, params);

      return successRes(res, {
        funnel: funnelRows[0] || {},
        outcomes: outcomes || [],
        telecallers: telecallers || []
      }, 'Wedding analytics fetched successfully');
    } catch (err) {
      console.error('[WeddingController.getAnalytics Error]', err);
      return errorRes(res, 'Failed to fetch wedding analytics', [err.message], 500);
    }
  }

  // ── 12. List Telecallers for Assignment ─────────────────────────────
  async getTelecallers(req, res) {
    try {
      const userLoc = req.user ? req.user.locationId : null;
      // Global admins may narrow the dropdown to one branch via ?location_id
      let locFilter = null;
      if (!userLoc) {
        const requested = req.query.location_id || req.query.locationId;
        if (requested && requested !== 'all' && !isNaN(parseInt(requested, 10))) {
          locFilter = parseInt(requested, 10);
        }
      } else {
        locFilter = userLoc;
      }

      let sql = `
        SELECT id, username, full_name, role, location_id
        FROM users
        WHERE active = TRUE
      `;
      const params = [];

      if (locFilter) {
        // Branch context: own-branch staff plus global (location-less) accounts
        sql += ` AND (location_id = ? OR location_id IS NULL)`;
        params.push(locFilter);
      }

      sql += ` ORDER BY full_name ASC`;

      const [users] = await pool.query(sql, params);
      return successRes(res, { telecallers: users || [] }, 'Telecallers fetched successfully');
    } catch (err) {
      console.error('[WeddingController.getTelecallers Error]', err);
      return errorRes(res, 'Failed to fetch telecallers', [err.message], 500);
    }
  }


  // ── 14. Bulk CSV Import (strict validation — only related rows enter) ──
  async importCsv(req, res) {
    try {
      await ensureTables();
      if (!req.file || !req.file.buffer) {
        return errorRes(res, 'No CSV file uploaded. Attach the file in the "file" field.', [], 400);
      }

      // Location: branch users import into their own branch; global admins
      // may target one via ?location_id.
      let locationId = req.user ? req.user.locationId : null;
      if (!locationId) {
        const requested = req.query.location_id || req.body.location_id;
        locationId = requested && !isNaN(parseInt(requested, 10)) ? parseInt(requested, 10) : 2;
      }
      const [locRows] = await pool.query(`SELECT location_code FROM locations WHERE id = ?`, [locationId]);
      const locCode = locRows[0]?.location_code || 'BSC';

      const text = req.file.buffer.toString('utf8');
      const objects = rowsToObjects(parseCsv(text));
      if (objects.length === 0) {
        return errorRes(res, 'The CSV file has no data rows (a header row is required).', [], 400);
      }

      // ── Header mapping: accept the common column spellings ─────────────
      const pick = (obj, keys) => {
        for (const k of keys) {
          if (obj[k] !== undefined && obj[k] !== '') return obj[k];
        }
        return null;
      };

      // Date parsing: accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
      const parseDate = (raw) => {
        if (!raw) return null;
        const v = String(raw).trim();
        let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
        m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        const d = new Date(v);
        if (!isNaN(d.getTime())) {
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        return null;
      };

      // Mobile normalisation: strip +91 / 91 prefix and separators, keep 10 digits
      const normalizeMobile = (raw) => {
        if (!raw) return null;
        let digits = String(raw).replace(/\D/g, '');
        if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
        if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
        if (digits.length !== 10 || !/^[6-9]/.test(digits)) return null;
        return digits;
      };

      const [yearRows] = await pool.query(
        `SELECT customer_code FROM wedding_customers WHERE customer_code LIKE ? ORDER BY id DESC LIMIT 1`,
        [`WED-${locCode}-${new Date().getFullYear()}-%`]
      );
      let seq = yearRows[0]
        ? parseInt(String(yearRows[0].customer_code).slice(-4), 10) || 0
        : 0;

      const inserted = [];
      const errors = [];
      let imported = 0;

      for (let idx = 0; idx < objects.length; idx++) {
        const row = objects[idx];
        const rowNo = idx + 2; // header offset
        const customerName = pick(row, ['customer_name', 'name', 'customer', 'bride_groom_name']);
        const mobile = normalizeMobile(pick(row, ['mobile_number', 'mobile', 'phone', 'contact', 'phone_number']));
        const emailRaw = pick(row, ['email', 'email_id', 'mail']);
        const email = emailRaw && /@/.test(emailRaw) ? emailRaw : null;
        const weddingDate = parseDate(pick(row, ['wedding_date', 'marriage_date', 'weddingdate']));
        const shoppingDate = parseDate(pick(row, ['expected_shopping_date', 'shopping_date', 'expectedshoppingdate']));
        const followUp = parseDate(pick(row, ['follow_up_date', 'followup_date', 'next_follow_up', 'follow_up'])) ||
          new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const category = pick(row, ['preferred_shopping_category', 'category', 'shopping_category']) || 'General Wedding Shopping';
        const familyRaw = parseInt(pick(row, ['estimated_family_size', 'family_size', 'members']) || '1', 10);
        const familySize = !isNaN(familyRaw) && familyRaw > 0 && familyRaw < 100 ? familyRaw : 1;
        const notes = pick(row, ['customer_notes', 'notes', 'remarks', 'comments']);
        const telecaller = pick(row, ['assigned_telecaller', 'telecaller', 'assigned_to']);

        // ── Strict validation: only fully-related rows enter the CRM ──────
        if (!customerName) {
          errors.push({ row: rowNo, reason: 'Missing customer name — row skipped' });
          continue;
        }
        if (!mobile) {
          errors.push({ row: rowNo, reason: `Invalid/missing mobile number for "${customerName}" — row skipped` });
          continue;
        }
        if (!shoppingDate) {
          errors.push({ row: rowNo, reason: `Missing or unparseable expected shopping date for "${customerName}" — row skipped` });
          continue;
        }
        if (shoppingDate > '2100-01-01' || shoppingDate < '2000-01-01') {
          errors.push({ row: rowNo, reason: `Shopping date out of range for "${customerName}" — row skipped` });
          continue;
        }

        // Duplicate check within this location
        const [dup] = await pool.query(
          `SELECT customer_code FROM wedding_customers WHERE mobile_number = ? AND location_id = ? AND is_deleted = 0`,
          [mobile, locationId]
        );
        if (dup && dup.length > 0) {
          errors.push({ row: rowNo, reason: `Mobile ${mobile} already exists (${dup[0].customer_code}) — row skipped` });
          continue;
        }

        seq += 1;
        const customerCode = `WED-${locCode}-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;
        try {
          await pool.query(
            `INSERT INTO wedding_customers (
              customer_code, location_id, customer_name, mobile_number, email,
              wedding_date, expected_shopping_date, preferred_shopping_category,
              estimated_family_size, assigned_telecaller, follow_up_date,
              customer_notes, customer_status, call_status, created_by, created_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 'Pending', ?, ?)`,
            [
              customerCode, locationId, String(customerName).substring(0, 150), mobile, email,
              weddingDate, shoppingDate, String(category).substring(0, 150),
              familySize, telecaller ? String(telecaller).substring(0, 150) : null, followUp,
              encryptField(notes), req.user?.fullName || 'CSV Import', req.user?.id || null
            ]
          );
          imported++;
          inserted.push(customerCode);
        } catch (rowErr) {
          errors.push({ row: rowNo, reason: `DB insert failed for "${customerName}": ${rowErr.message}` });
        }
      }

      await pool.query(
        `INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
         VALUES (NULL, ?, ?, 'CSV Import', ?)`,
        [locationId, req.user?.fullName || 'CSV Import', `Imported ${imported} rows from ${req.file.originalname}; ${errors.length} skipped`]
      );

      return successRes(res, {
        imported,
        skipped: errors.length,
        totalRows: objects.length,
        insertedCodes: inserted,
        errors
      }, `CSV import complete: ${imported} added, ${errors.length} skipped`);
    } catch (err) {
      console.error('[WeddingController.importCsv Error]', err);
      return errorRes(res, 'Failed to import CSV', [err.message], 500);
    }
  }

  // ── 13. Export Data Engine ──────────────────────────────────────────
  async exportData(req, res) {
    try {
      const { clause: locClause, params } = resolveLocFilter(req, 'w');

      const [rows] = await pool.query(`
        SELECT 
          w.customer_code AS 'Customer ID',
          w.customer_name AS 'Customer Name',
          w.mobile_number AS 'Mobile Number',
          COALESCE(w.email, '-') AS 'Email',
          l.location_name AS 'Location',
          COALESCE(DATE_FORMAT(w.wedding_date, '%d/%m/%Y'), '-') AS 'Wedding Date',
          DATE_FORMAT(w.expected_shopping_date, '%d/%m/%Y') AS 'Expected Shopping Date',
          w.preferred_shopping_category AS 'Shopping Category',
          w.estimated_family_size AS 'Family Size',
          COALESCE(w.assigned_telecaller, 'Unassigned') AS 'Assigned Telecaller',
          DATE_FORMAT(w.follow_up_date, '%d/%m/%Y') AS 'Next Follow-up Date',
          w.preferred_call_time AS 'Preferred Call Time',
          w.customer_status AS 'Customer Status',
          w.call_status AS 'Call Status',
          w.total_calls_count AS 'Total Calls',
          COALESCE(DATE_FORMAT(w.last_call_date, '%d/%m/%Y %H:%i'), '-') AS 'Last Call Date',
          COALESCE(w.last_call_outcome, '-') AS 'Last Call Result',
          COALESCE(w.customer_notes, '-') AS 'Remarks',
          DATE_FORMAT(w.created_at, '%d/%m/%Y') AS 'Added On'
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE w.is_deleted = 0 ${locClause}
        ORDER BY w.follow_up_date ASC, w.id DESC
      `, params);

      decryptRows(rows, ENCRYPTED_FIELDS);

      return successRes(res, {
        records: rows || [],
        customers: rows || [],
        total: rows.length,
        exportedAt: new Date().toISOString()
      }, 'Export data generated successfully');
    } catch (err) {
      console.error('[WeddingController.exportData Error]', err);
      return errorRes(res, 'Failed to export data', [err.message], 500);
    }
  }
}

module.exports = new WeddingController();
