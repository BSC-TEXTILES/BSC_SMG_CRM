/**
 * Unit Tests — response envelope + secret resolution
 * Covers: the standard success/error JSON contract used by every endpoint,
 * and secret-management behaviour (env precedence, stability, key length).
 */
const test = require('node:test');
const assert = require('node:assert');

// ── Response envelope ─────────────────────────────────────────
const { successRes, errorRes } = require('../../backend/src/utils/response');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

test('successRes: { success, message, data } envelope', () => {
  const res = mockRes();
  successRes(res, { id: 7 }, 'Fetched fine', 201);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Fetched fine');
  assert.deepEqual(res.body.data, { id: 7 });
});

test('errorRes: { success, message, errors[] } envelope', () => {
  const res = mockRes();
  errorRes(res, 'Nope', ['detail1'], 422);
  assert.equal(res.statusCode, 422);
  assert.equal(res.body.success, false);
  assert.equal(res.body.message, 'Nope');
  assert.deepEqual(res.body.errors, ['detail1']);
});

// ── Secret management ─────────────────────────────────────────
process.env.JWT_SECRET = 'unit-test-jwt-secret-0123456789abcdef0123456789abcdef';
process.env.ENCRYPTION_KEY = 'unit-test-encryption-key-material-0123456789';
const { getJwtSecret, getFieldEncryptionKey } = require('../../backend/src/utils/secrets');

test('JWT secret resolves from the environment first', () => {
  assert.equal(getJwtSecret(), process.env.JWT_SECRET);
});

test('JWT secret is stable across calls (tokens survive restarts)', () => {
  assert.equal(getJwtSecret(), getJwtSecret());
});

test('field-encryption key stretches material to exactly 32 bytes', () => {
  const key = getFieldEncryptionKey();
  assert.ok(Buffer.isBuffer(key));
  assert.equal(key.length, 32);
});
