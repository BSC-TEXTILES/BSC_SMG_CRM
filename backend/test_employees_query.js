const pool = require('./src/config/db');

async function check() {
  try {
    // Test the exact query from getEmployees
    const [rows] = await pool.query(
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
       LEFT JOIN (
         SELECT app_no, section, reporting_manager, offered_doj, updated_at,
                dob, gender, blood_group, aadhaar_number, father_details, mother_details,
                religion_caste, religion, caste, languages_known,
                city_state, address, qualification, experience, retail_experience,
                previous_company, previous_designation, salary, current_salary, expected_salary,
                photo_url, aadhaar_url, resume_url, remarks, source, referrer, referrer_emp_no,
                location_id, phone,
                ROW_NUMBER() OVER (
                  PARTITION BY COALESCE(app_no, phone)
                  ORDER BY
                    CASE WHEN app_no IS NOT NULL THEN 0 ELSE 1 END,
                    COALESCE(updated_at, created_at) DESC,
                    id DESC
                ) AS rn
         FROM candidates
         WHERE (is_deleted = 0 OR is_deleted IS NULL)
       ) c ON c.app_no = u.candidate_app_no OR (u.candidate_app_no IS NULL AND c.phone = u.phone AND c.phone IS NOT NULL AND c.rn = 1)
       LEFT JOIN selection_offers so ON c.app_no = so.app_no
       WHERE u.active = 1
       ORDER BY LOWER(u.full_name) ASC`
    );
    console.log('getEmployees query results:');
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}
check();