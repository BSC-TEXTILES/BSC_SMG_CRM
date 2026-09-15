const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Log only to console (no file writing to avoid permission issues on Hostinger)
function logDebug(msg, extra = '') {
  const formatted = typeof extra === 'object' ? JSON.stringify(extra).slice(0, 200) : extra;
  console.log(msg, formatted || '');
}

async function autoInitializeDatabase(pool) {
  logDebug('[Auto DB Initializer] autoInitializeDatabase started');
  try {
    const connection = await pool.getConnection();
    logDebug(`[Auto DB Initializer] Checking database schema...`);

    // Check existing tables
    const [tables] = await connection.query(`SHOW TABLES`);
    const tableNames = tables.map(t => Object.values(t)[0]);
    logDebug(`[Auto DB Initializer] Found ${tableNames.length} existing tables:`, tableNames);

    const hasCandidateTable = tableNames.some(t => t.toLowerCase() === 'candidate' || t.toLowerCase() === 'candidates');

    if (!hasCandidateTable || tableNames.length < 5) {
      logDebug(`[Auto DB Initializer] Database tables missing. Running schema migration scripts...`);

      const possibleDbDirs = [
        path.join(__dirname, '../database'),
        path.join(__dirname, '../../database'),
        path.join(__dirname, '../../../database'),
        path.join(process.cwd(), 'database'),
        path.join(process.cwd(), 'backend/database'),
        path.join(__dirname, 'database')
      ];

      let dbDir = possibleDbDirs.find(d => fs.existsSync(path.join(d, 'schema.sql')));
      if (!dbDir) {
        dbDir = possibleDbDirs[0];
      }

      logDebug(`[Auto DB Initializer] Using database SQL directory: ${dbDir}`);

      const sqlFiles = ['schema.sql', 'default_data.sql', 'roles.sql', 'permissions.sql', 'indexes.sql'];

      for (const fileName of sqlFiles) {
        const filePath = path.join(dbDir, fileName);
        if (fs.existsSync(filePath)) {
          logDebug(`[Auto DB Initializer] Executing ${fileName}...`);
          let rawSql = fs.readFileSync(filePath, 'utf8');

          // Strip out CREATE DATABASE and USE statements
          rawSql = rawSql
            .replace(/CREATE DATABASE[\s\S]*?;/gi, '')
            .replace(/USE `?[\w_]+`?;/gi, '');

          // Split statements by semicolon
          const statements = rawSql
            .split(/;\s*$/m)
            .map(s => s.trim())
            .filter(s => s.length > 0);

          for (const stmt of statements) {
            try {
              await connection.query(stmt);
            } catch (err) {
              logDebug(`[Auto DB Initializer Warning on ${fileName}]:`, err.message);
            }
          }
        }
      }
    }

    // Ensure Legacy Table Compatibility Views/Tables exist for smooth operational queries
    const compatibilityScripts = [
      `CREATE TABLE IF NOT EXISTS \`locations\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`location_code\` VARCHAR(10) NOT NULL UNIQUE,
        \`location_name\` VARCHAR(100) NOT NULL,
        \`address\` TEXT NULL,
        \`phone\` VARCHAR(20) NULL,
        \`email\` VARCHAR(100) NULL,
        \`status\` VARCHAR(20) NOT NULL DEFAULT 'Active',
        \`sort_order\` INT NOT NULL DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`username\` VARCHAR(100) NOT NULL UNIQUE,
        \`password\` VARCHAR(255) NOT NULL,
        \`full_name\` VARCHAR(150) NULL,
        \`email\` VARCHAR(150) NULL,
        \`phone\` VARCHAR(20) NULL,
        \`department\` VARCHAR(150) NULL,
        \`designation\` VARCHAR(150) NULL,
        \`role\` VARCHAR(50) NOT NULL DEFAULT 'HR',
        \`active\` BOOLEAN DEFAULT TRUE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`candidates\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`app_no\` VARCHAR(50) NOT NULL UNIQUE,
        \`name\` VARCHAR(255) NOT NULL,
        \`phone\` VARCHAR(20) NOT NULL,
        \`email\` VARCHAR(150) NULL,
        \`dob\` DATE NULL,
        \`gender\` VARCHAR(20) NULL,
        \`city_state\` VARCHAR(150) NULL,
        \`address\` TEXT NULL,
        \`designation\` VARCHAR(150) NOT NULL,
        \`occupation\` VARCHAR(150) NULL,
        \`qualification\` VARCHAR(150) NULL,
        \`experience\` VARCHAR(100) NULL,
        \`current_salary\` VARCHAR(100) NULL,
        \`expected_salary\` VARCHAR(100) NULL,
        \`notice_period\` VARCHAR(50) NULL,
        \`own_vehicle\` VARCHAR(10) DEFAULT 'No',
        \`source\` VARCHAR(100) DEFAULT 'Walk-in',
        \`referrer\` VARCHAR(150) NULL,
        \`referrer_emp_no\` VARCHAR(50) NULL,
        \`source_detail\` VARCHAR(255) NULL,
        \`q1\` TEXT NULL,
        \`q2\` TEXT NULL,
        \`q3\` TEXT NULL,
        \`q4\` TEXT NULL,
        \`status\` VARCHAR(50) DEFAULT 'New',
        \`salary\` VARCHAR(100) NULL,
        \`remarks\` TEXT NULL,
        \`is_duplicate_phone\` VARCHAR(10) DEFAULT 'No',
        \`resume_url\` TEXT NULL,
        \`blood_group\` VARCHAR(20) NULL,
        \`offered_doj\` DATE NULL,
        \`retail_experience\` VARCHAR(150) NULL,
        \`previous_company\` VARCHAR(150) NULL,
        \`previous_designation\` VARCHAR(150) NULL,
        \`aadhaar_number\` VARCHAR(50) NULL,
        \`father_details\` VARCHAR(255) NULL,
        \`mother_details\` VARCHAR(255) NULL,
        \`religion_caste\` VARCHAR(150) NULL,
        \`religion\` VARCHAR(100) NULL,
        \`caste\` VARCHAR(100) NULL,
        \`languages_known\` VARCHAR(255) NULL,
        \`photo_url\` TEXT NULL,
        \`aadhaar_url\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`interview_schedules\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`candidate_id\` INT NULL,
        \`app_no\` VARCHAR(50) NOT NULL,
        \`candidate_name\` VARCHAR(255) NOT NULL,
        \`designation\` VARCHAR(150) NOT NULL,
        \`step\` INT DEFAULT 1,
        \`status\` VARCHAR(50) DEFAULT 'Scheduled',
        \`call1_date\` DATETIME NULL,
        \`call1_remarks\` TEXT NULL,
        \`call2_date\` DATETIME NULL,
        \`call2_remarks\` TEXT NULL,
        \`interview_date\` DATETIME NULL,
        \`interview_remarks\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`interview_tokens\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`token\` VARCHAR(100) NOT NULL UNIQUE,
        \`candidate_id\` INT NULL,
        \`app_no\` VARCHAR(50) NOT NULL,
        \`candidate_name\` VARCHAR(255) NOT NULL,
        \`designation\` VARCHAR(150) NOT NULL,
        \`assigned_name\` VARCHAR(150) NOT NULL,
        \`assigned_designation\` VARCHAR(150) NOT NULL,
        \`status\` VARCHAR(50) DEFAULT 'pending',
        \`scores_json\` LONGTEXT NULL,
        \`remarks\` TEXT NULL,
        \`completed_at\` DATETIME NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`hr_evaluations\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`candidate_id\` INT NULL,
        \`app_no\` VARCHAR(50) NOT NULL,
        \`hr_score_json\` LONGTEXT NULL,
        \`assigned_score_json\` LONGTEXT NULL,
        \`is_new_role\` BOOLEAN DEFAULT FALSE,
        \`suggested_designation\` VARCHAR(150) NULL,
        \`suggestion_reason\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`selected_candidates\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`candidate_id\` INT NULL,
        \`app_no\` VARCHAR(50) NOT NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`phone\` VARCHAR(20) NULL,
        \`designation\` VARCHAR(150) NOT NULL,
        \`source\` VARCHAR(100) NULL,
        \`hr_score\` INT DEFAULT 0,
        \`assigned_score\` INT DEFAULT 0,
        \`total_score\` INT DEFAULT 0,
        \`decision_date\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`decision_by\` VARCHAR(150) NULL,
        \`is_probation\` BOOLEAN DEFAULT FALSE,
        \`remarks\` TEXT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`rejected_candidates\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`candidate_id\` INT NULL,
        \`app_no\` VARCHAR(50) NOT NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`phone\` VARCHAR(20) NULL,
        \`designation\` VARCHAR(150) NOT NULL,
        \`source\` VARCHAR(100) NULL,
        \`stage\` VARCHAR(100) NULL,
        \`rejection_date\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`rejected_by\` VARCHAR(150) NULL,
        \`remarks\` TEXT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`selection_offers\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`candidate_id\` INT NULL,
        \`app_no\` VARCHAR(50) NOT NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`designation\` VARCHAR(150) NOT NULL,
        \`status\` VARCHAR(50) DEFAULT 'Pending Accept',
        \`call_date\` DATETIME NULL,
        \`remarks\` TEXT NULL,
        \`joining_date\` DATE NULL,
        \`accepted_date\` DATE NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`candidate_activities\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`candidate_id\` INT NULL,
        \`app_no\` VARCHAR(50) NOT NULL,
        \`action_type\` VARCHAR(100) NOT NULL,
        \`icon\` VARCHAR(20) DEFAULT 'dY"<',
        \`label\` VARCHAR(255) NOT NULL,
        \`score\` INT DEFAULT 0,
        \`max_score\` INT DEFAULT 60,
        \`remarks\` TEXT NULL,
        \`assigned_by\` VARCHAR(150) NULL,
        \`by_user\` VARCHAR(150) NULL,
        \`color\` VARCHAR(50) DEFAULT 'navy',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`employees\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`employee_id\` VARCHAR(100) NULL UNIQUE,
        \`app_no\` VARCHAR(50) NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`email\` VARCHAR(150) NULL,
        \`phone\` VARCHAR(20) NULL,
        \`department\` VARCHAR(150) NULL,
        \`designation\` VARCHAR(150) NULL,
        \`section\` VARCHAR(150) NULL,
        \`branch\` VARCHAR(150) NULL,
        \`status\` VARCHAR(50) DEFAULT 'Joined',
        \`joining_date\` DATE NULL,
        \`salary\` DECIMAL(10,2) NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`interview_questions\` (
        \`q_id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`round\` VARCHAR(50) DEFAULT 'HR',
        \`designation\` VARCHAR(150) DEFAULT 'All',
        \`question\` TEXT NOT NULL,
        \`type\` VARCHAR(50) DEFAULT 'score',
        \`max_score\` INT DEFAULT 10,
        \`options\` TEXT NULL,
        \`active\` BOOLEAN DEFAULT TRUE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`page_visibility_settings\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`page_key\` VARCHAR(100) NOT NULL UNIQUE,
        \`hr_visible\` BOOLEAN DEFAULT TRUE,
        \`manager_visible\` BOOLEAN DEFAULT TRUE,
        \`admin_visible\` BOOLEAN DEFAULT TRUE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      // page_visibility table: used by settingsController.getPageSettings / savePageSettings
      `CREATE TABLE IF NOT EXISTS \`page_visibility\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`role_page_key\` VARCHAR(200) NOT NULL UNIQUE,
        \`role\` VARCHAR(100) NOT NULL,
        \`page_key\` VARCHAR(100) NOT NULL,
        \`allowed\` BOOLEAN DEFAULT TRUE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`broadcast_messages\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`title\` VARCHAR(255) NOT NULL,
        \`subject\` VARCHAR(255) NULL,
        \`message\` TEXT NOT NULL,
        \`priority\` VARCHAR(50) DEFAULT 'normal',
        \`category\` VARCHAR(100) DEFAULT 'General',
        \`target_role\` VARCHAR(255) DEFAULT 'Everyone',
        \`sender_name\` VARCHAR(255) NOT NULL,
        \`status\` VARCHAR(50) DEFAULT 'Sent',
        \`require_ack\` BOOLEAN DEFAULT FALSE,
        \`pinned\` BOOLEAN DEFAULT FALSE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`designations\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`role_scope\` VARCHAR(50) DEFAULT 'All',
        \`name\` VARCHAR(150) NOT NULL UNIQUE,
        \`active\` BOOLEAN DEFAULT TRUE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`onboarding_records\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`record_id\` VARCHAR(50) NOT NULL UNIQUE,
        \`emp_name\` VARCHAR(255) NOT NULL,
        \`designation\` VARCHAR(150) NOT NULL,
        \`joining_date\` DATE NULL,
        \`progress\` INT DEFAULT 0,
        \`status\` VARCHAR(50) DEFAULT 'On Track',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`onboarding_items\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`onboarding_id\` INT NULL,
        \`record_id\` VARCHAR(50) NOT NULL,
        \`section\` VARCHAR(100) NOT NULL,
        \`item_id\` VARCHAR(100) NOT NULL,
        \`item\` VARCHAR(255) NOT NULL,
        \`mandatory\` BOOLEAN DEFAULT FALSE,
        \`status\` VARCHAR(50) DEFAULT 'Pending',
        \`remarks\` TEXT NULL,
        \`done_by\` VARCHAR(150) NULL,
        \`done_at\` DATETIME NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      // User Management — granular per-user module-level permissions
      `CREATE TABLE IF NOT EXISTS \`user_permissions\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`module\` VARCHAR(100) NOT NULL,
        \`can_view\` BOOLEAN DEFAULT FALSE,
        \`can_add\` BOOLEAN DEFAULT FALSE,
        \`can_edit\` BOOLEAN DEFAULT FALSE,
        \`can_delete\` BOOLEAN DEFAULT FALSE,
        \`can_export\` BOOLEAN DEFAULT FALSE,
        \`can_approve\` BOOLEAN DEFAULT FALSE,
        \`granted_by\` VARCHAR(150) NULL,
        \`granted_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY \`user_module_idx\` (\`user_id\`, \`module\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`user_locations\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`location_id\` INT NOT NULL,
        \`assigned_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY \`user_location_idx\` (\`user_id\`, \`location_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
    ];

    for (const sql of compatibilityScripts) {
      try {
        await connection.query(sql);
      } catch (err) {
        logDebug(`[Auto DB Compatibility Warning]:`, err.message);
      }
    }

    // Seed default locations if missing
    try {
      await connection.query(
        `INSERT IGNORE INTO \`locations\` (\`id\`, \`location_code\`, \`location_name\`, \`sort_order\`, \`status\`) VALUES
         (1, 'BEL', 'Belagavi', 1, 'Active'),
         (2, 'DAV', 'Davanagere', 2, 'Active'),
         (3, 'SHI', 'Shivamogga', 3, 'Active')`
      );
    } catch (e) {
      logDebug(`[Auto DB Initializer Locations Seed Warning]:`, e.message);
    }

    // --- MIGRATIONS ---
    const migrations = [
      "ALTER TABLE candidates ADD COLUMN is_duplicate_phone VARCHAR(10) DEFAULT 'No'",
      "ALTER TABLE candidates ADD COLUMN resume_url TEXT NULL",
      "ALTER TABLE candidates ADD COLUMN blood_group VARCHAR(20) NULL",
      "ALTER TABLE candidates ADD COLUMN photo_url TEXT NULL",
      "ALTER TABLE candidates ADD COLUMN aadhaar_url TEXT NULL",
      "ALTER TABLE candidates ADD COLUMN salary VARCHAR(100) NULL",
      "ALTER TABLE candidates ADD COLUMN offered_doj DATE NULL",
      "ALTER TABLE candidates ADD COLUMN retail_experience VARCHAR(150) NULL",
      "ALTER TABLE candidates ADD COLUMN previous_company VARCHAR(150) NULL",
      "ALTER TABLE candidates ADD COLUMN previous_designation VARCHAR(150) NULL",
      "ALTER TABLE candidates ADD COLUMN aadhaar_number VARCHAR(50) NULL",
      "ALTER TABLE candidates ADD COLUMN father_details VARCHAR(255) NULL",
      "ALTER TABLE candidates ADD COLUMN mother_details VARCHAR(255) NULL",
      "ALTER TABLE candidates ADD COLUMN religion_caste VARCHAR(150) NULL",
      "ALTER TABLE candidates ADD COLUMN languages_known VARCHAR(255) NULL",
      "ALTER TABLE candidate_activities ADD COLUMN assigned_by VARCHAR(150) NULL",
      "ALTER TABLE candidate_activities ADD COLUMN by_user VARCHAR(150) NULL",
      "ALTER TABLE candidate_activities ADD COLUMN color VARCHAR(50) DEFAULT 'navy'",
      "ALTER TABLE hr_evaluations ADD COLUMN is_new_role BOOLEAN DEFAULT FALSE",
      "ALTER TABLE hr_evaluations ADD COLUMN suggested_designation VARCHAR(150) NULL",
      "ALTER TABLE hr_evaluations ADD COLUMN suggestion_reason TEXT NULL",
      `CREATE TABLE IF NOT EXISTS manpower_requisitions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        designation VARCHAR(150) NOT NULL UNIQUE,
        department VARCHAR(150) NULL,
        branch VARCHAR(150) NULL,
        required_count INT DEFAULT 0,
        priority VARCHAR(50) DEFAULT 'Normal',
        status VARCHAR(50) DEFAULT 'Open',
        opening_date DATE NULL,
        closing_date DATE NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
      `CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
      `CREATE TABLE IF NOT EXISTS role_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_name VARCHAR(100) NOT NULL,
        module VARCHAR(100) NOT NULL,
        can_view BOOLEAN DEFAULT FALSE,
        can_create BOOLEAN DEFAULT FALSE,
        can_edit BOOLEAN DEFAULT FALSE,
        can_delete BOOLEAN DEFAULT FALSE,
        UNIQUE KEY \`role_module_idx\` (\`role_name\`, \`module\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(150),
        action VARCHAR(100),
        module VARCHAR(100),
        details TEXT,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      // selection_offers missing columns needed by offerController
      "ALTER TABLE selection_offers ADD COLUMN call1_date DATETIME NULL",
      "ALTER TABLE selection_offers ADD COLUMN call1_remarks TEXT NULL",
      "ALTER TABLE selection_offers ADD COLUMN call2_date DATETIME NULL",
      "ALTER TABLE selection_offers ADD COLUMN call2_remarks TEXT NULL",
      "ALTER TABLE selection_offers ADD COLUMN confirm_date DATETIME NULL",
      "ALTER TABLE selection_offers ADD COLUMN confirm_remarks TEXT NULL",
      "ALTER TABLE selection_offers ADD COLUMN notice_period VARCHAR(100) NULL",
      "ALTER TABLE selection_offers ADD COLUMN est_doj DATE NULL",
      "ALTER TABLE selection_offers ADD COLUMN actual_doj DATE NULL",
      "ALTER TABLE selection_offers ADD COLUMN updated_at DATETIME NULL",
      "ALTER TABLE candidates ADD COLUMN religion VARCHAR(100) NULL",
      "ALTER TABLE candidates ADD COLUMN caste VARCHAR(100) NULL",
      "ALTER TABLE candidates ADD COLUMN department VARCHAR(150) NULL",
      "ALTER TABLE selection_offers ADD COLUMN department VARCHAR(150) NULL",
      "ALTER TABLE candidates ADD COLUMN branch VARCHAR(150) NULL",
      "ALTER TABLE selection_offers ADD COLUMN branch VARCHAR(150) NULL",
      "ALTER TABLE candidates ADD COLUMN reporting_manager VARCHAR(150) NULL",
      "ALTER TABLE selection_offers ADD COLUMN reporting_manager VARCHAR(150) NULL",
      
      "ALTER TABLE users ADD COLUMN email VARCHAR(150) NULL",
      "ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL",
      "ALTER TABLE users ADD COLUMN department VARCHAR(150) NULL",
      "ALTER TABLE users ADD COLUMN designation VARCHAR(150) NULL",
      
      "ALTER TABLE manpower_requisitions ADD COLUMN department VARCHAR(150) NULL",
      "ALTER TABLE manpower_requisitions ADD COLUMN branch VARCHAR(150) NULL",
      "ALTER TABLE manpower_requisitions ADD COLUMN priority VARCHAR(50) DEFAULT 'Normal'",
      "ALTER TABLE manpower_requisitions ADD COLUMN status VARCHAR(50) DEFAULT 'Open'",
      "ALTER TABLE manpower_requisitions ADD COLUMN opening_date DATE NULL",
      "ALTER TABLE manpower_requisitions ADD COLUMN closing_date DATE NULL",

      "ALTER TABLE candidates ADD COLUMN department VARCHAR(150) NULL",
      "ALTER TABLE candidates ADD COLUMN section VARCHAR(150) NULL",
      "ALTER TABLE selection_offers ADD COLUMN section VARCHAR(150) NULL",
      "ALTER TABLE selection_offers ADD COLUMN salary VARCHAR(100) NULL",
      
      "ALTER TABLE Feedback ADD COLUMN date VARCHAR(32) NULL",
      "ALTER TABLE Feedback ADD COLUMN source VARCHAR(32) DEFAULT 'qr'",
      "ALTER TABLE Feedback ADD COLUMN area VARCHAR(150) NULL",
      "ALTER TABLE Feedback ADD COLUMN yourVoice TEXT NULL",
      "ALTER TABLE Feedback ADD COLUMN custName VARCHAR(255) NULL",
      "ALTER TABLE Feedback ADD COLUMN custMobile VARCHAR(32) NULL",
      "ALTER TABLE Feedback ADD COLUMN custDob VARCHAR(32) NULL",
      "ALTER TABLE Feedback ADD COLUMN q0 VARCHAR(255) NULL",
      "ALTER TABLE Feedback ADD COLUMN q0_other VARCHAR(255) NULL",
      "ALTER TABLE Feedback ADD COLUMN q1 VARCHAR(255) NULL",
      "ALTER TABLE Feedback ADD COLUMN q1_other VARCHAR(255) NULL",
      "ALTER TABLE Feedback ADD COLUMN q2 VARCHAR(255) NULL",
      "ALTER TABLE Feedback ADD COLUMN q2_other VARCHAR(255) NULL",
      "ALTER TABLE Feedback ADD COLUMN q3 VARCHAR(255) NULL",
      "ALTER TABLE Feedback ADD COLUMN q3_other VARCHAR(255) NULL",
      "ALTER TABLE Feedback ADD COLUMN q4 VARCHAR(255) NULL",
      "ALTER TABLE Feedback ADD COLUMN q4_other VARCHAR(255) NULL",
      "ALTER TABLE Feedback ADD COLUMN q5 VARCHAR(255) NULL",
      "ALTER TABLE Feedback ADD COLUMN q5_other VARCHAR(255) NULL",
      "ALTER TABLE Feedback ADD COLUMN q6 VARCHAR(255) NULL",
      "ALTER TABLE Feedback ADD COLUMN q6_other VARCHAR(255) NULL",
      "ALTER TABLE Feedback ADD COLUMN q7 VARCHAR(255) NULL",
      "ALTER TABLE Feedback ADD COLUMN q7_other VARCHAR(255) NULL",
      "ALTER TABLE Feedback ADD COLUMN status VARCHAR(32) DEFAULT 'new'",
      "ALTER TABLE Feedback ADD COLUMN actionTaken TEXT NULL",
      "ALTER TABLE Feedback ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
      "ALTER TABLE Feedback ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
      "ALTER TABLE Feedback ADD COLUMN deleted_at TIMESTAMP NULL",
      "ALTER TABLE Feedback ADD COLUMN isNegative TINYINT(1) DEFAULT 0",
      "ALTER TABLE Feedback ADD COLUMN answers TEXT NULL",
      "ALTER TABLE Feedback ADD COLUMN voice TEXT NULL",
      "ALTER TABLE Feedback ADD COLUMN entryDate VARCHAR(32) NULL",
      "ALTER TABLE Feedback ADD COLUMN customerName VARCHAR(255) NULL",
      "ALTER TABLE Feedback ADD COLUMN mobile VARCHAR(32) NULL",

      // Multi-location columns
      "ALTER TABLE users ADD COLUMN location_id INT NULL DEFAULT 2",
      "ALTER TABLE users ADD COLUMN location_code VARCHAR(10) NULL",
      "ALTER TABLE candidates ADD COLUMN location_id INT NOT NULL DEFAULT 2",
      "ALTER TABLE candidates ADD COLUMN location_code VARCHAR(10) NOT NULL DEFAULT 'DAV'",
      "ALTER TABLE interview_schedules ADD COLUMN location_id INT NOT NULL DEFAULT 2",
      "ALTER TABLE interview_tokens ADD COLUMN location_id INT NOT NULL DEFAULT 2",
      "ALTER TABLE hr_evaluations ADD COLUMN location_id INT NOT NULL DEFAULT 2",
      "ALTER TABLE selected_candidates ADD COLUMN location_id INT NOT NULL DEFAULT 2",
      "ALTER TABLE rejected_candidates ADD COLUMN location_id INT NOT NULL DEFAULT 2",
      "ALTER TABLE selection_offers ADD COLUMN location_id INT NOT NULL DEFAULT 2",
      "ALTER TABLE onboarding_records ADD COLUMN location_id INT NOT NULL DEFAULT 2",
      "ALTER TABLE candidate_activities ADD COLUMN location_id INT NOT NULL DEFAULT 2",
      "ALTER TABLE department_hiring_targets ADD COLUMN location_id INT NOT NULL DEFAULT 2",
      "ALTER TABLE section_allocations ADD COLUMN location_id INT NOT NULL DEFAULT 2",
      "ALTER TABLE department_sections ADD COLUMN location_id INT NOT NULL DEFAULT 2",

      // User Management module columns
      "ALTER TABLE users ADD COLUMN max_modules INT NULL DEFAULT NULL",
      "ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL",
      "ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
      "CREATE TABLE IF NOT EXISTS `user_locations` (`id` INT AUTO_INCREMENT PRIMARY KEY, `user_id` INT NOT NULL, `location_id` INT NOT NULL, `assigned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY `user_location_idx` (`user_id`, `location_id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    ];

    for (const sql of migrations) {
      try {
        await connection.query(sql);
      } catch (err) {
        // Ignore duplicate column errors
        if (err.code !== 'ER_DUP_FIELDNAME') {
          logDebug(`[Migration Warning]:`, err.message);
        }
      }
    }
    // ------------------

    // Seed default admin users including admin@bsctextiles.com / admin@2026 & greeter@bsctextiles.com / bsc@123
    // Seeding is INSERT-only for staff accounts so password changes made in the
    // Settings module survive restarts. The master admin account is force-reset
    // because it is the documented recovery credential for this deployment.
    try {
      const hashedPassAdmin2026 = await bcrypt.hash('admin@2026', 10);
      const hashedPassAdmin = await bcrypt.hash('admin123', 10);
      const hashedPassGreeter = await bcrypt.hash('bsc@123', 10);

      // Seed in `users` table (insert-only: existing passwords are never overwritten)
      await connection.query(
        `INSERT INTO users (username, email, password, full_name, role, active) VALUES
         ('admin@bsctextiles.com', 'admin@bsctextiles.com', ?, 'System Administrator', 'Admin', TRUE),
         ('admin', 'admin@bsctextiles.com', ?, 'System Administrator', 'Admin', TRUE),
         ('hr', 'hr@bsctextiles.com', ?, 'HR Manager', 'HR', TRUE),
         ('manager', 'manager@bsctextiles.com', ?, 'Store Manager', 'Manager', TRUE),
         ('greeter@bsctextiles.com', 'greeter@bsctextiles.com', ?, 'Greeter Staff', 'Greeter', TRUE),
         ('greeter', 'greeter@bsctextiles.com', ?, 'Greeter Staff', 'Greeter', TRUE)
         ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), active = TRUE`,
        [hashedPassAdmin2026, hashedPassAdmin2026, hashedPassAdmin, hashedPassAdmin, hashedPassGreeter, hashedPassGreeter]
      );

      // Seed in `User` table (if User table exists)
      try {
        await connection.query(
          `INSERT INTO User (roleId, username, email, password, fullName, role, status) VALUES
           (2, 'admin@bsctextiles.com', 'admin@bsctextiles.com', ?, 'System Administrator', 'Admin', 'Active')
           ON DUPLICATE KEY UPDATE status = 'Active'`,
          [hashedPassAdmin2026]
        );
      } catch (e) {}

      // Seed default company setting for Davangere
      try {
        await connection.query(
          `INSERT INTO Setting (settingKey, settingValue, category) VALUES
           ('company_name', 'BSC EXCLUSIVE DAVANAGERE', 'General')
           ON DUPLICATE KEY UPDATE settingValue = 'BSC EXCLUSIVE DAVANAGERE'`
        );
      } catch(e) {}

      // Force update existing admin rows in both users and User tables
      try {
        await connection.query(
          `UPDATE users SET password = ?, active = TRUE 
           WHERE LOWER(username) IN ('admin@bsctextiles.com', 'admin') OR LOWER(email) = 'admin@bsctextiles.com'`,
          [hashedPassAdmin2026]
        );
      } catch (e) {}

      try {
        await connection.query(
          `UPDATE User SET password = ?, status = 'Active' 
           WHERE LOWER(username) IN ('admin@bsctextiles.com', 'admin') OR LOWER(email) = 'admin@bsctextiles.com'`,
          [hashedPassAdmin2026]
        );
      } catch (e) {}

      logDebug(`[Auto DB Initializer] Admin user seeded (admin@bsctextiles.com - Password: admin@2026)`);
    } catch (err) {
      logDebug(`[Auto DB Initializer User Seed Warning]:`, err.message);
    }

    // Seed default designations if empty or missing
    const defaultRoles = [
      'Store Head', 'Operations Manager', 'Department Manager', 'Floor Manager',
      'Section Supervisor', 'Senior Sales Staff', 'Junior Sales Staff', 'Helpers / Trainees',
      'Cashiers', 'Customer Care / Help Desk', 'Reception', 'Gift Wrapping',
      'Warehouse (Receiving, Bundling, Replenishment)', 'Receiving & GRN', 'Dispatch (Online/B2B, if any)',
      'Stock Audit / Loss Prevention', 'Visual Merchandising', 'HR', 'Admin', 'Accounts',
      'IT / CCTV / POS Support', 'Maintenance (Electrician, Plumbing, Lift AMC liaison)',
      'Housekeeping', 'Security', 'Cafeteria Staff', 'Parking Attendants', 'Drivers'
    ];
    for (const r of defaultRoles) {
      try {
        await connection.query(`INSERT IGNORE INTO designations (name) VALUES (?)`, [r]);
      } catch(e) {}
    }

    // Seed default page_visibility rows (allow all by default for all roles)
    try {
      const defaultVisibility = [
        ['HR_dashboard', 'HR', 'dashboard', true],
        ['HR_candidates', 'HR', 'candidates', true],
        ['HR_interview', 'HR', 'interview', true],
        ['HR_offer', 'HR', 'offer', true],
        ['HR_onboarding', 'HR', 'onboarding', true],
        ['HR_exit', 'HR', 'exit', true],
        ['HR_employees', 'HR', 'employees', true],
        ['HR_settings', 'HR', 'settings', false],
        ['HR_dept-hiring', 'HR', 'dept-hiring', true],
        ['Manager_dashboard', 'Manager', 'dashboard', true],
        ['Manager_candidates', 'Manager', 'candidates', true],
        ['Manager_interview', 'Manager', 'interview', true],
        ['Manager_offer', 'Manager', 'offer', false],
        ['Manager_onboarding', 'Manager', 'onboarding', true],
        ['Manager_exit', 'Manager', 'exit', true],
        ['Manager_employees', 'Manager', 'employees', true],
        ['Manager_settings', 'Manager', 'settings', false],
        ['Manager_dept-hiring', 'Manager', 'dept-hiring', true],
        ['Admin_dashboard', 'Admin', 'dashboard', true],
        ['Admin_candidates', 'Admin', 'candidates', true],
        ['Admin_interview', 'Admin', 'interview', true],
        ['Admin_offer', 'Admin', 'offer', true],
        ['Admin_onboarding', 'Admin', 'onboarding', true],
        ['Admin_exit', 'Admin', 'exit', true],
        ['Admin_employees', 'Admin', 'employees', true],
        ['Admin_settings', 'Admin', 'settings', true],
        ['Admin_dept-hiring', 'Admin', 'dept-hiring', true]
      ];
      for (const [key, role, page, allowed] of defaultVisibility) {
        await connection.query(
          `INSERT INTO page_visibility (role_page_key, role, page_key, allowed)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE allowed = allowed`,
          [key, role, page, allowed ? 1 : 0]
        );
      }
      logDebug(`[Auto DB Initializer] page_visibility seeded with defaults`);
    } catch(e) {
      logDebug(`[Auto DB Initializer] page_visibility seed warning:`, e.message);
    }

    // ------------------
    // Module 1 & 2 Tables Initialization (Non-Breaking)
    // ------------------
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS department_hiring_targets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          department VARCHAR(100) NOT NULL,
          section VARCHAR(100) NOT NULL,
          designation VARCHAR(100) NOT NULL,
          required_openings INT DEFAULT 10,
          hiring_target INT DEFAULT 10,
          remarks TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY dept_sec_desig (department, section, designation)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS section_allocations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          employee_id VARCHAR(100) NOT NULL UNIQUE,
          app_no VARCHAR(100),
          employee_name VARCHAR(200),
          department VARCHAR(100),
          section VARCHAR(100),
          assigned_by VARCHAR(100),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS department_sections (
          id INT AUTO_INCREMENT PRIMARY KEY,
          department VARCHAR(100) NOT NULL,
          section_name VARCHAR(100) NOT NULL,
          description VARCHAR(255),
          active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY dept_sec (department, section_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      const [secRows] = await connection.query(`SELECT COUNT(*) as cnt FROM department_sections`);
      if (secRows[0].cnt === 0) {
        const initialSections = [
          ['Mens', 'Ethnic Wear'], ['Mens', 'Brands'], ['Mens', 'Mid'], ['Mens', 'Economic'], ['Mens', 'Undergarments'], ['Mens', 'Watch & Accessories'], ['Mens', 'Suiting & Shirting'], ['Mens', 'Luggage'],
          ['Ladies', 'Ethnic Wear'], ['Ladies', 'Mix & Match'], ['Ladies', 'Western'], ['Ladies', 'Undergarments & Nightwear'], ['Ladies', 'Jewellery Set'], ['Ladies', 'Bridal Wear'], ['Ladies', 'Accessories'], ['Ladies', 'Dress Material'], ['Ladies', 'Blouses'],
          ['Kids', 'Boys'], ['Kids', 'Girls'], ['Kids', 'Newborn'], ['Kids', 'Infants'], ['Kids', 'Boys Accessories'], ['Kids', 'Undergarments'],
          ['First Floor Saree', 'Silk'], ['First Floor Saree', 'Art & Mix'], ['First Floor Saree', 'Designer'], ['First Floor Saree', 'Cotton'],
          ['Ground Floor Saree', 'Synthetic'], ['Ground Floor Saree', 'Cotton'], ['Ground Floor Saree', 'Silk'], ['Ground Floor Saree', 'Art & Raw'], ['Ground Floor Saree', 'Fancy'], ['Ground Floor Saree', 'Others / Remaining'],
          ['Home Furnishing', 'Full Home Furnishing'],
          ['Others', 'General']
        ];

        for (const [dept, sec] of initialSections) {
          await connection.query(
            `INSERT IGNORE INTO department_sections (department, section_name) VALUES (?, ?)`,
            [dept, sec]
          );
        }
        logDebug(`[Auto DB Initializer] Seeded initial BSC Textiles department sections`);
      }

      // Seed Sections table for Sourcing Diverts & CRM
      await connection.query(`
        CREATE TABLE IF NOT EXISTS Sections (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(150) NOT NULL UNIQUE,
          sectionType VARCHAR(50) DEFAULT 'retail',
          manager VARCHAR(150) NULL,
          isActive TINYINT(1) DEFAULT 1
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      const crmSections = [
        ['sec_1', 'Ground Floor Saree', 'retail', 'Ground Floor Saree Incharge'],
        ['sec_2', '1st Floor Saree', 'retail', '1st Floor Saree Manager'],
        ['sec_3', 'Ladies', 'retail', 'Ladies Wear Lead'],
        ['sec_4', 'Kids', 'retail', 'Kids Section Incharge'],
        ['sec_5', 'Mens', 'retail', 'Menswear Manager']
      ];

      for (const [id, name, st, mgr] of crmSections) {
        await connection.query(`
          INSERT INTO Sections (id, name, sectionType, manager, isActive)
          VALUES (?, ?, ?, ?, TRUE)
          ON DUPLICATE KEY UPDATE name = VALUES(name), isActive = TRUE
        `, [id, name, st, mgr]);
      }

      // Seed FeedbackQuestions table for Customer Experience Survey
      await connection.query(`
        CREATE TABLE IF NOT EXISTS FeedbackQuestions (
          id VARCHAR(64) PRIMARY KEY,
          question TEXT NOT NULL,
          options TEXT NOT NULL,
          position INT DEFAULT 1,
          isActive TINYINT(1) DEFAULT 1
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      const defaultQuestions = [
        ['q1', '1. How satisfied are you with your overall shopping experience today?', JSON.stringify(['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very dissatisfied']), 1],
        ['q2', '2. Did you find the product you were looking for?', JSON.stringify(['Yes, exactly', 'Yes, with assistance', 'Partially', 'No']), 2],
        ['q3', '3. How would you rate the quality & variety of our collection?', JSON.stringify(['Excellent', 'Good', 'Average', 'Poor']), 3],
        ['q4', '4. How would you rate the behavior and helpfulness of our staff?', JSON.stringify(['Extremely helpful', 'Helpful', 'Average', 'Poor']), 4],
        ['q5', '5. How likely are you to recommend BSC Exclusive to your friends and family?', JSON.stringify(['Definitely recommend', 'Probably recommend', 'Neutral', 'Not recommend']), 5]
      ];

      // Reset old questions position mapping
      await connection.query(`DELETE FROM FeedbackQuestions WHERE id NOT IN ('q1', 'q2', 'q3', 'q4', 'q5')`).catch(() => {});

      for (const [id, q, opts, pos] of defaultQuestions) {
        await connection.query(`
          INSERT INTO FeedbackQuestions (id, question, options, position, isActive)
          VALUES (?, ?, ?, ?, TRUE)
          ON DUPLICATE KEY UPDATE question = VALUES(question), options = VALUES(options), position = VALUES(position), isActive = TRUE
        `, [id, q, opts, pos]);
      }

      // Ensure Feedback and CallQueue tables exist with full column schemas
      await connection.query(`
        CREATE TABLE IF NOT EXISTS Feedback (
          id VARCHAR(64) PRIMARY KEY,
          date VARCHAR(32) NULL,
          source VARCHAR(32) DEFAULT 'qr',
          area VARCHAR(150) NULL,
          yourVoice TEXT NULL,
          custName VARCHAR(255) NULL,
          custMobile VARCHAR(32) NULL,
          custDob VARCHAR(32) NULL,
          q0 VARCHAR(255) NULL, q0_other VARCHAR(255) NULL,
          q1 VARCHAR(255) NULL, q1_other VARCHAR(255) NULL,
          q2 VARCHAR(255) NULL, q2_other VARCHAR(255) NULL,
          q3 VARCHAR(255) NULL, q3_other VARCHAR(255) NULL,
          q4 VARCHAR(255) NULL, q4_other VARCHAR(255) NULL,
          q5 VARCHAR(255) NULL, q5_other VARCHAR(255) NULL,
          q6 VARCHAR(255) NULL, q6_other VARCHAR(255) NULL,
          q7 VARCHAR(255) NULL, q7_other VARCHAR(255) NULL,
          status VARCHAR(32) DEFAULT 'new',
          actionTaken TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL,
          isNegative TINYINT(1) DEFAULT 0,
          answers TEXT NULL,
          voice TEXT NULL,
          entryDate VARCHAR(32) NULL,
          customerName VARCHAR(255) NULL,
          mobile VARCHAR(32) NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Auto-heal / synchronize existing rows between legacy and modern columns
      await connection.query(`UPDATE Feedback SET customerName = custName WHERE (customerName IS NULL OR customerName = '') AND custName IS NOT NULL AND custName != ''`).catch(() => {});
      await connection.query(`UPDATE Feedback SET custName = customerName WHERE (custName IS NULL OR custName = '') AND customerName IS NOT NULL AND customerName != ''`).catch(() => {});
      await connection.query(`UPDATE Feedback SET mobile = custMobile WHERE (mobile IS NULL OR mobile = '') AND custMobile IS NOT NULL AND custMobile != ''`).catch(() => {});
      await connection.query(`UPDATE Feedback SET custMobile = mobile WHERE (custMobile IS NULL OR custMobile = '') AND mobile IS NOT NULL AND mobile != ''`).catch(() => {});
      await connection.query(`UPDATE Feedback SET voice = yourVoice WHERE (voice IS NULL OR voice = '') AND yourVoice IS NOT NULL AND yourVoice != ''`).catch(() => {});
      await connection.query(`UPDATE Feedback SET yourVoice = voice WHERE (yourVoice IS NULL OR yourVoice = '') AND voice IS NOT NULL AND voice != ''`).catch(() => {});
      await connection.query(`UPDATE Feedback SET entryDate = COALESCE(NULLIF(entryDate, ''), STR_TO_DATE(date, '%d/%m/%Y'), DATE(created_at)) WHERE entryDate IS NULL OR entryDate = ''`).catch(() => {});
      await connection.query(`UPDATE Feedback SET date = entryDate WHERE (date IS NULL OR date = '') AND entryDate IS NOT NULL AND entryDate != ''`).catch(() => {});

      await connection.query(`
        CREATE TABLE IF NOT EXISTS CallQueue (
          id VARCHAR(64) PRIMARY KEY,
          feedbackId VARCHAR(64),
          entryDate VARCHAR(16),
          customerName VARCHAR(255),
          mobile VARCHAR(32),
          status VARCHAR(32) DEFAULT 'new',
          notes TEXT,
          attempts INT DEFAULT 0,
          followUpDate VARCHAR(32),
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      const [fbCountRows] = await connection.query(`SELECT COUNT(*) as cnt FROM Feedback`);
      if (fbCountRows && fbCountRows[0] && fbCountRows[0].cnt === 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        const initialFeedbacks = [
          ['fb_demo_1', todayStr, 'Ramesh Kumar', '9876543210', 'sec_1', JSON.stringify({ q1: 'Very satisfied', q2: 'Yes, exactly', q3: 'Excellent', q4: 'Extremely helpful', q5: 'Definitely recommend' }), 'Liked Most: Excellent saree collection & courteous staff assistance.', 'qr', 0],
          ['fb_demo_2', todayStr, 'Anita Patil', '9845012345', 'sec_3', JSON.stringify({ q1: 'Satisfied', q2: 'Yes, with assistance', q3: 'Good', q4: 'Helpful', q5: 'Probably recommend' }), 'Liked Most: Good variety in ladies wear section.', 'qr', 0],
          ['fb_demo_3', todayStr, 'Suresh Gowda', '9741234567', 'sec_5', JSON.stringify({ q1: 'Neutral', q2: 'Partially', q3: 'Average', q4: 'Average', q5: 'Neutral' }), 'Can Improve: Need more size variations in mens suits.', 'qr', 0]
        ];

        for (const [id, ed, cn, mob, sec, ans, vc, src, isNeg] of initialFeedbacks) {
          await connection.query(`
            INSERT IGNORE INTO Feedback (id, entryDate, customerName, mobile, sectionId, answers, voice, source, isNegative)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [id, ed, cn, mob, sec, ans, vc, src, isNeg]);
        }
        logDebug(`[Auto DB Initializer] Seeded initial customer feedback collection entries`);
      }

      logDebug(`[Auto DB Initializer] Verified Sections & FeedbackQuestions tables`);
    } catch (e) {
      logDebug(`[Auto DB Initializer Warning for new modules]:`, e.message);
    }

    // ── Daily MCheck (Daily Management Checklist) Tables ─────────────────
    try {
      // Modules table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS mcheck_modules (
          id INT AUTO_INCREMENT PRIMARY KEY,
          module_name VARCHAR(150) NOT NULL,
          module_key VARCHAR(100) NOT NULL UNIQUE,
          description TEXT NULL,
          sort_order INT DEFAULT 0,
          responsible_department VARCHAR(150) NULL,
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Checklists table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS mcheck_checklists (
          id INT AUTO_INCREMENT PRIMARY KEY,
          module_id INT NOT NULL,
          checklist_name VARCHAR(255) NOT NULL,
          description TEXT NULL,
          sort_order INT DEFAULT 0,
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (module_id) REFERENCES mcheck_modules(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Checkpoints table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS mcheck_checkpoints (
          id INT AUTO_INCREMENT PRIMARY KEY,
          checklist_id INT NOT NULL,
          module_id INT NOT NULL,
          checkpoint_title VARCHAR(255) NOT NULL,
          checkpoint_description TEXT NULL,
          responsible_department VARCHAR(150) NULL,
          responsible_person VARCHAR(150) NULL,
          scheduled_time VARCHAR(50) NULL,
          photo_required TINYINT(1) DEFAULT 0,
          sort_order INT DEFAULT 0,
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (checklist_id) REFERENCES mcheck_checklists(id) ON DELETE CASCADE,
          FOREIGN KEY (module_id) REFERENCES mcheck_modules(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Daily responses table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS mcheck_responses (
          id INT AUTO_INCREMENT PRIMARY KEY,
          checkpoint_id INT NOT NULL,
          checklist_id INT NOT NULL,
          module_id INT NOT NULL,
          response_date DATE NOT NULL,
          system_status ENUM('PENDING','IN_PROGRESS','DONE','NOT_DONE','POSTPONED') DEFAULT 'PENDING',
          compliance_status VARCHAR(100) NULL,
          accuracy VARCHAR(100) NULL,
          remarks TEXT NULL,
          corrective_action TEXT NULL,
          photo_url TEXT NULL,
          is_draft TINYINT(1) DEFAULT 1,
          submitted_by VARCHAR(150) NULL,
          submitted_at DATETIME NULL,
          updated_by VARCHAR(150) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_checkpoint_date (checkpoint_id, response_date),
          FOREIGN KEY (checkpoint_id) REFERENCES mcheck_checkpoints(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Audit log table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS mcheck_audit_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          response_id INT NOT NULL,
          checkpoint_id INT NOT NULL,
          response_date DATE NOT NULL,
          changed_by VARCHAR(150) NOT NULL,
          prev_status VARCHAR(50) NULL,
          new_status VARCHAR(50) NULL,
          prev_remarks TEXT NULL,
          new_remarks TEXT NULL,
          prev_compliance VARCHAR(100) NULL,
          new_compliance VARCHAR(100) NULL,
          change_type VARCHAR(50) DEFAULT 'update',
          changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Seed modules, checklists, and checkpoints if not already present
        // Upsert 6 modules
        const modules = [
          [1, 'CRM', 'crm', 'Customer Relationship Management daily operations', 1, 'CRM'],
          [2, 'Warehouse & Purchase', 'warehouse_purchase', 'Warehouse & purchase management operations', 2, 'Warehouse & Purchase'],
          [3, 'Sales', 'sales', 'Daily sales tracking & performance review', 3, 'Sales'],
          [4, 'HR', 'hr', 'Human resources daily management tasks', 4, 'HR'],
          [5, 'Accounts', 'accounts', 'Daily accounts & finance verification', 5, 'Accounts'],
          [6, 'Database', 'database', 'System & database integrity checks', 6, 'Database']
        ];
        for (const [id, name, key, desc, order, dept] of modules) {
          await connection.query(
            `INSERT INTO mcheck_modules (id, module_name, module_key, description, sort_order, responsible_department, is_active)
             VALUES (?, ?, ?, ?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE module_name = VALUES(module_name), module_key = VALUES(module_key),
                                     description = VALUES(description), sort_order = VALUES(sort_order),
                                     responsible_department = VALUES(responsible_department), is_active = 1`,
            [id, name, key, desc, order, dept]
          );
        }

        // Upsert checklists (one per module)
        const checklists = [
          [1, 1, 'CRM Daily Checklist', 'Daily CRM operational checkpoints', 1],
          [2, 2, 'Warehouse & Purchase Daily Checklist', 'Daily warehouse & purchase checkpoints', 1],
          [3, 3, 'Sales Daily Checklist', 'Daily sales management checkpoints', 1],
          [4, 4, 'HR Daily Checklist', 'Daily HR management checkpoints', 1],
          [5, 5, 'Accounts Daily Checklist', 'Daily accounts reconciliation checkpoint', 1],
          [6, 6, 'Database Daily Checklist', 'Daily system & database checks', 1]
        ];
        for (const [id, modId, name, desc, order] of checklists) {
          await connection.query(
            `INSERT INTO mcheck_checklists (id, module_id, checklist_name, description, sort_order, is_active)
             VALUES (?, ?, ?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE module_id = VALUES(module_id), checklist_name = VALUES(checklist_name),
                                     description = VALUES(description), sort_order = VALUES(sort_order), is_active = 1`,
            [id, modId, name, desc, order]
          );
        }

        // Exact 40 checkpoints across 6 modules
        const checkpoints = [
          // CRM — Module 1 (7 checkpoints)
          [1,  1, 1, 'Footfall Data Collection', 'Ensure the footfall data was collected on a regular basis and updated in the app on a timely basis', 'CRM', 'CRM Executive', '11:00 AM', 1],
          [2,  1, 1, 'Divert Collection', 'Verify that all sourcing diverts were collected and registered accurately with proper department tags', 'CRM', 'CRM Executive', '1:00 PM', 2],
          [3,  1, 1, 'Customer Feedback', 'Confirm that customer feedback was collected, entered in the system and categorised by section', 'CRM', 'CRM Executive', '3:00 PM', 3],
          [4,  1, 1, 'Negative Feedback Action', 'Review all negative feedback and ensure corrective actions have been assigned and communicated to relevant sections', 'CRM', 'CRM Executive', '4:00 PM', 4],
          [5,  1, 1, 'DER Sharing', 'Ensure the Daily Exception Report (DER) was prepared and shared with management on time', 'CRM', 'CRM Executive', '6:00 PM', 5],
          [6,  1, 1, 'VM Checklist', 'Confirm that the Visual Merchandising checklist was completed and submitted by the VM team', 'CRM', 'VM Incharge', '11:00 AM', 6],
          [7,  1, 1, 'Daily 10 Minutes CRM Meeting', 'Confirm that the daily 10-minute CRM review meeting was conducted with the relevant team members', 'CRM', 'CRM Lead', '10:30 AM', 7],

          // Warehouse & Purchase — Module 2 (9 checkpoints)
          [8,  2, 2, 'Bundle Inward Register', 'Verify bundle inward register entries for all arriving shipments and goods received', 'Warehouse & Purchase', 'Warehouse Incharge', '11:00 AM', 1],
          [9,  2, 2, 'Bundle Outward Register', 'Verify bundle outward register entries for all dispatched goods and outgoing transfers', 'Warehouse & Purchase', 'Warehouse Incharge', '1:00 PM', 2],
          [10, 2, 2, 'Stock transfer register', 'Verify stock transfer register records for inter-department and inter-branch movements', 'Warehouse & Purchase', 'Warehouse Incharge', '2:00 PM', 3],
          [11, 2, 2, 'Warehouse Whiteboard', 'Review warehouse whiteboard status, target updates, and dispatch schedule notes', 'Warehouse & Purchase', 'Warehouse Incharge', '10:30 AM', 4],
          [12, 2, 2, 'Datasheet', 'Verify warehouse & purchase datasheet updates and inventory synchronization records', 'Warehouse & Purchase', 'Purchase Incharge', '3:00 PM', 5],
          [13, 2, 2, 'Purchase Entry Checklist', 'Complete purchase entry checklist and reconcile purchase receipts with vendor invoices', 'Warehouse & Purchase', 'Purchase Incharge', '4:00 PM', 6],
          [14, 2, 2, 'Warehouse Seals', 'Inspect and document warehouse seals security integrity and seal numbers log', 'Warehouse & Purchase', 'Security / Warehouse', '10:00 AM', 7],
          [15, 2, 2, 'Warehouse & Purchase DER', 'Compile and share Daily Exception Report (DER) for Warehouse & Purchase operations', 'Warehouse & Purchase', 'Warehouse & Purchase Head', '6:00 PM', 8],
          [16, 2, 2, 'Item Wanted Register', 'Review item wanted register and ensure fast-moving and requested items are flagged for procurement', 'Warehouse & Purchase', 'Purchase Team', '5:00 PM', 9],

          // Sales — Module 3 (9 checkpoints)
          [17, 3, 3, 'Store operational Checklist', 'Execute store operational checklist across all floors and retail sections', 'Sales', 'Floor Manager', '10:00 AM', 1],
          [18, 3, 3, 'Sales Return Register', 'Review sales return register and verify credit notes and customer return reasons', 'Sales', 'Floor Manager', '1:00 PM', 2],
          [19, 3, 3, 'Sales DER', 'Prepare and circulate Sales Daily Exception Report (DER) to management and department heads', 'Sales', 'Sales Manager', '6:00 PM', 3],
          [20, 3, 3, 'Paid Parcel Register', 'Verify paid parcel register entries for all dispatched and collected customer parcels', 'Sales', 'Dispatch / Sales', '4:00 PM', 4],
          [21, 3, 3, 'M-Check need to be fill', 'Ensure all section in-charges complete and submit their respective floor M-Check records', 'Sales', 'Sales Supervisor', '11:00 AM', 5],
          [22, 3, 3, 'Sales Target to be discussed and prepared', 'Discuss, prepare, and allocate daily sales targets across floor sections and teams', 'Sales', 'Sales Manager', '10:30 AM', 6],
          [23, 3, 3, 'Sales Training program conducted', 'Conduct scheduled sales training program and brief sales staff on product knowledge', 'Sales', 'Sales Trainer', '11:30 AM', 7],
          [24, 3, 3, 'Sales Training Tracking Assesment follow', 'Follow up on sales training tracking assessment scores and staff performance feedback', 'Sales', 'Sales Trainer', '4:00 PM', 8],
          [25, 3, 3, 'Old Stock report prepare and circulate to the all floor', 'Prepare old stock report and circulate to all floor sections for targeted clearance', 'Sales', 'Floor Manager', '5:00 PM', 9],

          // HR — Module 4 (12 checkpoints)
          [26, 4, 4, 'HR Candidate Sheet', 'Review HR candidate sheet, track interview status, and update applicant logs', 'HR', 'HR Executive', '11:00 AM', 1],
          [27, 4, 4, 'On Duty Form', 'Verify On Duty (OD) forms submitted by employees and record outdoor work approvals', 'HR', 'HR Executive', '11:30 AM', 2],
          [28, 4, 4, 'Permission Form', 'Review employee permission forms, early leave requests, and short leave approvals', 'HR', 'HR Executive', '12:00 PM', 3],
          [29, 4, 4, 'Restroom Checklist', 'Inspect restroom hygiene and verify housekeeping restroom cleaning checklist sign-offs', 'HR', 'Housekeeping / HR', '10:30 AM', 4],
          [30, 4, 4, 'Floor Cleaning Checklist', 'Inspect all retail and office floors and confirm floor cleaning checklist completion', 'HR', 'Housekeeping / HR', '10:00 AM', 5],
          [31, 4, 4, 'HR DER', 'Compile and share HR Daily Exception Report (DER) with management team', 'HR', 'HR Manager', '6:00 PM', 6],
          [32, 4, 4, 'Timecard - Driver', 'Verify driver timecards, travel logs, and vehicle movement timestamps', 'HR', 'HR Admin', '11:00 AM', 7],
          [33, 4, 4, 'Grievance Tracker', 'Review employee grievance tracker and follow up on open grievances and resolutions', 'HR', 'HR Manager', '3:00 PM', 8],
          [34, 4, 4, 'HR present at the Staff Entrance during employee entry time?', 'Verify HR presence at staff entrance to monitor employee entry, dress code, and punctuality', 'HR', 'HR Executive', '9:30 AM', 9],
          [35, 4, 4, 'Memo & Warning', 'Review memos and warning letters issued, disciplinary records, and staff acknowledgments', 'HR', 'HR Manager', '4:00 PM', 10],
          [36, 4, 4, 'Employee Transfer Form', 'Process employee transfer forms across sections, stores, and departments', 'HR', 'HR Executive', '2:00 PM', 11],
          [37, 4, 4, 'HR Morning Attendance Report update and Share to Whatsapp group before 12:30 Pm', 'Update HR morning attendance report and share to official WhatsApp group before 12:30 PM', 'HR', 'HR Executive', '12:30 PM', 12],

          // Accounts — Module 5 (1 checkpoint)
          [38, 5, 5, 'Due date remainder', 'Review upcoming vendor dues, statutory payments, and send due date reminder schedule', 'Accounts', 'Accounts Officer', '11:00 AM', 1],

          // Database — Module 6 (2 checkpoints)
          [39, 6, 6, 'Item Creation Form', 'Review and process new item creation forms, verify barcode data, and ensure master data accuracy', 'Database', 'Database Administrator', '12:00 PM', 1],
          [40, 6, 6, 'Supplier Validation Form', 'Verify supplier validation forms, GST compliance, and supplier master records integrity', 'Database', 'Database Administrator', '3:00 PM', 2]
        ];

        for (const [id, modId, clId, title, desc, dept, person, time, order] of checkpoints) {
          await connection.query(
            `INSERT INTO mcheck_checkpoints (id, module_id, checklist_id, checkpoint_title, checkpoint_description, responsible_department, responsible_person, scheduled_time, sort_order, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE module_id = VALUES(module_id), checklist_id = VALUES(checklist_id),
                                     checkpoint_title = VALUES(checkpoint_title), checkpoint_description = VALUES(checkpoint_description),
                                     responsible_department = VALUES(responsible_department), responsible_person = VALUES(responsible_person),
                                     scheduled_time = VALUES(scheduled_time), sort_order = VALUES(sort_order), is_active = 1`,
            [id, modId, clId, title, desc, dept, person, time, order]
          );
        }

        // Deactivate any old checkpoints beyond the 40 configured ones
        await connection.query(`UPDATE mcheck_checkpoints SET is_active = 0 WHERE id > 40`).catch(() => {});

        logDebug(`[Auto DB Initializer] Synchronized 6 MCheck modules, 6 checklists, and 40 exact checkpoints`);

      logDebug(`[Auto DB Initializer] MCheck Daily Management Checklist tables ready`);
    } catch (e) {
      logDebug(`[Auto DB Initializer Warning for MCheck tables]:`, e.message);
    }

    // ── Wedding Customer Follow-up CRM Tables ─────────────────
    try {
      await connection.query(`
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
          \`customer_status\` ENUM(
            'New',
            'Follow-up Pending',
            'Contacted',
            'Interested',
            'Shopping Date Confirmed',
            'Visited Store',
            'Converted',
            'Not Interested',
            'No Response',
            'Cancelled',
            'Closed'
          ) NOT NULL DEFAULT 'New',
          \`call_status\` ENUM(
            'Pending',
            'Called',
            'No Answer',
            'Busy',
            'Call Back Requested',
            'Connected',
            'Completed'
          ) NOT NULL DEFAULT 'Pending',
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await connection.query(`
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
          FOREIGN KEY (\`customer_id\`) REFERENCES \`wedding_customers\`(\`id\`) ON DELETE CASCADE,
          INDEX \`idx_call_cust\` (\`customer_id\`),
          INDEX \`idx_call_date\` (\`call_date\`),
          INDEX \`idx_call_loc\` (\`location_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await connection.query(`
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      logDebug(`[Auto DB Initializer] Wedding Customer Follow-up CRM tables verified`);
    } catch (e) {
      logDebug(`[Auto DB Initializer Warning for Wedding CRM tables]:`, e.message);
    }

    // ── Multi-Location Migration (idempotent) ──────────────────
    try {
      const possibleMigDirs = [
        path.join(__dirname, '../database'),
        path.join(__dirname, '../../database'),
        path.join(__dirname, '../../../database'),
        path.join(process.cwd(), 'database'),
        path.join(process.cwd(), 'database'),
      ];
      const migDir = possibleMigDirs.find(d => fs.existsSync(path.join(d, 'migration_location.sql')));
      if (migDir) {
        logDebug(`[Auto DB Initializer] Running location migration...`);
        let migSql = fs.readFileSync(path.join(migDir, 'migration_location.sql'), 'utf8');
        // Strip multi-line comments /* ... */
        migSql = migSql.replace(/\/\*[\s\S]*?\*\//g, '');
        // Strip single-line comments (-- or #)
        migSql = migSql.replace(/^--.*$/gm, '').replace(/^#.*$/gm, '');

        const migStatements = migSql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.toUpperCase().startsWith('SELECT'));

        for (const stmt of migStatements) {
          try {
            await connection.query(stmt);
          } catch (e) {
            // Silently ignore duplicate column, table exists, or index exists errors
            if (
              !e.message.includes('Duplicate') &&
              !e.message.includes('already exists') &&
              !e.message.includes("doesn't exist") &&
              !e.message.includes('ER_DUP_FIELDNAME')
            ) {
              logDebug(`[Location Migration Warning]:`, e.message.slice(0, 120));
            }
          }
        }
        logDebug(`[Auto DB Initializer] Location migration complete`);
      }
    } catch (migErr) {
      logDebug(`[Auto DB Initializer] Location migration warning:`, migErr.message);
    }

    // ── Performance indexes for the highest-traffic queries ─────────────
    // CREATE INDEX has no IF NOT EXISTS in stock MySQL, so each statement is
    // wrapped — an "duplicate key name" error simply means it already exists.
    const perfIndexes = [
      `ALTER TABLE audit_logs ADD INDEX idx_audit_activity (module, action, created_at)`,
      `ALTER TABLE audit_logs ADD INDEX idx_audit_username (username)`,
      `ALTER TABLE wedding_call_logs ADD INDEX idx_call_customer_date (customer_id, call_date)`,
      `ALTER TABLE users ADD INDEX idx_users_location_active (location_id, active)`,
      `ALTER TABLE candidates ADD INDEX idx_candidates_status (status, created_at)`
    ];
    for (const idxSql of perfIndexes) {
      try {
        await connection.query(idxSql);
        logDebug(`[Auto DB Initializer] Perf index added: ${idxSql.substring(12, 80)}`);
      } catch (idxErr) {
        if (idxErr.code !== 'ER_DUP_KEYNAME' && !/duplicate/i.test(idxErr.message || '')) {
          logDebug(`[Auto DB Initializer] Index skipped:`, idxErr.message);
        }
      }
    }

    const [finalTables] = await connection.query(`SHOW TABLES`);
    logDebug(`====================================================`);
    logDebug(`  [Auto DB Initializer] DATABASE FULLY INITIALIZED!`);
    logDebug(`  Total Active Tables: ${finalTables.length}`);
    logDebug(`====================================================`);

    connection.release();
  } catch (err) {
    logDebug(`[Auto DB Initializer ERROR]:`, err.message);
  }
}

module.exports = { autoInitializeDatabase };
