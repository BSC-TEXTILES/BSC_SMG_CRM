/**
 * White-Box Tests — Wedding CRM bulk CSV import
 * (backend/src/controllers/weddingController.importCsv)
 *
 * The DB pool is replaced with a deterministic mock so these tests assert the
 * EXACT validation contract: only fully-related rows (name + valid 10-digit
 * mobile + parseable shopping date, no duplicates) may enter the database,
 * and every skipped row is reported with its reason.
 */
const test = require('node:test');
const assert = require('node:assert');

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'whitebox-encryption-key-0123456789abcdef';

const pool = require('../../backend/src/config/db');

// ── Mock DB state ─────────────────────────────────────────────
let nextCustomerCode = 'WED-DAV-2026-0007';   // highest existing sequence
const duplicateMobiles = new Set();           // mobiles that already exist
const insertedRows = [];                      // captured INSERT params
const auditRows = [];

pool.query = async (sql, params) => {
  if (/CREATE TABLE/i.test(sql)) return [{ ok: 1 }];
  if (/INSERT IGNORE INTO wedding_customers/i.test(sql)) return [{ insertId: 1 }];
  if (/SELECT COUNT\(\*\) AS total FROM wedding_customers/i.test(sql)) return [[{ total: 7 }]];
  if (/SELECT location_code FROM locations/i.test(sql)) return [[{ location_code: 'DAV' }]];
  if (/customer_code LIKE \?/i.test(sql)) {
    return nextCustomerCode ? [[{ customer_code: nextCustomerCode }]] : [[]];
  }
  if (/SELECT customer_code FROM wedding_customers WHERE mobile_number = \?/i.test(sql)) {
    const mobile = params[0];
    return duplicateMobiles.has(mobile) ? [[{ customer_code: 'WED-DAV-2026-0001' }]] : [[]];
  }
  if (/INSERT INTO wedding_customers/i.test(sql)) {
    insertedRows.push(params);
    return [{ insertId: insertedRows.length }];
  }
  if (/INSERT INTO wedding_audit_logs/i.test(sql)) {
    auditRows.push(params);
    return [{ insertId: 1 }];
  }
  return [[]];
};

const controller = require('../../backend/src/controllers/weddingController');

// ── Helpers ───────────────────────────────────────────────────
function mockReqRes(csvText) {
  const req = {
    file: csvText === null ? undefined : { buffer: Buffer.from(csvText, 'utf8'), originalname: 'leads.csv' },
    user: { id: 5, locationId: 2, fullName: 'Ravi HR', username: 'ravi.hr' },
    query: {},
    body: {}
  };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
  return { req, res };
}

const HEADER = 'name,mobile,expected_shopping_date,email,wedding_date,family_size,notes,telecaller\n';

test('valid rows are inserted with normalized mobiles, parsed dates and encrypted notes', async () => {
  insertedRows.length = 0;
  const csv = HEADER +
    'Deepa Kulkarni,+91 9876543210,25/12/2026,deepa@x.com,10/01/2027,5,Pure silk sarees,Kiran\n' +
    'Manjunath Gowda,9632009988,2027-01-15,,30/12/2026,8,,\n';
  const { req, res } = mockReqRes(csv);
  await controller.importCsv(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.imported, 2);
  assert.equal(res.body.data.skipped, 0);

  const first = insertedRows[0];
  assert.equal(first[2], 'Deepa Kulkarni');
  assert.equal(first[3], '9876543210', '91-prefix and spaces stripped to 10 digits');
  assert.equal(first[5], '2027-01-10', 'wedding date DD/MM/YYYY parsed to ISO');
  assert.equal(first[6], '2026-12-25', 'expected shopping date DD/MM/YYYY parsed to ISO');
  assert.equal(first[9], 'Kiran');
  assert.match(first[11], /^enc:v1:/, 'free-text notes are encrypted at rest');

  const second = insertedRows[1];
  assert.equal(second[3], '9632009988');
  assert.equal(second[6], '2027-01-15', 'ISO shopping date accepted as-is');
  assert.equal(second[8], 8, 'family size carried through');

  assert.ok(auditRows.length >= 1, 'import writes an audit trail entry');
});

test('row without a customer name is skipped with a reason', async () => {
  insertedRows.length = 0;
  const csv = HEADER + ',9876543211,25/12/2026,,,,,\n';
  const { req, res } = mockReqRes(csv);
  await controller.importCsv(req, res);
  assert.equal(res.body.data.imported, 0);
  assert.equal(res.body.data.skipped, 1);
  assert.match(res.body.data.errors[0].reason, /Missing customer name/);
  assert.equal(insertedRows.length, 0, 'nothing reached the database');
});

test('invalid mobile numbers never reach the database', async () => {
  insertedRows.length = 0;
  const csv = HEADER +
    'Bad Mobile Five,98765,25/12/2026,,,,,\n' +
    'Letters In Phone,98ABC76543,25/12/2026,,,,,\n' +
    'Too Long,98765432109876,25/12/2026,,,,,\n';
  const { req, res } = mockReqRes(csv);
  await controller.importCsv(req, res);
  assert.equal(res.body.data.imported, 0);
  assert.equal(res.body.data.skipped, 3);
  assert.equal(insertedRows.length, 0);
  assert.match(res.body.data.errors[0].reason, /Invalid\/missing mobile/);
});

test('row without a parseable shopping date is skipped (NOT NULL requirement)', async () => {
  insertedRows.length = 0;
  const csv = HEADER + 'No Shopping Date,9876543222,,,,,,\n';
  const { req, res } = mockReqRes(csv);
  await controller.importCsv(req, res);
  assert.equal(res.body.data.imported, 0);
  assert.equal(res.body.data.skipped, 1);
  assert.match(res.body.data.errors[0].reason, /expected shopping date/);
});

test('duplicate mobile numbers within the location are skipped', async () => {
  insertedRows.length = 0;
  duplicateMobiles.add('9876543299');
  const csv = HEADER + 'Already Exists,9876543299,25/12/2026,,,,,\n';
  const { req, res } = mockReqRes(csv);
  await controller.importCsv(req, res);
  assert.equal(res.body.data.imported, 0);
  assert.equal(res.body.data.skipped, 1);
  assert.match(res.body.data.errors[0].reason, /already exists/);
  assert.equal(insertedRows.length, 0);
  duplicateMobiles.delete('9876543299');
});

test('customer codes continue the location-year sequence without collision', async () => {
  insertedRows.length = 0;
  const csv = HEADER +
    'Seq One,9876543301,25/12/2026,,,,,\n' +
    'Seq Two,9876543302,26/12/2026,,,,,\n';
  const { req, res } = mockReqRes(csv);
  await controller.importCsv(req, res);
  assert.equal(res.body.data.imported, 2);
  const codeOne = insertedRows[0][0];
  const codeTwo = insertedRows[1][0];
  assert.match(codeOne, /^WED-DAV-\d{4}-0008$/);
  assert.match(codeTwo, /^WED-DAV-\d{4}-0009$/);
});

test('empty or header-only files are rejected outright', async () => {
  const { req, res } = mockReqRes(HEADER);
  await controller.importCsv(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /no data rows/);
});

test('a missing file attachment returns a 400 guidance error', async () => {
  const { req, res } = mockReqRes(null);
  await controller.importCsv(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /No CSV file uploaded/);
});
