const candidateService = require('../services/candidateService');
const userSyncService = require('../services/userSyncService');
const db = require('../config/db');
const { logAction } = require('../utils/logger');
const { successRes, errorRes } = require('../utils/response');
const { getLocationFilter, injectLocationId } = require('../middleware/auth');

class CandidateController {
  async getCandidates(req, res) {
    try {
      // Pass locationId from authenticated user to service layer
      const locationId = req.user ? req.user.locationId : null;
      const result = await candidateService.getCandidates(req.query, locationId);
      return res.json(result);
    } catch (err) {
      console.error('getCandidates ERROR:', err);
      return errorRes(res, 'DB_ERR: ' + err.message, [err.message], 500);
    }
  }

  async addCandidate(req, res) {
    try {
      const d = req.body.data || req.body;
      // Inject authenticated user's location — frontend cannot override this
      const locationId = injectLocationId(req) || 2; // fallback to Davanagere
      const locationCode = (req.user && req.user.locationCode) ? req.user.locationCode : 'DAV';
      const result = await candidateService.addCandidate({ ...d, locationId, locationCode });
      return res.json({ success: true, appNo: result.appNo, candidateCode: result.candidateCode });
    } catch (err) {
      return errorRes(res, `Failed to add candidate: ${err.message}`, [err.message], 500);
    }
  }

  async updateCandidate(req, res) {
    try {
      const appNo = req.params.appNo || req.params.id || req.body.appNo;
      if (!appNo) {
        return errorRes(res, 'Application number is required', ['appNo missing'], 400);
      }

      let updates = req.body;
      if (req.body && typeof req.body.updates === 'object' && req.body.updates !== null) {
        updates = { ...req.body, ...req.body.updates };
      }
      const user = req.body.doneBy || updates.doneBy || (req.user ? req.user.username : 'HR');

      const result = await candidateService.updateCandidateFull(appNo, updates, user);
      return res.json(result);
    } catch (err) {
      console.error('[updateCandidate Controller Error]:', err);
      return errorRes(res, 'Failed to update candidate: ' + err.message, [err.message], 500);
    }
  }

  async deleteCandidate(req, res) {
    try {
      const { appNo } = req.params;
      const result = await candidateService.deleteCandidate(appNo);
      return res.json(result);
    } catch (err) {
      return errorRes(res, 'Failed to delete candidate', [err.message], 500);
    }
  }

  async checkDuplicate(req, res) {
    try {
      const phone = req.query.phone || req.body.phone;
      const result = await candidateService.checkDuplicate(phone);
      return res.json(result);
    } catch (err) {
      return res.json({ exists: false });
    }
  }

  async getNextAppNo(req, res) {
    try {
      const result = await candidateService.generateCandidateCode();
      return res.json({ appNo: result.appNo });
    } catch (err) {
      return res.json({ appNo: 'BSC-2026-0001' });
    }
  }

  async getKPIs(req, res) {
    try {
      const { range, fromDate, toDate } = req.query;
      const locationId = req.user ? req.user.locationId : null;
      const result = await candidateService.getKPIs(range, fromDate, toDate, locationId);
      return res.json(result);
    } catch (err) {
      return res.json({ total: 0 });
    }
  }

  async getActivityFull(req, res) {
    try {
      const appNo = req.query.appNo || req.body.appNo;
      const result = await candidateService.getActivityFull(appNo);
      return res.json(result);
    } catch (err) {
      return res.json({ success: false, error: err.message });
    }
  }

  async getSystemActivity(req, res) {
    try {
      const limit = req.query.limit || 10;
      const locationId = req.user ? req.user.locationId : null;
      const result = await candidateService.getSystemActivity(limit, locationId);
      return res.json(result);
    } catch (err) {
      return res.json({ success: false, error: err.message });
    }
  }

  async uploadResume(req, res) {
    try {
      if (!req.file) {
        return errorRes(res, 'No file uploaded', [], 400);
      }
      const fileUrl = `/uploads/candidate-resumes/${req.file.filename}`;
      if (req.body.appNo) {
        await candidateService.updateCandidate(req.body.appNo, { resumeUrl: fileUrl });
      }
      return res.json({
        success: true,
        fileUrl,
        fileName: req.file.filename
      });
    } catch (err) {
      return errorRes(res, 'File upload failed', [err.message], 500);
    }
  }

  async uploadDocuments(req, res) {
    try {
      const result = {};
      const appNo = req.headers['x-app-no'] || req.body.appNo || req.query.appNo;
      
      if (req.files) {
        if (req.files['resume'] && req.files['resume'][0]) {
          result.resumeUrl = appNo 
            ? `uploads/applicants/${appNo}/${req.files['resume'][0].filename}` 
            : `uploads/candidate-resumes/${req.files['resume'][0].filename}`;
        }
        if (req.files['photo'] && req.files['photo'][0]) {
          result.photoUrl = appNo 
            ? `uploads/applicants/${appNo}/${req.files['photo'][0].filename}` 
            : `uploads/candidate-photos/${req.files['photo'][0].filename}`;
        }
        if (req.files['aadhar'] && req.files['aadhar'][0]) {
          result.aadhaarUrl = appNo 
            ? `uploads/applicants/${appNo}/${req.files['aadhar'][0].filename}` 
            : `uploads/employee-documents/${req.files['aadhar'][0].filename}`;
        }
      }
      return res.json({ success: true, ...result });
    } catch (err) {
      return errorRes(res, 'File upload failed', [err.message], 500);
    }
  }

  async getPendingActions(req, res) {
    try {
      const locationId = req.user ? req.user.locationId : null;
      const result = await candidateService.getPendingActions(locationId);
      return res.json(result);
    } catch (err) {
      return res.json({ actions: [] });
    }
  }

  async getSourceBreakdown(req, res) {
    try {
      const locationId = req.user ? req.user.locationId : null;
      const result = await candidateService.getSourceBreakdown(locationId);
      return res.json(result);
    } catch (err) {
      return res.json({ breakdown: [] });
    }
  }

  async getOpenings(req, res) {
    try {
      const db = require('../config/db');
      const { clause: locClause, params: locParams } = await getLocationFilter(req, 'c');

      const [reqRows] = await db.query(`SELECT designation, required_count FROM manpower_requisitions`);
      const reqMap = {};
      reqRows.forEach(r => {
        if (r.designation) reqMap[r.designation.trim().toLowerCase()] = r.required_count;
      });

      // Count hired candidates filtered by location
      const [hiredRows] = await db.query(
        `SELECT c.designation, COUNT(*) as cnt 
         FROM candidates c
         LEFT JOIN selection_offers so ON c.app_no = so.app_no
         WHERE (LOWER(TRIM(c.status)) IN ('joined', 'hired') 
            OR LOWER(TRIM(so.status)) IN ('joined'))
         ${locClause}
         GROUP BY c.designation`,
        locParams
      );
      const hiredMap = {};
      hiredRows.forEach(r => {
        if (r.designation) {
          const key = r.designation.trim().toLowerCase();
          hiredMap[key] = (hiredMap[key] || 0) + r.cnt;
        }
      });

      const [desigRows] = await db.query(`SELECT name FROM designations WHERE active = TRUE`);
      const desigSet = new Set([...desigRows.map(d => d.name)]);
      
      reqRows.forEach(r => { if (r.designation) desigSet.add(r.designation); });
      hiredRows.forEach(r => { if (r.designation) desigSet.add(r.designation); });

      const openings = Array.from(desigSet).map(desigName => {
        const key = desigName.trim().toLowerCase();
        const required = reqMap[key] || 0;
        const hired = hiredMap[key] || 0;
        return {
          designation: desigName,
          required,
          hired,
          remaining: Math.max(0, required - hired)
        };
      });

      openings.sort((a, b) => (a.designation || '').localeCompare(b.designation || ''));
      return res.json({ success: true, openings });
    } catch (err) {
      return errorRes(res, 'Failed to fetch openings', [err.message], 500);
    }
  }

  async updateOpening(req, res) {
    try {
      const db = require('../config/db');
      const { designation, required_count } = req.body;
      
      const [rows] = await db.query(`SELECT id FROM manpower_requisitions WHERE designation = ?`, [designation]);
      if (rows.length > 0) {
        await db.query(`UPDATE manpower_requisitions SET required_count = ? WHERE designation = ?`, [required_count, designation]);
      } else {
        await db.query(`INSERT INTO manpower_requisitions (designation, required_count) VALUES (?, ?)`, [designation, required_count]);
      }
      
      return res.json({ success: true });
    } catch (err) {
      return errorRes(res, 'Failed to update opening', [err.message], 500);
    }
  }

  async getEmployees(req, res) {
    try {
      const db = require('../config/db');
      const { clause: locClause, params: locParams } = await getLocationFilter(req, 'c');
      
      const [rows] = await db.query(
        `SELECT 
            u.id as user_id, u.username as username, u.employee_id as emp_no,
            u.full_name as name, u.email, u.phone,
            COALESCE(c.app_no, u.employee_id, u.username) as app_no,
            c.app_no as candidate_app_no,
            c.section, c.reporting_manager, c.offered_doj, c.updated_at as candidate_updated_at,
            u.updated_at as user_updated_at, u.last_login_at,
            u.department, u.designation, u.role, u.active, u.created_at, u.location_id, u.location_code,
            c.dob, c.gender, c.blood_group, c.aadhaar_number, c.father_details, c.mother_details, c.religion_caste, c.religion, c.caste, c.languages_known,
            c.city_state, c.address, c.qualification, c.experience, c.retail_experience,
            c.previous_company, c.previous_designation, c.salary as previous_salary, c.current_salary, c.expected_salary,
            c.photo_url, c.aadhaar_url, c.resume_url, c.remarks, c.source, c.referrer, c.referrer_emp_no,
            so.notice_period as offer_notice_pd, 
            so.est_doj as offer_est_doj, 
            so.actual_doj as offer_actual_doj,
            so.status as offer_status,
            so.remarks as offer_remarks,
            so.updated_at as offer_updated_at,
            l.location_name as branch
         FROM users u
         LEFT JOIN locations l ON l.id = u.location_id
         LEFT JOIN candidates c ON c.app_no = u.candidate_app_no OR (u.candidate_app_no IS NULL AND c.phone = u.phone AND c.phone IS NOT NULL)
         LEFT JOIN selection_offers so ON c.app_no = so.app_no
         WHERE u.active = 1
         ${locClause.replace('c.', 'u.')}
         GROUP BY u.id
         ORDER BY LOWER(u.full_name) ASC`,
        locParams
      );

      const colors = ['navy', 'gold', 'green', 'red', 'purple', 'teal'];

      const formatLocalDate = (d) => {
        if (!d) return '';
        if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) {
          return d.slice(0, 10);
        }
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return '';
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };

      const employees = rows.map(r => {
        const initials = r.name
          ? r.name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
          : 'E';
        const colorIndex = ((r.name ? r.name.charCodeAt(0) : 0) + (r.name ? r.name.charCodeAt(1) || 0 : 0)) % colors.length;
        
        const createdDate = new Date(r.created_at || Date.now());

        const joiningDateObj = r.offer_actual_doj 
          ? new Date(r.offer_actual_doj) 
          : (r.offered_doj ? new Date(r.offered_doj) : (r.offer_updated_at ? new Date(r.offer_updated_at) : createdDate));
        
        const rawDate = isNaN(joiningDateObj.getTime()) ? createdDate.getTime() : joiningDateObj.getTime();

        const actualDojStr = formatLocalDate(r.offer_actual_doj || r.offered_doj || r.offer_updated_at || r.candidate_updated_at || r.user_updated_at || r.created_at);
        const offeredDoj = formatLocalDate(r.offered_doj || r.offer_est_doj || r.offer_actual_doj);
        const estDojStr = formatLocalDate(r.offer_est_doj || r.offered_doj);
        const dobStr = formatLocalDate(r.dob);

        const salaryOffered = r.salary || r.expected_salary || '—';

        return {
          id: r.user_id,
          userId: r.user_id,
          username: r.username || '',
          appNo: r.app_no,
          candidateAppNo: r.candidate_app_no || null,
          employeeCode: r.app_no,
          employeeId: r.emp_no || '',
          empNo: r.emp_no || '',
          role: r.role || '',
          active: !!r.active,
          lastLoginAt: r.last_login_at || null,
          name: r.name,
          fullName: r.name,
          initials,
          color: colors[colorIndex],
          phone: r.phone || '',
          email: r.email || '',
          dob: dobStr,
          gender: r.gender || '',
          cityState: r.city_state || '',
          address: r.address || '',
          desig: r.designation,
          designation: r.designation,
          department: r.department || '',
          branch: r.branch || '',
          reportingManager: r.reporting_manager || '',
          status: 'Joined',
          salary: salaryOffered,
          expectedSalary: r.expected_salary || '',
          previousSalary: r.current_salary || r.previous_salary || '',
          currentSalary: r.current_salary || '',
          offeredDoj,
          actualDoj: actualDojStr,
          estDoj: estDojStr,
          noticePeriod: r.notice_period || r.offer_notice_pd || '',
          experience: r.experience || '',
          qualification: r.qualification || '',
          retailExperience: r.retail_experience || '',
          previousCompany: r.previous_company || '',
          previousDesignation: r.previous_designation || '',
          bloodGroup: r.blood_group || '',
          aadhaarNumber: r.aadhaar_number || '',
          fatherDetails: r.father_details || '',
          motherDetails: r.mother_details || '',
          religionCaste: r.religion_caste || '',
          religion: r.religion || '',
          caste: r.caste || '',
          languagesKnown: r.languages_known ? (typeof r.languages_known === 'string' ? (r.languages_known.startsWith('[') ? JSON.parse(r.languages_known) : [r.languages_known]) : r.languages_known) : [],
          photoUrl: r.photo_url || '',
          aadhaarUrl: r.aadhaar_url || '',
          aadharUrl: r.aadhaar_url || '',
          resumeUrl: r.resume_url || '',
          source: r.source || '',
          referrer: r.referrer || '',
          referrerEmpNo: r.referrer_emp_no || '',
          sourceDetail: r.source_detail || '',
          q1: r.q1 || '',
          q2: r.q2 || '',
          q3: r.q3 || '',
          q4: r.q4 || '',
          remarks: r.remarks || r.offer_remarks || '',
          section: r.section || '',
          locationId: r.location_id || 2,
          locationCode: r.location_code || 'DAV',
          createdAt: r.created_at || null,
          rawDate,
          date: joiningDateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        };
      });

      return res.json({ success: true, employees, total: employees.length });
    } catch (err) {
      return errorRes(res, 'DB_ERR: ' + err.message, [err.message], 500);
    }
  }

  /**
   * Update an Employee Directory record.
   * ------------------------------------------------------------------
   * `users` is the single source of truth, so the master account fields are
   * written first and the linked recruitment record is then aligned. The
   * Employee Directory, User Management, location dashboards and department
   * sections all read the same row, so one save updates every section.
   *
   * :id accepts a user id, a username or a candidate application number.
   */
  async updateEmployee(req, res) {
    try {
      const identifier = req.params.id;
      const payload = { ...(req.body || {}) };
      if (payload.data && typeof payload.data === 'object') Object.assign(payload, payload.data);
      if (payload.updates && typeof payload.updates === 'object') Object.assign(payload, payload.updates);

      const user = await userSyncService.resolveUser(identifier);
      if (!user) {
        return errorRes(res, 'Employee not found', [], 404);
      }

      const doneBy = req.user ? req.user.username : 'HR';
      const linkedAppNo = user.candidate_app_no || payload.appNo || payload.candidateAppNo || null;

      // 1. HR-owned recruitment fields (DOB, salary, documents, section …)
      //    `syncUser: false` keeps this function the single writer so the two
      //    tables cannot bounce values off each other.
      if (linkedAppNo) {
        await candidateService.updateCandidateFull(linkedAppNo, payload, doneBy, { syncUser: false });
      }

      // 2. Master account fields — authoritative for the shared values
      const fields = [];
      const params = [];

      const fullName = payload.fullName !== undefined ? payload.fullName : payload.name;
      if (fullName !== undefined && String(fullName).trim() !== '') {
        fields.push('full_name = ?');
        params.push(String(fullName).trim());
      }
      if (payload.email !== undefined) { fields.push('email = ?'); params.push(payload.email || null); }
      if (payload.phone !== undefined) { fields.push('phone = ?'); params.push(payload.phone || null); }
      if (payload.department !== undefined) { fields.push('department = ?'); params.push(payload.department || null); }

      const designation = payload.designation !== undefined ? payload.designation : payload.desig;
      if (designation !== undefined) { fields.push('designation = ?'); params.push(designation || null); }

      const employeeId = payload.employeeId !== undefined ? payload.employeeId : payload.empNo;
      if (employeeId !== undefined && employeeId !== null && String(employeeId).trim() !== '') {
        fields.push('employee_id = ?');
        params.push(String(employeeId).trim());
      }
      if (payload.active !== undefined) { fields.push('active = ?'); params.push(payload.active ? 1 : 0); }

      if (fields.length > 0) {
        params.push(user.id);
        await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
      }

      // 3. Push the account values outward so every other view converges
      await userSyncService.ensureEmployeeId(user.id);
      await userSyncService.syncCandidateFromUser(user.id);

      await logAction(req.user ? req.user.username : 'HR', 'UPDATE_EMPLOYEE', 'EMPLOYEES', {
        userId: user.id, appNo: linkedAppNo, changes: Object.keys(payload)
      });

      return res.json({ success: true, userId: user.id, appNo: linkedAppNo });
    } catch (err) {
      console.error('[updateEmployee ERROR]', err);
      return errorRes(res, 'Failed to update employee: ' + err.message, [err.message], 500);
    }
  }

  /**
   * Delete an Employee Directory record.
   * Removes the recruitment history AND the master login account it was
   * derived from, then releases every cross-module reference, so no dashboard
   * can keep showing a stale or duplicate employee.
   */
  async deleteEmployee(req, res) {
    try {
      const identifier = req.params.id;
      const user = await userSyncService.resolveUser(identifier);

      if (user && ['admin@bsctextiles.com', 'admin'].includes(String(user.username).toLowerCase())) {
        return errorRes(res, 'Cannot delete the built-in system administrator account', [], 403);
      }

      const appNo = (user && user.candidate_app_no) || (req.body && req.body.appNo) || null;

      // Deleting the candidate cascades to offers/interviews/activities and to
      // the linked master account (see candidateService.deleteCandidate).
      if (appNo) {
        await candidateService.deleteCandidate(appNo);
      }
      // Idempotent safety net for accounts that have no candidate record.
      if (user) {
        await userSyncService.deleteUserCompletely(user.id);
      }

      await logAction(req.user ? req.user.username : 'HR', 'DELETE_EMPLOYEE', 'EMPLOYEES', {
        userId: user ? user.id : null, appNo, identifier
      });

      return res.json({ success: true });
    } catch (err) {
      console.error('[deleteEmployee ERROR]', err);
      return errorRes(res, 'Failed to delete employee', [err.message], 500);
    }
  }

  async bulkAddEmployees(req, res) {
    try {
      const { employees } = req.body;
      if (!employees || !Array.isArray(employees)) {
        return res.status(400).json({ success: false, error: 'Invalid payload' });
      }
      
      const user = req.user ? req.user.username : 'HR';
      const result = await candidateService.bulkAddEmployees(employees, user);
      return res.json(result);
    } catch (err) {
      return errorRes(res, 'Failed to bulk import employees', [err.message], 500);
    }
  }
}

module.exports = new CandidateController();
