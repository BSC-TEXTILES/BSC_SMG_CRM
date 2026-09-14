const pool = require('../config/db');
const { successRes, errorRes } = require('../utils/response');
const { getLocationFilter, injectLocationId } = require('../middleware/auth');

/**
 * Helper to build location filter dynamically.
 * If user is Global Admin and query.locationId is passed, filters by that location.
 * Otherwise uses standard getLocationFilter based on user's assigned branch.
 */
function resolveLocFilter(req, tableAlias = 'w') {
  const col = tableAlias ? `${tableAlias}.location_id` : 'location_id';
  const userLoc = req.user ? req.user.locationId : null;
  const isGlobal = !userLoc;

  if (isGlobal) {
    if (req.query.locationId && req.query.locationId !== 'all' && !isNaN(parseInt(req.query.locationId, 10))) {
      return {
        clause: `AND ${col} = ?`,
        params: [parseInt(req.query.locationId, 10)]
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

class WeddingController {
  // ── 1. Dashboard KPI Stats ──────────────────────────────────────────
  async getDashboardStats(req, res) {
    try {
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
        stats: rows[0] || {},
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
      const {
        dateView = 'all',
        customerStatus,
        callStatus,
        telecaller,
        search,
        startDate,
        endDate,
        page = 1,
        limit = 25
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
        whereClauses.push(`w.assigned_telecaller = ?`);
        queryParams.push(telecaller);
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

      // Pagination
      const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
      const limitNum = parseInt(limit, 10);

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

      return successRes(res, {
        customers: customers || [],
        pagination: {
          total,
          page: parseInt(page, 10),
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
      const { mobile, customerId } = req.body;
      if (!mobile) {
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
          customer: rows[0]
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
      const {
        customer_name,
        mobile_number,
        email,
        wedding_date,
        expected_shopping_date,
        preferred_shopping_category,
        estimated_family_size = 1,
        assigned_telecaller,
        assigned_telecaller_id,
        follow_up_date,
        preferred_call_time,
        customer_notes,
        location_id: requestedLocationId
      } = req.body;

      if (!customer_name || !customer_name.trim()) {
        return errorRes(res, 'Customer name is required', [], 400);
      }
      if (!mobile_number || !mobile_number.trim()) {
        return errorRes(res, 'Mobile number is required', [], 400);
      }
      if (!expected_shopping_date) {
        return errorRes(res, 'Expected shopping date is required', [], 400);
      }
      if (!follow_up_date) {
        return errorRes(res, 'Follow-up date is required', [], 400);
      }

      // Enforce location security
      let locationId = req.user ? req.user.locationId : null;
      if (!locationId) {
        // Global admin can choose location
        locationId = requestedLocationId ? parseInt(requestedLocationId, 10) : 2;
      }

      // Fetch location code for code generation
      const [locRows] = await pool.query(`SELECT location_code FROM locations WHERE id = ?`, [locationId]);
      const locCode = locRows[0]?.location_code || 'BSC';

      // Check duplicate mobile
      const [dup] = await pool.query(`
        SELECT id, customer_code, customer_name FROM wedding_customers 
        WHERE mobile_number = ? AND location_id = ? AND is_deleted = 0
      `, [mobile_number.trim(), locationId]);

      if (dup && dup.length > 0) {
        return errorRes(res, `Customer with mobile ${mobile_number} already exists (${dup[0].customer_name} - ${dup[0].customer_code})`, [], 409);
      }

      // Generate sequence code: WED-[LOC]-[YEAR]-[SEQ]
      const year = new Date().getFullYear();
      const [countRows] = await pool.query(`
        SELECT COUNT(*) as count FROM wedding_customers WHERE location_id = ? AND YEAR(created_at) = ?
      `, [locationId, year]);
      const seq = String((countRows[0]?.count || 0) + 1).padStart(4, '0');
      const customerCode = `WED-${locCode}-${year}-${seq}`;

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
        customer_name.trim(),
        mobile_number.trim(),
        email ? email.trim() : null,
        wedding_date || null,
        expected_shopping_date,
        preferred_shopping_category || 'General Wedding Shopping',
        parseInt(estimated_family_size, 10) || 1,
        assigned_telecaller ? assigned_telecaller.trim() : (req.user?.fullName || 'Unassigned'),
        assigned_telecaller_id ? parseInt(assigned_telecaller_id, 10) : (req.user?.id || null),
        follow_up_date,
        preferred_call_time || 'Morning (10 AM - 1 PM)',
        customer_notes || null,
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
        `Created wedding customer ${customer_name.trim()} (${customerCode}). Expected shopping: ${expected_shopping_date}, Follow-up: ${follow_up_date}`
      ]);

      return successRes(res, {
        id: newId,
        customer_code: customerCode
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

      // Call logs timeline
      const [callLogs] = await pool.query(`
        SELECT * FROM wedding_call_logs 
        WHERE customer_id = ? 
        ORDER BY call_date DESC, id DESC
      `, [id]);

      // Audit trail
      const [auditLogs] = await pool.query(`
        SELECT * FROM wedding_audit_logs 
        WHERE customer_id = ? 
        ORDER BY created_at DESC
      `, [id]);

      return successRes(res, {
        customer,
        callLogs: callLogs || [],
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
      const {
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
        call_status
      } = req.body;

      // Duplicate check if mobile is being changed
      if (mobile_number && mobile_number.trim() !== prev.mobile_number) {
        const [dup] = await pool.query(`
          SELECT id FROM wedding_customers 
          WHERE mobile_number = ? AND location_id = ? AND id != ? AND is_deleted = 0
        `, [mobile_number.trim(), prev.location_id, id]);

        if (dup && dup.length > 0) {
          return errorRes(res, `Another customer already exists with mobile ${mobile_number}`, [], 409);
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
        customer_name ? customer_name.trim() : prev.customer_name,
        mobile_number ? mobile_number.trim() : prev.mobile_number,
        email !== undefined ? (email ? email.trim() : null) : prev.email,
        wedding_date !== undefined ? wedding_date : prev.wedding_date,
        expected_shopping_date || prev.expected_shopping_date,
        preferred_shopping_category || prev.preferred_shopping_category,
        estimated_family_size ? parseInt(estimated_family_size, 10) : prev.estimated_family_size,
        assigned_telecaller || prev.assigned_telecaller,
        assigned_telecaller_id ? parseInt(assigned_telecaller_id, 10) : prev.assigned_telecaller_id,
        follow_up_date || prev.follow_up_date,
        preferred_call_time || prev.preferred_call_time,
        customer_notes !== undefined ? customer_notes : prev.customer_notes,
        customer_status || prev.customer_status,
        call_status || prev.call_status,
        id
      ]);

      // Audit log
      const changes = [];
      if (customer_status && customer_status !== prev.customer_status) changes.push(`Status: ${prev.customer_status} → ${customer_status}`);
      if (follow_up_date && follow_up_date !== prev.follow_up_date) changes.push(`Follow-up: ${prev.follow_up_date} → ${follow_up_date}`);
      if (assigned_telecaller && assigned_telecaller !== prev.assigned_telecaller) changes.push(`Telecaller: ${prev.assigned_telecaller} → ${assigned_telecaller}`);
      if (expected_shopping_date && expected_shopping_date !== prev.expected_shopping_date) changes.push(`Shopping Date: ${prev.expected_shopping_date} → ${expected_shopping_date}`);

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
      const {
        customerId,
        callDate,
        callTime,
        callStatus = 'Completed',
        callOutcome,
        remarks,
        nextFollowUpDate,
        nextFollowUpTime,
        expectedShoppingDate
      } = req.body;

      if (!customerId) {
        return errorRes(res, 'Customer ID is required', [], 400);
      }
      if (!callOutcome) {
        return errorRes(res, 'Call outcome is required', [], 400);
      }

      const { clause: locClause, params } = resolveLocFilter(req, 'w');
      const [customers] = await pool.query(`
        SELECT * FROM wedding_customers w WHERE w.id = ? AND w.is_deleted = 0 ${locClause}
      `, [parseInt(customerId, 10), ...params]);

      if (!customers || customers.length === 0) {
        return errorRes(res, 'Customer not found or access denied', [], 404);
      }

      const cust = customers[0];
      const today = new Date().toISOString().split('T')[0];
      const actualCallDate = callDate || today;
      const actualCallTime = callTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
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
        remarks || null,
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
        `Logged call outcome: ${callOutcome}. Status updated to ${newCustomerStatus}. ${nextFollowUpDate ? `Next call: ${nextFollowUpDate}` : ''}`
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

      // Prioritized Queue:
      // 1. Overdue (< CURDATE() and open)
      // 2. Due Today (= CURDATE())
      // 3. Callback Requests (any date open)
      // 4. Upcoming (next 3 days)
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

      // 1. Overdue
      const [overdue] = await pool.query(`
        ${baseSelect}
        AND w.follow_up_date < CURDATE() 
        AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
        ORDER BY w.follow_up_date ASC, w.id ASC
        LIMIT 50
      `, params);

      // 2. Due Today
      const [dueToday] = await pool.query(`
        ${baseSelect}
        AND w.follow_up_date = CURDATE()
        AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
        ORDER BY 
          CASE WHEN w.call_status = 'Call Back Requested' THEN 0 WHEN w.call_status = 'Pending' THEN 1 ELSE 2 END,
          w.id ASC
        LIMIT 50
      `, params);

      // 3. Callback Requests
      const [callbackRequests] = await pool.query(`
        ${baseSelect}
        AND w.call_status = 'Call Back Requested'
        AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
        ORDER BY w.follow_up_date ASC, w.id ASC
        LIMIT 30
      `, params);

      // 4. Upcoming (next 7 days)
      const [upcoming] = await pool.query(`
        ${baseSelect}
        AND w.follow_up_date > CURDATE() AND w.follow_up_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        AND w.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
        ORDER BY w.follow_up_date ASC, w.id ASC
        LIMIT 50
      `, params);

      return successRes(res, {
        summary: counterRows[0] || {},
        queues: {
          overdue: overdue || [],
          dueToday: dueToday || [],
          callbackRequests: callbackRequests || [],
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
      const { year, month } = req.query;
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

      return successRes(res, {
        year: targetYear,
        month: targetMonth,
        days: rows || []
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
      let sql = `
        SELECT id, username, full_name, role, location_id 
        FROM users 
        WHERE active = TRUE
      `;
      const params = [];

      if (userLoc) {
        sql += ` AND (location_id = ? OR location_id IS NULL)`;
        params.push(userLoc);
      }

      sql += ` ORDER BY full_name ASC`;

      const [users] = await pool.query(sql, params);
      return successRes(res, { telecallers: users || [] }, 'Telecallers fetched successfully');
    } catch (err) {
      console.error('[WeddingController.getTelecallers Error]', err);
      return errorRes(res, 'Failed to fetch telecallers', [err.message], 500);
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
          COALESCE(w.customer_notes, '-') AS 'Notes',
          DATE_FORMAT(w.created_at, '%d/%m/%Y') AS 'Added On'
        FROM wedding_customers w
        LEFT JOIN locations l ON l.id = w.location_id
        WHERE w.is_deleted = 0 ${locClause}
        ORDER BY w.follow_up_date ASC, w.id DESC
      `, params);

      return successRes(res, {
        records: rows || [],
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
