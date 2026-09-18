const pool = require('./src/config/db');

async function addEmployeeFields() {
  try {
    console.log('Adding missing employee fields to users table...');
    
    // First check existing columns
    const [existingCols] = await pool.query('SHOW COLUMNS FROM users');
    const existingFields = new Set(existingCols.map(c => c.Field.toLowerCase()));
    
    const migrations = [
      // Section/Department allocation
      { field: 'section', sql: 'ALTER TABLE users ADD COLUMN section VARCHAR(150) NULL' },
      
      // Joining date / Date of Joining
      { field: 'joining_date', sql: 'ALTER TABLE users ADD COLUMN joining_date DATE NULL' },
      { field: 'offered_doj', sql: 'ALTER TABLE users ADD COLUMN offered_doj DATE NULL' },
      { field: 'actual_doj', sql: 'ALTER TABLE users ADD COLUMN actual_doj DATE NULL' },
      
      // Salary/Compensation
      { field: 'salary', sql: 'ALTER TABLE users ADD COLUMN salary VARCHAR(100) NULL' },
      { field: 'current_salary', sql: 'ALTER TABLE users ADD COLUMN current_salary VARCHAR(100) NULL' },
      { field: 'expected_salary', sql: 'ALTER TABLE users ADD COLUMN expected_salary VARCHAR(100) NULL' },
      
      // Experience & Education
      { field: 'experience', sql: 'ALTER TABLE users ADD COLUMN experience VARCHAR(150) NULL' },
      { field: 'retail_experience', sql: 'ALTER TABLE users ADD COLUMN retail_experience VARCHAR(150) NULL' },
      { field: 'qualification', sql: 'ALTER TABLE users ADD COLUMN qualification VARCHAR(150) NULL' },
      { field: 'previous_company', sql: 'ALTER TABLE users ADD COLUMN previous_company VARCHAR(150) NULL' },
      { field: 'previous_designation', sql: 'ALTER TABLE users ADD COLUMN previous_designation VARCHAR(150) NULL' },
      { field: 'previous_salary', sql: 'ALTER TABLE users ADD COLUMN previous_salary VARCHAR(100) NULL' },
      
      // Personal Details
      { field: 'dob', sql: 'ALTER TABLE users ADD COLUMN dob DATE NULL' },
      { field: 'gender', sql: 'ALTER TABLE users ADD COLUMN gender VARCHAR(20) NULL' },
      { field: 'blood_group', sql: 'ALTER TABLE users ADD COLUMN blood_group VARCHAR(20) NULL' },
      { field: 'aadhaar_number', sql: 'ALTER TABLE users ADD COLUMN aadhaar_number VARCHAR(50) NULL' },
      { field: 'father_details', sql: 'ALTER TABLE users ADD COLUMN father_details VARCHAR(255) NULL' },
      { field: 'mother_details', sql: 'ALTER TABLE users ADD COLUMN mother_details VARCHAR(255) NULL' },
      { field: 'religion', sql: 'ALTER TABLE users ADD COLUMN religion VARCHAR(100) NULL' },
      { field: 'caste', sql: 'ALTER TABLE users ADD COLUMN caste VARCHAR(100) NULL' },
      { field: 'languages_known', sql: 'ALTER TABLE users ADD COLUMN languages_known TEXT NULL' },
      { field: 'city_state', sql: 'ALTER TABLE users ADD COLUMN city_state VARCHAR(150) NULL' },
      { field: 'address', sql: 'ALTER TABLE users ADD COLUMN address TEXT NULL' },
      
      // Documents
      { field: 'photo_url', sql: 'ALTER TABLE users ADD COLUMN photo_url TEXT NULL' },
      { field: 'aadhaar_url', sql: 'ALTER TABLE users ADD COLUMN aadhaar_url TEXT NULL' },
      { field: 'resume_url', sql: 'ALTER TABLE users ADD COLUMN resume_url TEXT NULL' },
      
      // Other
      { field: 'reporting_manager', sql: 'ALTER TABLE users ADD COLUMN reporting_manager VARCHAR(150) NULL' },
      { field: 'branch', sql: 'ALTER TABLE users ADD COLUMN branch VARCHAR(150) NULL' },
      { field: 'remarks', sql: 'ALTER TABLE users ADD COLUMN remarks TEXT NULL' },
      { field: 'source', sql: 'ALTER TABLE users ADD COLUMN source VARCHAR(100) NULL' },
      { field: 'referrer', sql: 'ALTER TABLE users ADD COLUMN referrer VARCHAR(150) NULL' },
      { field: 'referrer_emp_no', sql: 'ALTER TABLE users ADD COLUMN referrer_emp_no VARCHAR(50) NULL' },
      
      // Notice period
      { field: 'notice_period', sql: 'ALTER TABLE users ADD COLUMN notice_period VARCHAR(50) NULL' },
    ];
    
    for (const migration of migrations) {
      if (existingFields.has(migration.field.toLowerCase())) {
        console.log(`✓ ${migration.field} already exists`);
        continue;
      }
      try {
        await pool.query(migration.sql);
        console.log(`✓ Added: ${migration.field}`);
        existingFields.add(migration.field.toLowerCase());
      } catch (e) {
        console.log(`✗ Failed to add ${migration.field}: ${e.message}`);
      }
    }
    
    console.log('\nVerifying columns...');
    const [cols] = await pool.query('SHOW COLUMNS FROM users');
    const fieldNames = new Set(cols.map(c => c.Field.toLowerCase()));
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
      if (fieldNames.has(field.toLowerCase())) {
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