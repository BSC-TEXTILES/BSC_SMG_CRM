/**
 * BSC Enterprise HRMS - Entry Point
 * Hostinger/Passenger: PassengerStartupFile=index.js, PassengerAppType=node
 *
 * Passenger SETS the PORT env var via its preload-timestamp.js script.
 * The app MUST call app.listen(PORT) on Passenger's assigned port.
 * Do NOT hardcode PORT=5000 - Passenger assigns a dynamic port each time.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
// ── Directory References ──────────────────────────────────────────────────────
const APP_ROOT = __dirname;
const SERVER_DIR = path.join(APP_ROOT, 'server');

// ── Load .env as FALLBACK only ────────────────────────────────────────────────
// Passenger injects PORT before this script runs. dotenv NEVER overrides
// already-set process.env values, so Passenger's PORT is always preserved.
// Do NOT add PORT to server/.env or hPanel dashboard!
dotenv.config({ path: path.join(APP_ROOT, '..', '.env') });
dotenv.config({ path: path.join(APP_ROOT, '.env') });
dotenv.config({ path: path.join(SERVER_DIR, '.env') });

// ── Global Crash Handlers ─────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL uncaughtException]', err.code, err.message, err.stack);
  process.exit(1); // Always exit on uncaught exception so Passenger can restart cleanly
});
process.on('unhandledRejection', (reason) => {
  console.error('[CRITICAL unhandledRejection]', reason);
});

// ── Load modules ──────────────────────────────────────────────────────────────
const pool = require('./src/config/db');
const { autoInitializeDatabase } = require('./src/config/dbInitializer');
const apiRoutes = require('./src/routes/api');
const { errorRes } = require('./src/utils/response');
const { authenticate, authorize } = require('./src/middleware/auth');
const { setCsrfCookie, csrfProtection } = require('./src/middleware/csrf');

// ── Express App ───────────────────────────────────────────────────────────────
const app = express();

// Passenger's preload-timestamp.js sets PORT dynamically.
// Use that PORT. For local dev, fallback to 3000.
const PORT = parseInt(process.env.PORT || '3000', 10);

// High-concurrency tuning is applied in src/config/db.js (pool size, keep-alive).

console.log(`[Boot] PORT=${PORT} | DB=${process.env.DB_NAME} | ENV=${process.env.NODE_ENV}`);

app.set('trust proxy', 1);
const isProduction = process.env.NODE_ENV === 'production';
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: isProduction ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false
}));
// Gzip every response (SPA bundle + JSON APIs) — typical 60-70% transfer reduction
app.use(compression({ filter: (req, res) => (req.headers['x-no-compression'] ? false : compression.filter(req, res)) }));
app.use(cors({ origin: '*', credentials: true }));
app.use(cookieParser()); // populates req.cookies for the httpOnly session cookie
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(setCsrfCookie);

// ── Static Uploads ────────────────────────────────────────────────────────────
const primaryUploadsDir = process.env.UPLOAD_DIR || path.join(APP_ROOT, 'uploads');
const parentUploadsDir = path.join(APP_ROOT, '..', 'uploads');
const grandParentUploadsDir = path.join(APP_ROOT, '..', '..', 'uploads');

if (process.env.UPLOAD_DIR) {
  console.log(`[Uploads] Using UPLOAD_DIR from environment: ${primaryUploadsDir}`);
} else {
  console.warn(`[Uploads] WARNING: UPLOAD_DIR not set. Falling back to: ${primaryUploadsDir}`);
  console.warn(`[Uploads] WARNING: Files in this directory may be lost during deployments!`);
  console.warn(`[Uploads] Set UPLOAD_DIR to a persistent path outside the app folder.`);
}


const subdirs = [
  'applicants',
  'candidate-resumes',
  'candidate-photos',
  'employee-documents',
  'offer-letters',
  'relieving-letters',
  'experience-certificates',
  'misc'
];

[primaryUploadsDir, parentUploadsDir, grandParentUploadsDir].forEach((baseDir) => {
  try {
    if (fs.existsSync(baseDir)) {
      subdirs.forEach((sub) => {
        const subPath = path.join(baseDir, sub);
        if (!fs.existsSync(subPath)) fs.mkdirSync(subPath, { recursive: true });
      });
    }
  } catch (e) {}
});

app.use('/uploads', express.static(primaryUploadsDir, { maxAge: '1h', etag: true }));
if (fs.existsSync(parentUploadsDir)) {
  app.use('/uploads', express.static(parentUploadsDir));
}

// Smart Uploads Fallback Handler (prevents 404 for photos & documents across subfolders)
app.get(['/uploads/*', '/candidate-resumes/*', '/candidate-photos/*', '/employee-documents/*', '/:file(*.pdf)', '/:file(*.jpg)', '/:file(*.jpeg)', '/:file(*.png)', '/:file(*.doc)', '/:file(*.docx)'], (req, res, next) => {
  const reqPath = req.params[0] || req.params.file || req.path.replace(/^\//, '');
  const fileName = path.basename(reqPath);
  const candidateAppNo = req.query.appNo || '';

  const possiblePaths = [
    path.join(primaryUploadsDir, 'applicants', candidateAppNo, fileName),
    path.join(primaryUploadsDir, fileName),
    path.join(primaryUploadsDir, 'candidate-resumes', fileName),
    path.join(primaryUploadsDir, 'candidate-photos', fileName),
    path.join(primaryUploadsDir, 'employee-documents', fileName),
    path.join(primaryUploadsDir, 'misc', fileName),

    path.join(parentUploadsDir, 'applicants', candidateAppNo, fileName),
    path.join(parentUploadsDir, fileName),
    path.join(parentUploadsDir, 'candidate-resumes', fileName),
    path.join(parentUploadsDir, 'candidate-photos', fileName),
    path.join(parentUploadsDir, 'employee-documents', fileName),
    path.join(parentUploadsDir, 'misc', fileName),
    
    path.join(grandParentUploadsDir, 'applicants', candidateAppNo, fileName),
    path.join(grandParentUploadsDir, fileName),
    path.join(grandParentUploadsDir, 'candidate-resumes', fileName),
    path.join(grandParentUploadsDir, 'candidate-photos', fileName),
    path.join(grandParentUploadsDir, 'employee-documents', fileName),
    path.join(grandParentUploadsDir, 'misc', fileName)
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return res.sendFile(p);
    }
  }

  next();
});

// ── Brute-Force Protection on Credential Endpoints ───────────────────────────
// 50 attempts / 10 min / IP is generous for humans (office NAT with several
// staff logging in) yet hostile to credential stuffing.
const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // trust proxy is set above; silence v7 startup warning
  message: { success: false, message: 'Too many login attempts. Please try again in a few minutes.', errors: [] }
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // Limit each IP to 500 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { success: false, message: 'Too many requests from this IP, please try again later.', errors: [] }
});

app.use(['/api/auth/login', '/api/auth/verify'], authLimiter);
app.use('/api', globalLimiter);

// ── Health / Diagnostics ──────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'UP', port: PORT, ts: new Date().toISOString() });
});

app.get(['/db-status', '/api/db-status'], async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SHOW TABLES');
    conn.release();
    res.json({ connected: true, tables: rows.length });
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

// ── Destructive Maintenance Endpoints (Admin-only) ───────────────────────────
// These wipe or mutate the schema — they must never be reachable anonymously.
app.get('/api/wipe-db', authenticate, authorize('Admin', 'Super Admin'), async (req, res) => {
  // Two-layer safety: admin token + explicit ?confirm=yes query param.
  if (req.query.confirm !== 'yes') {
    return errorRes(res, 'Destructive action: append ?confirm=yes to confirm the wipe', [], 400);
  }
  const tables = ['candidates','interview_schedules','candidate_activities','hr_evaluations',
    'interview_tokens','selected_candidates','rejected_candidates',
    'selection_offers','onboarding_records','onboarding_items'];
  for (const t of tables) {
    try { await pool.query(`DELETE FROM \`${t}\``); } catch(e) {}
  }
  res.json({ success: true });
});

// ── Self-Healing DB Migration ─────────────────────────────────────────────────
// Hit /api/fix-db-schema once (as an authenticated Admin) to create any missing tables on the live server
app.get('/api/fix-db-schema', authenticate, authorize('Admin', 'Super Admin'), async (req, res) => {
  const results = [];
  try {
    const conn = await pool.getConnection();
    const migrations = [
      `CREATE TABLE IF NOT EXISTS \`page_visibility\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`role_page_key\` VARCHAR(200) NOT NULL UNIQUE,
        \`role\` VARCHAR(100) NOT NULL,
        \`page_key\` VARCHAR(100) NOT NULL,
        \`allowed\` BOOLEAN DEFAULT TRUE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS \`department_sections\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`department\` VARCHAR(100) NOT NULL,
        \`section_name\` VARCHAR(100) NOT NULL,
        \`description\` VARCHAR(255),
        \`active\` BOOLEAN DEFAULT TRUE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`dept_sec\` (\`department\`, \`section_name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS \`department_hiring_targets\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`department\` VARCHAR(100) NOT NULL,
        \`section\` VARCHAR(100) NOT NULL,
        \`designation\` VARCHAR(100) NOT NULL,
        \`required_openings\` INT DEFAULT 10,
        \`hiring_target\` INT DEFAULT 10,
        \`remarks\` TEXT,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`dept_sec_desig\` (\`department\`, \`section\`, \`designation\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `INSERT IGNORE INTO \`locations\` (\`id\`, \`location_code\`, \`location_name\`, \`sort_order\`, \`status\`) VALUES
       (1, 'BEL', 'Belagavi', 1, 'Active'),
       (2, 'DAV', 'Davanagere', 2, 'Active'),
       (3, 'SHI', 'Shivamogga', 3, 'Active')`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS location_id INT NULL DEFAULT 2`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS location_code VARCHAR(10) NULL`,
      `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS location_id INT NOT NULL DEFAULT 2`,
      `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS location_code VARCHAR(10) NOT NULL DEFAULT 'DAV'`,
      `CREATE TABLE IF NOT EXISTS \`wedding_customers\` (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS \`wedding_call_logs\` (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS \`wedding_audit_logs\` (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    ];
    for (const sql of migrations) {
      try {
        await conn.query(sql);
        results.push({ ok: true, sql: sql.substring(0, 60) });
      } catch (e) {
        results.push({ ok: false, sql: sql.substring(0, 60), error: e.message });
      }
    }
    // Seed default page_visibility rows (idempotent)
    const defaultVisibility = [
      ['HR_dashboard','HR','dashboard',true],['HR_candidates','HR','candidates',true],
      ['HR_interview','HR','interview',true],['HR_offer','HR','offer',true],
      ['HR_onboarding','HR','onboarding',true],['HR_exit','HR','exit',true],
      ['HR_employees','HR','employees',true],['HR_settings','HR','settings',false],
      ['HR_dept-hiring','HR','dept-hiring',true],
      ['Manager_dashboard','Manager','dashboard',true],['Manager_candidates','Manager','candidates',true],
      ['Manager_interview','Manager','interview',true],['Manager_offer','Manager','offer',false],
      ['Manager_onboarding','Manager','onboarding',true],['Manager_exit','Manager','exit',true],
      ['Manager_employees','Manager','employees',true],['Manager_settings','Manager','settings',false],
      ['Manager_dept-hiring','Manager','dept-hiring',true],
      ['Admin_dashboard','Admin','dashboard',true],['Admin_candidates','Admin','candidates',true],
      ['Admin_interview','Admin','interview',true],['Admin_offer','Admin','offer',true],
      ['Admin_onboarding','Admin','onboarding',true],['Admin_exit','Admin','exit',true],
      ['Admin_employees','Admin','employees',true],['Admin_settings','Admin','settings',true],
      ['Admin_dept-hiring','Admin','dept-hiring',true],
      ['HR_wedding_crm','HR','wedding_crm',true],
      ['Manager_wedding_crm','Manager','wedding_crm',true],
      ['Admin_wedding_crm','Admin','wedding_crm',true],
      ['Super Admin_wedding_crm','Super Admin','wedding_crm',true]
    ];
    for (const [key, role, page, allowed] of defaultVisibility) {
      try {
        await conn.query(
          `INSERT INTO page_visibility (role_page_key, role, page_key, allowed) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE allowed=allowed`,
          [key, role, page, allowed ? 1 : 0]
        );
      } catch(e) {}
    }
    conn.release();
    res.json({ success: true, message: 'Schema fix complete. Missing tables created.', results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api', csrfProtection, apiRoutes);

// ── Frontend SPA ──────────────────────────────────────────────────────────────
const distDir = path.join(APP_ROOT, 'dist');
// Favicon & Icon static route handler (prevents 503 / 404 errors on live server)
app.get(['/favicon.ico', '/favicon.png', '/logo.png'], (req, res) => {
  const iconName = path.basename(req.path);
  const possiblePaths = [
    path.join(distDir, iconName),
    path.join(APP_ROOT, '..', 'frontend', 'public', iconName),
    path.join(APP_ROOT, '..', 'frontend', 'public', 'favicon.ico'),
    path.join(APP_ROOT, '..', 'frontend', 'public', 'logo.png')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return res.sendFile(p);
    }
  }
  return res.status(204).end();
});

if (fs.existsSync(distDir)) {
  console.log(`[Boot] Serving frontend from: ${distDir}`);
  // Vite emits content-hashed filenames — they are safe to cache forever.
  // This is the single biggest performance win for repeat visitors.
  app.use('/assets', express.static(path.join(distDir, 'assets'), {
    immutable: true,
    maxAge: '1y',
    setHeaders(res) { res.setHeader('X-Content-Hashed', '1'); }
  }));
  app.use(express.static(distDir, {
    etag: true,
    maxAge: '5m',
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache'); // always revalidate the entry point
      }
    }
  }));

  // Assets Fallback: Never return index.html (text/html) for CSS / JS asset requests!
  app.get('/assets/*', (req, res, next) => {
    const assetPath = path.join(distDir, req.path);
    if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
      return res.sendFile(assetPath);
    }
    const ext = path.extname(req.path).toLowerCase();
    const assetsFolder = path.join(distDir, 'assets');
    if (fs.existsSync(assetsFolder)) {
      const files = fs.readdirSync(assetsFolder);
      const match = files.find(f => path.extname(f).toLowerCase() === ext);
      if (match) {
        return res.sendFile(path.join(assetsFolder, match));
      }
    }
    return res.status(404).send('Asset file not found');
  });

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/assets') ||
        req.path.endsWith('.css') || req.path.endsWith('.js') || req.path.endsWith('.ico') || req.path.endsWith('.png') || req.path.endsWith('.svg') ||
        req.path === '/health' || req.path === '/db-status') return next();
    
    const fallback = path.join(distDir, 'index.html');
    if (fs.existsSync(fallback)) return res.sendFile(fallback);
    return next();
  });
} else {
  console.warn('[Boot] No dist/ folder found.');
}

// ── Error Handlers ────────────────────────────────────────────────────────────
app.use('/api/*', (req, res) => errorRes(res, `Not found: ${req.originalUrl}`, [], 404));
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return errorRes(res, 'File exceeds the maximum allowed size of 800 KB.', [], 400);
  }
  if (err.code === 'CSRF_ERROR') {
    return errorRes(res, 'Invalid CSRF token.', [], 403);
  }
  
  const msg = process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message;
  errorRes(res, msg, [], err.status || 500);
});

// ── DB Init ───────────────────────────────────────────────────────────────────
autoInitializeDatabase(pool)
  .then(() => console.log('[Boot] DB init complete'))
  .catch(err => console.error('[Boot] DB init error:', err.message));

// ── START SERVER ──────────────────────────────────────────────────────────────
// Passenger (PassengerAppType=node) REQUIRES app.listen(PORT) to be called.
// Passenger sets PORT via its preload-timestamp.js script before this file runs.
// The listen() call is what signals to Passenger that the app is ready.
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  BSC HRMS running on port ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`====================================================`);
});

server.on('error', (err) => {
  console.error('[Server listen error]', err.code, err.message);
  process.exit(1);
});

module.exports = app;
