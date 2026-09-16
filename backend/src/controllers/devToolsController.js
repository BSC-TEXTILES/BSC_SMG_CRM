/**
 * BSC Textiles Portal — Developer Tools Controller
 * Provides API explorer, health checks, diagnostics, and system information.
 * Only accessible to Admin/Super Admin users.
 * Never exposes environment variables containing passwords, tokens, or secrets.
 */

const pool = require('../config/db');
const { successRes, errorRes } = require('../utils/response');
const auditService = require('../services/auditService');
const os = require('os');
const path = require('path');
const fs = require('fs');

// ── Keys that must never be exposed ─────────────────────────────────
const SECRET_KEYS = ['password', 'pwd', 'secret', 'token', 'key', 'credential', 'api_key', 'apikey',
  'private', 'auth', 'db_password', 'db_pass', 'jwt', 'session_secret', 'encrypt'];

function isSensitiveKey(key) {
  const lk = key.toLowerCase();
  return SECRET_KEYS.some(sk => lk.includes(sk));
}

// ── API Health Check ─────────────────────────────────────────────────
const getApiHealth = async (req, res) => {
  try {
    const start = Date.now();

    // Test database connection
    let dbHealthy = false;
    let dbLatency = 0;
    try {
      const dbStart = Date.now();
      await pool.query('SELECT 1');
      dbLatency = Date.now() - dbStart;
      dbHealthy = true;
    } catch {}

    // Get table count
    let tableCount = 0;
    try {
      const [tables] = await pool.query('SHOW TABLES');
      tableCount = tables.length;
    } catch {}

    await auditService.log({
      req,
      action: auditService.AuditEvents.DEVTOOL_ACCESS,
      module: 'DevTools',
      details: { tool: 'API Health Check' }
    });

    return successRes(res, {
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      api: { healthy: true, latency: Date.now() - start },
      database: { healthy: dbHealthy, latency: dbLatency, tables: tableCount },
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
      }
    }, 'Health check passed');
  } catch (err) {
    return errorRes(res, 'Health check failed', [err.message], 500);
  }
};

// ── Database Health ──────────────────────────────────────────────────
const getDbHealth = async (req, res) => {
  try {
    const conn = await pool.getConnection();

    // Table list
    const [tables] = await conn.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);

    // Row counts for key tables
    const rowCounts = {};
    for (const t of ['users', 'audit_logs', 'candidates', 'locations', 'user_permissions', 'designations', 'interview_questions', 'page_visibility']) {
      try {
        if (tableNames.some(tn => tn.toLowerCase() === t.toLowerCase())) {
          const [[{ cnt }]] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${t}\``);
          rowCounts[t] = cnt;
        }
      } catch {}
    }

    // Pool status
    const poolInfo = {
      threadId: conn.threadId
    };

    conn.release();

    await auditService.log({
      req,
      action: auditService.AuditEvents.DEVTOOL_ACCESS,
      module: 'DevTools',
      details: { tool: 'Database Health' }
    });

    return successRes(res, {
      connected: true,
      database: process.env.DB_NAME || 'hrms_db',
      tables: tableNames.length,
      tableList: tableNames,
      rowCounts,
      pool: poolInfo
    }, 'Database health check passed');
  } catch (err) {
    return errorRes(res, 'Database health check failed', [err.message], 500);
  }
};

// ── System Diagnostics ───────────────────────────────────────────────
const getSystemDiagnostics = async (req, res) => {
  try {
    await auditService.log({
      req,
      action: auditService.AuditEvents.DEVTOOL_ACCESS,
      module: 'DevTools',
      details: { tool: 'System Diagnostics' }
    });

    return successRes(res, {
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        uptime: Math.round(process.uptime()) + 's'
      },
      os: {
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        cpus: os.cpus().length,
        totalMemory: Math.round(os.totalmem() / 1024 / 1024) + ' MB',
        freeMemory: Math.round(os.freemem() / 1024 / 1024) + ' MB',
        loadAverage: os.loadavg()
      },
      process: {
        memoryUsage: {
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
          external: Math.round(process.memoryUsage().external / 1024 / 1024) + ' MB'
        },
        cwd: process.cwd(),
        env: process.env.NODE_ENV || 'development'
      },
      timestamp: new Date().toISOString()
    }, 'System diagnostics retrieved');
  } catch (err) {
    return errorRes(res, 'System diagnostics failed', [err.message], 500);
  }
};

// ── Environment Configuration Status ─────────────────────────────────
const getEnvironmentStatus = async (req, res) => {
  try {
    // Check required environment variables — NEVER expose values of sensitive ones
    const requiredVars = ['PORT', 'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME', 'DB_PASSWORD', 'SESSION_HOURS'];

    const envStatus = requiredVars.map(key => ({
      key,
      configured: !!process.env[key],
      value: isSensitiveKey(key) ? (process.env[key] ? '[SET]' : '[NOT SET]') : (process.env[key] || '[NOT SET]'),
      sensitive: isSensitiveKey(key)
    }));

    // Check for common misconfigurations
    const warnings = [];
    if (!process.env.DB_PASSWORD && process.env.NODE_ENV === 'production') {
      warnings.push('DB_PASSWORD is not set in production — this is a security risk');
    }
    if (process.env.NODE_ENV !== 'production') {
      warnings.push('Application is not running in production mode');
    }

    await auditService.log({
      req,
      action: auditService.AuditEvents.DEVTOOL_ACCESS,
      module: 'DevTools',
      details: { tool: 'Environment Status' }
    });

    return successRes(res, { variables: envStatus, warnings, nodeEnv: process.env.NODE_ENV || 'development' }, 'Environment status retrieved');
  } catch (err) {
    return errorRes(res, 'Environment status check failed', [err.message], 500);
  }
};

// ── API Route Explorer ───────────────────────────────────────────────
const getRouteExplorer = async (req, res) => {
  try {
    // Introspect Express routes
    const app = req.app;
    const routes = [];

    function extractRoutes(stack, prefix = '') {
      if (!stack) return;
      for (const layer of stack) {
        if (layer.route) {
          const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
          routes.push({
            path: prefix + layer.route.path,
            methods,
            middleware: layer.route.stack.map(s => s.name).filter(n => n !== '<anonymous>')
          });
        } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
          const routerPrefix = layer.regexp.source
            .replace('\\/?(?=\\/|$)', '')
            .replace(/\\\//g, '/')
            .replace(/\^/g, '')
            .replace(/\?.*$/g, '');
          extractRoutes(layer.handle.stack, prefix + routerPrefix);
        }
      }
    }

    if (app && app._router) {
      extractRoutes(app._router.stack);
    }

    await auditService.log({
      req,
      action: auditService.AuditEvents.DEVTOOL_ACCESS,
      module: 'DevTools',
      details: { tool: 'Route Explorer', routeCount: routes.length }
    });

    return successRes(res, {
      totalRoutes: routes.length,
      routes: routes.sort((a, b) => a.path.localeCompare(b.path))
    }, 'Routes retrieved');
  } catch (err) {
    return errorRes(res, 'Route exploration failed', [err.message], 500);
  }
};

// ── Dependencies & Security Status ───────────────────────────────────
const getDependencyStatus = async (req, res) => {
  try {
    let pkgJson = {};
    const pkgPath = path.join(process.cwd(), 'package.json');
    try {
      if (fs.existsSync(pkgPath)) {
        pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      }
    } catch {}

    const deps = pkgJson.dependencies || {};
    const devDeps = pkgJson.devDependencies || {};

    await auditService.log({
      req,
      action: auditService.AuditEvents.DEVTOOL_ACCESS,
      module: 'DevTools',
      details: { tool: 'Dependency Status' }
    });

    return successRes(res, {
      name: pkgJson.name || 'bsc-textiles-portal',
      version: pkgJson.version || '1.0.0',
      nodeEngine: pkgJson.engines?.node || 'Not specified',
      dependencies: Object.keys(deps).map(name => ({
        name,
        version: deps[name],
        type: 'production'
      })),
      devDependencies: Object.keys(devDeps).map(name => ({
        name,
        version: devDeps[name],
        type: 'development'
      })),
      totalDependencies: Object.keys(deps).length,
      totalDevDependencies: Object.keys(devDeps).length
    }, 'Dependencies retrieved');
  } catch (err) {
    return errorRes(res, 'Dependency check failed', [err.message], 500);
  }
};

// ── Application Logs (recent audit entries) ──────────────────────────
const getApplicationLogs = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 10), 500);
    const module = req.query.module || null;
    const action = req.query.action || null;

    let whereClause = '';
    const params = [];
    const conditions = [];

    if (module) { conditions.push('module = ?'); params.push(module); }
    if (action) { conditions.push('action = ?'); params.push(action); }
    if (conditions.length > 0) whereClause = `WHERE ${conditions.join(' AND ')}`;

    const [rows] = await pool.query(
      `SELECT id, username, action, module, details, ip_address, success, correlation_id, created_at
       FROM audit_logs ${whereClause}
       ORDER BY id DESC LIMIT ?`,
      [...params, limit]
    );

    const logs = rows.map(r => {
      let parsedDetails = null;
      try { parsedDetails = r.details ? JSON.parse(r.details) : null; } catch { parsedDetails = r.details; }
      return { ...r, details: parsedDetails };
    });

    return successRes(res, { logs, total: logs.length }, 'Application logs retrieved');
  } catch (err) {
    return successRes(res, { logs: [], total: 0 }, 'Application logs (empty)');
  }
};

module.exports = {
  getApiHealth,
  getDbHealth,
  getSystemDiagnostics,
  getEnvironmentStatus,
  getRouteExplorer,
  getDependencyStatus,
  getApplicationLogs
};
