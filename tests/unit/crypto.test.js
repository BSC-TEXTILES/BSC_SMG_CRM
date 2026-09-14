/**
 * Unit Tests — AES-256-GCM field encryption (utils/crypto.js)
 * Covers: round-trip confidentiality, tamper detection (auth tag), dual-read
 * tolerance for legacy plaintext, null safety and batch decryption helpers.
 */
const test = require('node:test');
const assert = require('node:assert');
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'unit-test-encryption-key-material-0123456789';
const { encryptField, decryptField, decryptRow, decryptRows, PREFIX } = require('../../backend/src/utils/crypto');

test('encrypt/decrypt round-trip restores the exact plaintext', () => {
  const secret = 'Interested in premium silk sarees — visit planned for 12/10';
  const enc = encryptField(secret);
  assert.ok(enc.startsWith(PREFIX), 'ciphertext carries the enc:v1 prefix');
  assert.notEqual(enc, secret);
  assert.equal(decryptField(enc), secret);
});

test('fresh IV: identical plaintexts never share a ciphertext', () => {
  const a = encryptField('same note');
  const b = encryptField('same note');
  assert.notEqual(a, b);
  assert.equal(decryptField(a), decryptField(b));
});

test('tampered ciphertext is rejected by the GCM auth tag', () => {
  const enc = encryptField('sensitive');
  const parts = enc.split(':');
  const data = Buffer.from(parts[4], 'base64');
  data[0] = data[0] ^ 0xff; // flip a bit
  parts[4] = data.toString('base64');
  const tampered = parts.join(':');
  assert.equal(decryptField(tampered), '[Encrypted data unavailable]');
});

test('dual-read: legacy plaintext values pass through untouched', () => {
  assert.equal(decryptField('plain old note'), 'plain old note');
});

test('null / empty handling', () => {
  assert.equal(encryptField(null), null);
  assert.equal(encryptField(undefined), undefined);
  assert.equal(encryptField(''), '');
  assert.equal(decryptField(null), null);
  assert.equal(encryptField(PREFIX + 'aGVsbG86dGFnOmRhdGE='), PREFIX + 'aGVsbG86dGFnOmRhdGE=', 'already-encrypted values are not re-encrypted');
});

test('decryptRow / decryptRows decrypt only the selected fields', () => {
  const row = { customer_name: 'Ananya', customer_notes: encryptField('secret note'), call_status: 'Pending' };
  decryptRow(row, ['customer_notes']);
  assert.equal(row.customer_notes, 'secret note');
  assert.equal(row.customer_name, 'Ananya');

  const rows = [
    { customer_notes: encryptField('n1') },
    { customer_notes: 'legacy plain' },
    { customer_notes: null }
  ];
  decryptRows(rows, ['customer_notes']);
  assert.equal(rows[0].customer_notes, 'n1');
  assert.equal(rows[1].customer_notes, 'legacy plain');
  assert.equal(rows[2].customer_notes, null);
});
