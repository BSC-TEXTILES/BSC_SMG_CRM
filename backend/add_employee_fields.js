const pool = require('./src/config/db');

async function addEmployeeFields() {
  try {
    console.log('Adding missing employee fields to users table...');
    
    const migrations = [
      // Section/Department allocation
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS section VARCHAR(150) NULL`,
      
      // Joining date / Date of Joining
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS joining_date DATE NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS offered_doj DATE NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS actual_doj DATE NULL`,
      
      // Salary/Compensation
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS salary VARCHAR(100) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS current_salary VARCHAR(100) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS expected_salary VARCHAR(100) NULL`,
      
      // Experience & Education
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS experience VARCHAR(150) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS retail_experience VARCHAR(150) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS qualification VARCHAR(150) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS previous_company VARCHAR(150) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS previous_designation VARCHAR(150) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS previous_salary VARCHAR(100) NULL`,
      
      // Personal Details
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS dob DATE NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS blood_group VARCHAR(20) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhaar_number VARCHAR(50) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS father_details VARCHAR(255) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS mother_details VARCHAR(255) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS religion VARCHAR(100) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS caste VARCHAR(100) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS languages_known TEXT NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS city_state VARCHAR(150) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT NULL`,
      
      // Documents
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhaar_url TEXT NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_url TEXT NULL`,
      
      // Other
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS reporting_manager VARCHAR(150) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS branch VARCHAR(150) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS remarks TEXT NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS source VARCHAR(100) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS referrer VARCHAR(150) NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS referrer_emp_no VARCHAR(50) NULL`,
      
      // Notice period
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS notice_period VARCHAR(50) NULL`,
    ];
    
    for (const sql of migrations) {
      try {
        await pool.query(sql);
        console.log(`✓ Executed: ${sql.substring(0, 60)}...`);
      } catch (e) {
        console.log(`⚠ Skipped (may exist): ${sql.substring(0, 60)}... - ${e.message}`);
      }
    }
    
    console.log('\nVerifying columns...');
    const [cols] = await pool.query('SHOW COLUMNS FROM users');
    const fieldNames = cols.map(c => c.Field);
    const requiredFields = [
      'section', 'joining_date', 'offered_doj', 'actual_doj',
      'salary', 'current_salary', 'expected_salary',
      'experience', 'retail_experience', 'qualification',
      'previous_company', 'previous_designation', 'previous_salary',
      'dob', 'gender', 'blood_group', 'aadhaar_number',
      'father_details', 'mother_details', 'religion', 'caste',
      'languages_known', 'city_state', 'address',
      'photo_url', 'aadhaar_url', 'resume_url',
      'reporting_manager', 'branch', 'remarks', 'source',
      'referrer', 'referrer_emp_no', 'notice_period'
    ];
    
    for (const field of requiredFields) {
      if (fieldNames.includes(field)) {
        console.log(`✓ ${field} exists`);
      } else {
        console.log(`✗ ${field} MISSING`);
      }
    }
    
    console.log('\nDone!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

addEmployeeFields();