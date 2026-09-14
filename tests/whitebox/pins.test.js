/**
 * White-Box Tests — Kiosk/Cash PIN credential security
 * (backend/src/controllers/crmController.verifyPin + updateSettings)
 *
 * Asserts the internal contract:
 *   - PINs are stored ONLY as bcrypt hashes (never plaintext)
 *   - the old universal backdoors ('1234' always works / '0000') are gone
 *   - the documented factory default '1234' is accepted exactly once when no
 *     PIN is configured and is immediately persisted as a hash
 */
const test = require('node:test');
const assert = require('node:assert');
const { createRequire } = require('node:module');
const path = require('node:path');

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'whitebox-encryption-key-0123456789abcdef';
const backendRequire = createRequire(path.join(__dirname, '..', '..', 'backend', 'package.json'));
const bcrypt = backendRequire('bcryptjs');

// ── Mock DB (Setting rows) ────────────────────────────────────
const settings = new Map(); // key -> stored value (hash or legacy plaintext)
const writes = [];
const db = require('../../backend/src/config/db');
db.query = async (sql, params) => {
  if (/INSERT INTO Setting/i.test(sql)) {
    settings.set(params[0], params[1]);
    writes.push({ key: params[0], value: params[1] });
    return [{ insertId: 1 }];
  }
  if (/SELECT settingValue FROM Setting/i.test(sql)) {
    const key = params[0];
    return settings.has(key) ? [[{ settingValue: settings.get(key) }]] : [[]];
  }
  return [[]];
};

const crm = require('../../backend/src/controllers/crmController');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

test('no PIN configured: factory default 1234 is accepted once and stored as a bcrypt hash', async () => {
  const res = mockRes();
  await crm.verifyPin({ body: { type: 'greeter', pin: '1234' } }, res);
  assert.equal(res.statusCode, 200);
  assert.ok(settings.get('greeter_pin').startsWith('$2a$10$'), 'stored as a bcrypt hash (cost 10)');
});

test('custom PIN round-trip: hashed on save, verified by bcrypt compare', async () => {
  const res = mockRes();
  await crm.updateSettings({ body: { cashPin: '987654' } }, res);
  const stored = settings.get('cash_pin');
  assert.ok(stored.startsWith('$2'), 'saved as bcrypt hash, never plaintext');
  assert.notEqual(stored, '987654');

  const ok = mockRes();
  await crm.verifyPin({ body: { type: 'cash', pin: '987654' } }, ok);
  assert.equal(ok.statusCode, 200);

  const bad = mockRes();
  await crm.verifyPin({ body: { type: 'cash', pin: '111111' } }, bad);
  assert.equal(bad.statusCode, 401);
});

test('the old universal backdoors are gone (0000 / always-1234)', async () => {
  await crm.updateSettings({ body: { tvPin: '246810' } }, mockRes());
  const backdoor0 = mockRes();
  await crm.verifyPin({ body: { type: 'tv', pin: '0000' } }, backdoor0);
  assert.equal(backdoor0.statusCode, 401, '0000 no longer opens anything');

  // '1234' must NOT verify once a custom hash exists
  const backdoor1234 = mockRes();
  await crm.verifyPin({ body: { type: 'tv', pin: '1234' } }, backdoor1234);
  assert.equal(backdoor1234.statusCode, 401, 'factory default no longer overrides a configured PIN');
});

test('getSettings never exposes PIN material — only configuration booleans', async () => {
  const res = mockRes();
  await crm.getSettings({}, res);
  assert.equal(res.statusCode, 200);
  const s = res.body.settings;
  assert.equal(s.tvPin, undefined, 'no plaintext PIN in the response');
  assert.equal(s.greeterPin, undefined, 'no plaintext PIN in the response');
  assert.equal(typeof s.hasTvPin, 'boolean');
  assert.equal(typeof s.hasGreeterPin, 'boolean');
});

test('PIN validation: non-numeric / wrong length rejected before storage', async () => {
  const before = writes.length;
  const bad1 = mockRes();
  await crm.updateSettings({ body: { greeterPin: 'abcd' } }, bad1);
  assert.equal(bad1.statusCode, 400);
  const bad2 = mockRes();
  await crm.updateSettings({ body: { greeterPin: '12' } }, bad2);
  assert.equal(bad2.statusCode, 400);
  assert.equal(writes.length, before, 'nothing was written');
});
