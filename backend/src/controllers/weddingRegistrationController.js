const pool = require('../config/db');
const { successRes, errorRes } = require('../utils/response');
const { getLocationFilter, injectLocationId } = require('../middleware/auth');
const { encryptField, decryptRows, decryptRow } = require('../utils/crypto');
const { sendWeddingRegistrationConfirmation } = require('../config/email');

const ENCRYPTED_FIELDS = ['additional_notes', 'remarks'];

let tablesChecked = false;
async function ensureTables() {
  if (tablesChecked) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`wedding_registrations\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`registration_id\` VARCHAR(50) NOT NULL UNIQUE,
        \`location_id\` INT NOT NULL DEFAULT 2,
        \`location_code\` VARCHAR(10) NOT NULL DEFAULT 'DAV',
        \`store_name\` VARCHAR(100) NOT NULL,
        \`store_address\` TEXT NULL,
        \`store_phone\` VARCHAR(20) NULL,
        \`customer_name\` VARCHAR(150) NOT NULL,
        \`mobile\` VARCHAR(20) NOT NULL,
        \`alternate_mobile\` VARCHAR(20) NULL,
        \`email\` VARCHAR(150) NULL,
        \`gender\` VARCHAR(20) NULL,
        \`age\` INT NULL,
        \`address\` TEXT NULL,
        \`area\` VARCHAR(150) NULL,
        \`city\` VARCHAR(100) NULL,
        \`pincode\` VARCHAR(10) NULL,
        \`wedding_date\` DATE NULL,
        \`wedding_date_flexibility\` VARCHAR(50) NULL,
        \`wedding_venue\` VARCHAR(255) NULL,
        \`wedding_city\` VARCHAR(100) NULL,
        \`wedding_type\` VARCHAR(50) NULL,
        \`wedding_functions\` JSON NULL,
        \`guest_count\` INT NULL,
        \`family_size\` INT NULL,
        \`bride_name\` VARCHAR(150) NULL,
        \`bride_age\` INT NULL,
        \`bride_contact\` VARCHAR(20) NULL,
        \`bride_shopping_required\` BOOLEAN DEFAULT TRUE,
        \`groom_name\` VARCHAR(150) NULL,
        \`groom_age\` INT NULL,
        \`groom_contact\` VARCHAR(20) NULL,
        \`groom_shopping_required\` BOOLEAN DEFAULT TRUE,
        \`shopping_requirements\` JSON NULL,
        \`budget_range\` VARCHAR(50) NULL,
        \`preferred_shopping_date\` DATE NULL,
        \`preferred_shopping_time\` VARCHAR(50) NULL,
        \`expected_visitors\` INT NULL,
        \`existing_customer\` VARCHAR(20) NULL,
        \`existing_customer_id\` VARCHAR(50) NULL,
        \`previous_store\` VARCHAR(50) NULL,
        \`preferred_contact_method\` VARCHAR(50) NULL,
        \`preferred_followup_time\` VARCHAR(50) NULL,
        \`additional_notes\` TEXT NULL,
        \`consent\` BOOLEAN DEFAULT FALSE,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'New',
        \`lead_source\` VARCHAR(50) DEFAULT 'Walk-in',
        \`assigned_employee\` VARCHAR(150) NULL,
        \`next_followup\` DATE NULL,
        \`call_result\` VARCHAR(100) NULL,
        \`remarks\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_wed_reg_loc\` (\`location_id\`),
        INDEX \`idx_wed_reg_mobile\` (\`mobile\`),
        INDEX \`idx_wed_reg_status\` (\`status\`),
        INDEX \`idx_wed_reg_wedding_date\` (\`wedding_date\`),
        INDEX \`idx_wed_reg_created\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    tablesChecked = true;
  } catch (err) {
    console.error('[WeddingRegistrationController.ensureTables Error]', err.message);
  }
}

class WeddingRegistrationController {
  async getDashboardStats(req, res) {
    try {
      await ensureTables();
      const { clause, params } = getLocationFilter(req, 'wr');

      const [rows] = await pool.query(`
        SELECT
          COUNT(*) AS totalRegistrations,
          SUM(CASE WHEN DATE(wr.created_at) = CURDATE() THEN 1 ELSE 0 END) AS todayRegistrations,
          SUM(CASE WHEN wr.location_id = 1 THEN 1 ELSE 0 END) AS belagaviRegistrations,
          SUM(CASE WHEN wr.location_id = 2 THEN 1 ELSE 0 END) AS davanagereRegistrations,
          SUM(CASE WHEN wr.location_id = 3 THEN 1 ELSE 0 END) AS shivamoggaRegistrations,
          SUM(CASE WHEN wr.wedding_date >= CURDATE() AND wr.wedding_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS upcomingWeddings,
          SUM(CASE WHEN wr.status = 'New' AND (wr.next_followup IS NULL OR wr.next_followup <= CURDATE()) THEN 1 ELSE 0 END) AS pendingFollowups,
          SUM(CASE WHEN wr.status IN ('Contacted', 'Interested', 'Follow-up Pending') THEN 1 ELSE 0 END) AS visitedCustomers,
          SUM(CASE WHEN wr.status = 'Shopping Confirmed' THEN 1 ELSE 0 END) AS shoppingConfirmed,
          SUM(CASE WHEN wr.status = 'Converted' THEN 1 ELSE 0 END) AS convertedCustomers
        FROM wedding_registrations wr
        WHERE wr.status != 'Deleted' ${clause}
      `, params);

      const raw = rows[0] || {};
      const stats = {
        totalRegistrations: Number(raw.totalRegistrations) || 0,
        todayRegistrations: Number(raw.todayRegistrations) || 0,
        belagaviRegistrations: Number(raw.belagaviRegistrations) || 0,
        davanagereRegistrations: Number(raw.davanagereRegistrations) || 0,
        shivamoggaRegistrations: Number(raw.shivamoggaRegistrations) || 0,
        upcomingWeddings: Number(raw.upcomingWeddings) || 0,
        pendingFollowups: Number(raw.pendingFollowups) || 0,
        visitedCustomers: Number(raw.visitedCustomers) || 0,
        shoppingConfirmed: Number(raw.shoppingConfirmed) || 0,
        convertedCustomers: Number(raw.convertedCustomers) || 0
      };

      return successRes(res, { stats }, 'Dashboard stats fetched successfully');
    } catch (err) {
      console.error('[WeddingRegistrationController.getDashboardStats Error]', err);
      return errorRes(res, 'Failed to fetch wedding registration stats', [err.message], 500);
    }
  }

  async getRegistrations(req, res) {
    try {
      await ensureTables();
      const {
        status,
        locationId,
        search,
        fromDate,
        toDate,
        page = 1,
        limit = 50
      } = req.query;

      const { clause: locClause, params: queryParams } = getLocationFilter(req, 'wr');
      let whereClauses = ['wr.status != \'Deleted\'', `1=1 ${locClause}`];

      if (status && status !== 'all') {
        whereClauses.push(`wr.status = ?`);
        queryParams.push(status);
      }

      if (locationId && locationId !== 'all') {
        whereClauses.push(`wr.location_id = ?`);
        queryParams.push(parseInt(locationId, 10));
      }

      if (search && search.trim()) {
        const q = `%${search.trim().toLowerCase()}%`;
        whereClauses.push(`(
          LOWER(wr.customer_name) LIKE ? OR
          wr.mobile LIKE ? OR
          LOWER(wr.registration_id) LIKE ? OR
          LOWER(COALESCE(wr.email, '')) LIKE ?
        )`);
        queryParams.push(q, q, q, q);
      }

      if (fromDate && toDate) {
        whereClauses.push(`DATE(wr.created_at) BETWEEN ? AND ?`);
        queryParams.push(fromDate, toDate);
      }

      const whereSql = whereClauses.join(' AND ');

      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total FROM wedding_registrations wr WHERE ${whereSql}`,
        queryParams
      );
      const total = countResult[0]?.total || 0;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 50));
      const offset = (pageNum - 1) * limitNum;

      const [registrations] = await pool.query(`
        SELECT 
          wr.*,
          l.location_code,
          l.location_name
        FROM wedding_registrations wr
        LEFT JOIN locations l ON l.id = wr.location_id
        WHERE ${whereSql}
        ORDER BY wr.created_at DESC
        LIMIT ? OFFSET ?
      `, [...queryParams, limitNum, offset]);

      decryptRows(registrations, ENCRYPTED_FIELDS);

      // Parse JSON fields
      registrations.forEach(reg => {
        if (reg.wedding_functions && typeof reg.wedding_functions === 'string') {
          try { reg.wedding_functions = JSON.parse(reg.wedding_functions); } catch {}
        }
        if (reg.shopping_requirements && typeof reg.shopping_requirements === 'string') {
          try { reg.shopping_requirements = JSON.parse(reg.shopping_requirements); } catch {}
        }
      });

      return successRes(res, {
        registrations: registrations || [],
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      }, 'Registrations fetched successfully');
    } catch (err) {
      console.error('[WeddingRegistrationController.getRegistrations Error]', err);
      return errorRes(res, 'Failed to fetch wedding registrations', [err.message], 500);
    }
  }

  async checkDuplicate(req, res) {
    try {
      const mobile = req.body.mobile || req.body.phone || req.body.mobile_number;
      const registrationId = req.body.registrationId || req.body.registration_id;

      if (!mobile || !mobile.trim()) {
        return errorRes(res, 'Mobile number is required', [], 400);
      }

      const cleanMobile = mobile.trim().replace(/\D/g, '');
      const normalizedMobile = cleanMobile.length === 10 ? `+91${cleanMobile}` : cleanMobile;
      const { clause: locClause, params } = getLocationFilter(req, 'wr');

      let sql = `
        SELECT wr.id, wr.registration_id, wr.customer_name, wr.mobile, wr.status, wr.location_id, l.location_name
        FROM wedding_registrations wr
        LEFT JOIN locations l ON l.id = wr.location_id
        WHERE wr.mobile = ? AND wr.status != 'Deleted' ${locClause}
      `;
      const queryParams = [normalizedMobile, ...params];

      if (registrationId) {
        sql += ` AND wr.id != ?`;
        queryParams.push(parseInt(registrationId, 10));
      }

      const [rows] = await pool.query(sql, queryParams);

      if (rows && rows.length > 0) {
        return successRes(res, {
          exists: true,
          registration: rows[0],
          existingRegistration: rows[0]
        }, 'Duplicate registration found with this mobile number');
      }

      return successRes(res, { exists: false }, 'Mobile number is unique');
    } catch (err) {
      console.error('[WeddingRegistrationController.checkDuplicate Error]', err);
      return errorRes(res, 'Failed to check duplicate', [err.message], 500);
    }
  }

  async getNextRegistrationId(req, res) {
    try {
      const locationId = req.query.location_id || req.query.locationId || 2;
      const [locRows] = await pool.query(`SELECT location_code FROM locations WHERE id = ?`, [locationId]);
      const locCode = locRows[0]?.location_code || 'BSC';
      const year = new Date().getFullYear();
      const codePrefix = `BSC-WED-${locCode}-${year}-`;

      let registrationId = null;
      for (let attempt = 0; attempt < 5 && !registrationId; attempt++) {
        const [lastRows] = await pool.query(
          `SELECT registration_id FROM wedding_registrations WHERE registration_id LIKE ? ORDER BY id DESC LIMIT 1`,
          [`${codePrefix}%`]
        );
        const lastSeq = lastRows && lastRows[0]
          ? parseInt(String(lastRows[0].registration_id).slice(-6), 10) || 0
          : 0;
        const candidate = `${codePrefix}${String(lastSeq + 1).padStart(6, '0')}`;
        const [exists] = await pool.query(
          `SELECT id FROM wedding_registrations WHERE registration_id = ?`,
          [candidate]
        );
        if (!exists || exists.length === 0) {
          registrationId = candidate;
        }
      }

      if (!registrationId) {
        return errorRes(res, 'Could not allocate a unique registration ID, please retry', [], 500);
      }

      return successRes(res, { registrationId }, 'Registration ID generated');
    } catch (err) {
      console.error('[WeddingRegistrationController.getNextRegistrationId Error]', err);
      return errorRes(res, 'Failed to generate registration ID', [err.message], 500);
    }
  }

  async createRegistration(req, res) {
    try {
      const data = req.body.data || req.body;
      
      // Validate required fields
      const requiredFields = [
        'customer_name', 'mobile', 'location_id', 'wedding_date',
        'preferred_shopping_date', 'consent'
      ];
      
      for (const field of requiredFields) {
        if (!data[field] && data[field] !== false) {
          return errorRes(res, `${field} is required`, [], 400);
        }
      }

      // Normalize phone
      let mobile = data.mobile;
      if (mobile) {
        const digits = mobile.replace(/\D/g, '');
        if (digits.length === 10) mobile = `+91${digits}`;
        else if (digits.length === 12 && digits.startsWith('91')) mobile = `+${digits}`;
        else if (digits.length === 11 && digits.startsWith('0')) mobile = `+91${digits.slice(1)}`;
      }

      let alternateMobile = data.alternate_mobile;
      if (alternateMobile) {
        const digits = alternateMobile.replace(/\D/g, '');
        if (digits.length === 10) alternateMobile = `+91${digits}`;
      }

      // Location enforcement
      let locationId = req.user ? req.user.locationId : null;
      if (!locationId) {
        locationId = data.location_id ? parseInt(data.location_id, 10) : 2;
      }

      // Get location details
      const [locRows] = await pool.query(
        `SELECT id, location_code, location_name, address, phone FROM locations WHERE id = ?`,
        [locationId]
      );
      if (!locRows || locRows.length === 0) {
        return errorRes(res, 'Invalid location selected', [], 400);
      }
      const location = locRows[0];

      // Duplicate check
      const [dup] = await pool.query(`
        SELECT id, registration_id, customer_name FROM wedding_registrations 
        WHERE mobile = ? AND location_id = ? AND status != 'Deleted'
      `, [mobile, locationId]);

      if (dup && dup.length > 0) {
        return errorRes(res, `A wedding registration with this mobile number already exists (${dup[0].customer_name} - ${dup[0].registration_id}). Please contact the selected BSC store if you need to update the existing registration.`, [], 409);
      }

      // Generate registration ID
      const year = new Date().getFullYear();
      const codePrefix = `BSC-WED-${location.location_code}-${year}-`;
      let registrationId = null;
      for (let attempt = 0; attempt < 5 && !registrationId; attempt++) {
        const [lastRows] = await pool.query(
          `SELECT registration_id FROM wedding_registrations WHERE registration_id LIKE ? ORDER BY id DESC LIMIT 1`,
          [`${codePrefix}%`]
        );
        const lastSeq = lastRows && lastRows[0]
          ? parseInt(String(lastRows[0].registration_id).slice(-6), 10) || 0
          : 0;
        const candidate = `${codePrefix}${String(lastSeq + 1).padStart(6, '0')}`;
        const [exists] = await pool.query(
          `SELECT id FROM wedding_registrations WHERE registration_id = ?`,
          [candidate]
        );
        if (!exists || exists.length === 0) {
          registrationId = candidate;
        }
      }

      if (!registrationId) {
        return errorRes(res, 'Could not allocate a unique registration ID, please retry', [], 500);
      }

      // Parse JSON fields
      const weddingFunctions = data.wedding_functions ? JSON.stringify(data.wedding_functions) : null;
      const shoppingRequirements = data.shopping_requirements ? JSON.stringify(data.shopping_requirements) : null;

      // Insert registration
      const [insertResult] = await pool.query(`
        INSERT INTO wedding_registrations (
          registration_id,
          location_id,
          location_code,
          store_name,
          store_address,
          store_phone,
          customer_name,
          mobile,
          alternate_mobile,
          email,
          gender,
          age,
          address,
          area,
          city,
          pincode,
          wedding_date,
          wedding_date_flexibility,
          wedding_venue,
          wedding_city,
          wedding_type,
          wedding_functions,
          guest_count,
          family_size,
          bride_name,
          bride_age,
          bride_contact,
          bride_shopping_required,
          groom_name,
          groom_age,
          groom_contact,
          groom_shopping_required,
          shopping_requirements,
          budget_range,
          preferred_shopping_date,
          preferred_shopping_time,
          expected_visitors,
          existing_customer,
          existing_customer_id,
          previous_store,
          preferred_contact_method,
          preferred_followup_time,
          additional_notes,
          consent,
          status,
          lead_source,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 'Walk-in', NOW())
      `, [
        registrationId,
        locationId,
        location.location_code,
        location.location_name,
        location.address || null,
        location.phone || null,
        data.customer_name?.trim(),
        mobile,
        alternateMobile || null,
        data.email?.trim() || null,
        data.gender || null,
        data.age ? parseInt(data.age, 10) : null,
        data.address?.trim() || null,
        data.area?.trim() || null,
        data.city?.trim() || null,
        data.pincode?.trim() || null,
        data.wedding_date || null,
        data.wedding_date_flexibility || null,
        data.wedding_venue?.trim() || null,
        data.wedding_city?.trim() || null,
        data.wedding_type || null,
        weddingFunctions,
        data.guest_count ? parseInt(data.guest_count, 10) : null,
        data.family_size ? parseInt(data.family_size, 10) : null,
        data.bride_name?.trim() || null,
        data.bride_age ? parseInt(data.bride_age, 10) : null,
        data.bride_contact?.trim() || null,
        data.bride_shopping_required !== false,
        data.groom_name?.trim() || null,
        data.groom_age ? parseInt(data.groom_age, 10) : null,
        data.groom_contact?.trim() || null,
        data.groom_shopping_required !== false,
        shoppingRequirements,
        data.budget_range || null,
        data.preferred_shopping_date || null,
        data.preferred_shopping_time || null,
        data.expected_visitors ? parseInt(data.expected_visitors, 10) : null,
        data.existing_customer || null,
        data.existing_customer_id?.trim() || null,
        data.previous_store?.trim() || null,
        data.preferred_contact_method || null,
        data.preferred_followup_time || null,
        data.additional_notes ? encryptField(data.additional_notes?.trim()) : null,
        data.consent === true || data.consent === 'true'
      ]);

      const newId = insertResult.insertId;

      // Auto-create Wedding CRM record
      await this.createWeddingCrmRecord({
        registrationId,
        locationId,
        locationCode: location.location_code,
        customerName: data.customer_name?.trim(),
        mobile,
        email: data.email?.trim() || null,
        weddingDate: data.wedding_date || null,
        expectedShoppingDate: data.preferred_shopping_date,
        preferredCategory: data.shopping_requirements ? Object.keys(data.shopping_requirements).join(', ') : 'General Wedding Shopping',
        estimatedFamilySize: data.family_size ? parseInt(data.family_size, 10) : 1,
        followUpDate: data.preferred_shopping_date || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        preferredCallTime: data.preferred_followup_time || 'Morning (10 AM - 1 PM)',
        customerNotes: data.additional_notes?.trim() || `Wedding registration: ${registrationId}`,
        createdBy: req.user?.fullName || 'Customer Portal'
      });

      // Send confirmation email (non-blocking)
      sendWeddingRegistrationConfirmation({
        customer_name: data.customer_name?.trim(),
        mobile,
        email: data.email?.trim(),
        registration_id: registrationId,
        store_name: location.location_name,
        location_code: location.location_code,
        wedding_date: data.wedding_date,
        preferred_shopping_date: data.preferred_shopping_date
      }).catch(err => console.error('[Email] Confirmation send failed:', err.message));

      // Audit log
      await pool.query(`
        INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
        VALUES (?, ?, ?, 'Registration Created', ?)
      `, [
        newId,
        locationId,
        req.user?.fullName || 'Customer Portal',
        `Created wedding registration ${registrationId} for ${data.customer_name?.trim()}`
      ]);

      return successRes(res, {
        id: newId,
        registration_id: registrationId,
        registration: {
          id: newId,
          registration_id: registrationId,
          customer_name: data.customer_name?.trim(),
          mobile,
          location_id: locationId,
          location_name: location.location_name,
          wedding_date: data.wedding_date,
          status: 'New'
        }
      }, 'Wedding registration submitted successfully', 201);
    } catch (err) {
      console.error('[WeddingRegistrationController.createRegistration Error]', err);
      return errorRes(res, 'Failed to submit wedding registration', [err.message], 500);
    }
  }

  async createWeddingCrmRecord(data) {
    try {
      await pool.query(`
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
        data.registrationId,
        data.locationId,
        data.customerName,
        data.mobile,
        data.email,
        data.weddingDate,
        data.expectedShoppingDate,
        data.preferredCategory,
        data.estimatedFamilySize,
        data.assignedTelecaller || 'Auto-Assigned',
        null,
        data.followUpDate,
        data.preferredCallTime,
        data.customerNotes,
        data.createdBy,
        null
      ]);
    } catch (err) {
      console.error('[WeddingRegistrationController.createWeddingCrmRecord Error]', err);
    }
  }

  async getRegistrationById(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const { clause: locClause, params } = getLocationFilter(req, 'wr');

      const [rows] = await pool.query(`
        SELECT 
          wr.*,
          l.location_code,
          l.location_name
        FROM wedding_registrations wr
        LEFT JOIN locations l ON l.id = wr.location_id
        WHERE wr.id = ? AND wr.status != 'Deleted' ${locClause}
      `, [id, ...params]);

      if (!rows || rows.length === 0) {
        return errorRes(res, 'Registration not found or access denied', [], 404);
      }

      const registration = rows[0];
      decryptRow(registration, ENCRYPTED_FIELDS);

      // Parse JSON fields
      if (registration.wedding_functions && typeof registration.wedding_functions === 'string') {
        try { registration.wedding_functions = JSON.parse(registration.wedding_functions); } catch {}
      }
      if (registration.shopping_requirements && typeof registration.shopping_requirements === 'string') {
        try { registration.shopping_requirements = JSON.parse(registration.shopping_requirements); } catch {}
      }

      return successRes(res, { registration }, 'Registration details fetched successfully');
    } catch (err) {
      console.error('[WeddingRegistrationController.getRegistrationById Error]', err);
      return errorRes(res, 'Failed to fetch registration details', [err.message], 500);
    }
  }

  async updateRegistration(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const { clause: locClause, params: locParams } = getLocationFilter(req, 'wr');

      const [existing] = await pool.query(`
        SELECT * FROM wedding_registrations wr WHERE wr.id = ? AND wr.status != 'Deleted' ${locClause}
      `, [id, ...locParams]);

      if (!existing || existing.length === 0) {
        return errorRes(res, 'Registration not found or unauthorized', [], 404);
      }

      const prev = existing[0];
      const data = req.body;

      // Normalize phone if changed
      let mobile = prev.mobile;
      if (data.mobile && data.mobile.trim() !== prev.mobile) {
        mobile = data.mobile;
        const digits = mobile.replace(/\D/g, '');
        if (digits.length === 10) mobile = `+91${digits}`;
        else if (digits.length === 12 && digits.startsWith('91')) mobile = `+${digits}`;
        else if (digits.length === 11 && digits.startsWith('0')) mobile = `+91${digits.slice(1)}`;

        // Duplicate check
        const [dup] = await pool.query(`
          SELECT id FROM wedding_registrations 
          WHERE mobile = ? AND location_id = ? AND id != ? AND status != 'Deleted'
        `, [mobile, prev.location_id, id]);
        if (dup && dup.length > 0) {
          return errorRes(res, `Another registration already exists with mobile ${mobile}`, [], 409);
        }
      }

      // Build update query
      const updateFields = [];
      const updateParams = [];

      const fields = {
        customer_name: data.customer_name,
        mobile,
        alternate_mobile: data.alternate_mobile,
        email: data.email,
        gender: data.gender,
        age: data.age ? parseInt(data.age, 10) : null,
        address: data.address,
        area: data.area,
        city: data.city,
        pincode: data.pincode,
        wedding_date: data.wedding_date,
        wedding_date_flexibility: data.wedding_date_flexibility,
        wedding_venue: data.wedding_venue,
        wedding_city: data.wedding_city,
        wedding_type: data.wedding_type,
        wedding_functions: data.wedding_functions ? JSON.stringify(data.wedding_functions) : null,
        guest_count: data.guest_count ? parseInt(data.guest_count, 10) : null,
        family_size: data.family_size ? parseInt(data.family_size, 10) : null,
        bride_name: data.bride_name,
        bride_age: data.bride_age ? parseInt(data.bride_age, 10) : null,
        bride_contact: data.bride_contact,
        bride_shopping_required: data.bride_shopping_required,
        groom_name: data.groom_name,
        groom_age: data.groom_age ? parseInt(data.groom_age, 10) : null,
        groom_contact: data.groom_contact,
        groom_shopping_required: data.groom_shopping_required,
        shopping_requirements: data.shopping_requirements ? JSON.stringify(data.shopping_requirements) : null,
        budget_range: data.budget_range,
        preferred_shopping_date: data.preferred_shopping_date,
        preferred_shopping_time: data.preferred_shopping_time,
        expected_visitors: data.expected_visitors ? parseInt(data.expected_visitors, 10) : null,
        existing_customer: data.existing_customer,
        existing_customer_id: data.existing_customer_id,
        previous_store: data.previous_store,
        preferred_contact_method: data.preferred_contact_method,
        preferred_followup_time: data.preferred_followup_time,
        additional_notes: data.additional_notes !== undefined ? encryptField(data.additional_notes?.trim()) : null,
        consent: data.consent,
        status: data.status,
        assigned_employee: data.assigned_employee,
        next_followup: data.next_followup,
        call_result: data.call_result,
        remarks: data.remarks !== undefined ? encryptField(data.remarks?.trim()) : null
      };

      Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${key} = ?`);
          updateParams.push(value);
        }
      });

      if (updateFields.length > 0) {
        updateParams.push(id);
        await pool.query(`
          UPDATE wedding_registrations SET ${updateFields.join(', ')} WHERE id = ?
        `, updateParams);
      }

      // Audit log
      await pool.query(`
        INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
        VALUES (?, ?, ?, 'Registration Updated', ?)
      `, [
        id,
        prev.location_id,
        req.user?.fullName || 'Staff',
        'Updated wedding registration details'
      ]);

      return successRes(res, { id }, 'Registration updated successfully');
    } catch (err) {
      console.error('[WeddingRegistrationController.updateRegistration Error]', err);
      return errorRes(res, 'Failed to update registration', [err.message], 500);
    }
  }

  async deleteRegistration(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const { clause: locClause, params } = getLocationFilter(req, 'wr');

      const [existing] = await pool.query(`
        SELECT * FROM wedding_registrations wr WHERE wr.id = ? AND wr.status != 'Deleted' ${locClause}
      `, [id, ...params]);

      if (!existing || existing.length === 0) {
        return errorRes(res, 'Registration not found or unauthorized', [], 404);
      }

      const prev = existing[0];

      await pool.query(`
        UPDATE wedding_registrations SET status = 'Deleted', updated_at = NOW() WHERE id = ?
      `, [id]);

      await pool.query(`
        INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
        VALUES (?, ?, ?, 'Registration Deleted', ?)
      `, [
        id,
        prev.location_id,
        req.user?.fullName || 'Staff',
        `Archived registration ${prev.customer_name} (${prev.registration_id})`
      ]);

      return successRes(res, { id }, 'Registration archived successfully');
    } catch (err) {
      console.error('[WeddingRegistrationController.deleteRegistration Error]', err);
      return errorRes(res, 'Failed to delete registration', [err.message], 500);
    }
  }

  async exportRegistrations(req, res) {
    try {
      await ensureTables();
      const { status, locationId, fromDate, toDate } = req.query;

      const { clause: locClause, params: queryParams } = getLocationFilter(req, 'wr');
      let whereClauses = ['wr.status != \'Deleted\'', `1=1 ${locClause}`];

      if (status && status !== 'all') {
        whereClauses.push(`wr.status = ?`);
        queryParams.push(status);
      }
      if (locationId && locationId !== 'all') {
        whereClauses.push(`wr.location_id = ?`);
        queryParams.push(parseInt(locationId, 10));
      }
      if (fromDate && toDate) {
        whereClauses.push(`DATE(wr.created_at) BETWEEN ? AND ?`);
        queryParams.push(fromDate, toDate);
      }

      const whereSql = whereClauses.join(' AND ');

      const [registrations] = await pool.query(`
        SELECT 
          wr.registration_id,
          wr.customer_name,
          wr.mobile,
          wr.email,
          wr.location_code,
          wr.location_name,
          wr.wedding_date,
          wr.preferred_shopping_date,
          wr.budget_range,
          wr.family_size,
          wr.status,
          wr.assigned_employee,
          wr.next_followup,
          wr.call_result,
          wr.created_at
        FROM wedding_registrations wr
        LEFT JOIN locations l ON l.id = wr.location_id
        WHERE ${whereSql}
        ORDER BY wr.created_at DESC
      `, queryParams);

      return successRes(res, { registrations: registrations || [] }, 'Export data fetched successfully');
    } catch (err) {
      console.error('[WeddingRegistrationController.exportRegistrations Error]', err);
      return errorRes(res, 'Failed to fetch export data', [err.message], 500);
    }
  }

  async trackRegistration(req, res) {
    try {
      await ensureTables();
      const { registration_id, mobile } = req.body;

      if (!registration_id || !mobile) {
        return errorRes(res, 'Wedding Request ID and Mobile Number are required', [], 400);
      }

      const cleanId = registration_id.trim().toUpperCase();
      const cleanMobile = mobile.replace(/\D/g, '');
      const mobileVariants = [`+91${cleanMobile}`, `91${cleanMobile}`, cleanMobile];

      const [rows] = await pool.query(`
        SELECT 
          wr.registration_id,
          wr.customer_name,
          wr.mobile,
          wr.wedding_date,
          wr.preferred_shopping_date,
          wr.status,
          wr.created_at,
          l.location_name,
          l.location_code
        FROM wedding_registrations wr
        LEFT JOIN locations l ON l.id = wr.location_id
        WHERE wr.registration_id = ? 
          AND wr.status != 'Deleted'
          AND (
            wr.mobile = ? OR wr.mobile = ? OR wr.mobile = ?
            OR REPLACE(REPLACE(wr.mobile, '+91', ''), ' ', '') = ?
          )
        LIMIT 1
      `, [cleanId, mobileVariants[0], mobileVariants[1], mobileVariants[2], cleanMobile]);

      if (!rows || rows.length === 0) {
        return errorRes(res, 'No registration found matching the provided details. Please verify your Wedding Request ID and registered mobile number.', [], 404);
      }

      const reg = rows[0];

      const statusTimeline = [
        'Registration Received',
        'Contact Pending',
        'Contacted',
        'Follow-up Scheduled',
        'Shopping Date Confirmed',
        'Visit Scheduled',
        'Visit Completed',
        'Purchase Processing',
        'Purchase Completed',
        'Completed',
        'Cancelled'
      ];

      const statusMap = {
        'New': 'Registration Received',
        'Pending': 'Contact Pending',
        'Contacted': 'Contacted',
        'Follow-up Scheduled': 'Follow-up Scheduled',
        'Interested': 'Follow-up Scheduled',
        'Shopping Date Confirmed': 'Shopping Date Confirmed',
        'Visit Scheduled': 'Visit Scheduled',
        'Visited Store': 'Visit Completed',
        'Converted': 'Purchase Completed',
        'Purchase Completed': 'Purchase Completed',
        'Completed': 'Completed',
        'Not Interested': 'Cancelled',
        'Cancelled': 'Cancelled',
        'Closed': 'Completed'
      };

      const customerStatus = statusMap[reg.status] || 'Registration Received';
      const currentIdx = statusTimeline.indexOf(customerStatus);
      const timeline = statusTimeline.slice(0, currentIdx + 1);

      return successRes(res, {
        registration_id: reg.registration_id,
        customer_name: reg.customer_name,
        store_name: reg.location_name,
        store_code: reg.location_code,
        registration_date: reg.created_at,
        wedding_date: reg.wedding_date,
        expected_shopping_date: reg.preferred_shopping_date,
        current_status: customerStatus,
        status_timeline: timeline
      }, 'Registration details fetched successfully');
    } catch (err) {
      console.error('[WeddingRegistrationController.trackRegistration Error]', err);
      return errorRes(res, 'Unable to fetch registration details. Please try again.', [], 500);
    }
  }
}

module.exports = new WeddingRegistrationController();