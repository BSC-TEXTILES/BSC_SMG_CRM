/**
 * Field-Level Encryption Utility (AES-256-GCM)
 * ────────────────────────────────────────────
 * Provides authenticated encryption for sensitive columns at rest
 * (free-text customer notes, call remarks, and any future PII fields).
 *
 * Wire format stored in the DB:
 *   enc:v1:<iv_base64>:<authTag_base64>:<ciphertext_base64>
 *
 * Safety properties:
 *   - AES-256-GCM gives confidentiality AND tamper detection (auth tag).
 *   - Fresh random IV per encryption — identical plaintexts never share a
 *     ciphertext, so DB snapshots leak no repetition patterns.
 *   - `decryptField` is a DUAL-READ helper: values that do not carry the
 *     `enc:v1:` prefix are returned as-is. This makes the rollout zero-
 *     downtime — legacy plaintext rows keep working and are re-encrypted
 *     naturally the next time the row is written.
 *   - If decryption fails (wrong key / corrupted row) the raw value is
 *     returned and the error is logged, so a key rotation mistake can never
 *     take the UI down.
 */

const crypto = require('crypto');
const { getFieldEncryptionKey } = require('./secrets');

const PREFIX = 'enc:v1:';

function encryptField(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const value = String(plaintext);
  if (value === '' || value.startsWith(PREFIX)) return value; // already encrypted / empty

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getFieldEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    PREFIX.slice(0, -1),          // 'enc:v1'
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64')
  ].join(':');
}

function decryptField(stored) {
  if (stored === null || stored === undefined) return stored;
  const value = String(stored);
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext row — dual-read

  try {
    const [, , ivB64, tagB64, dataB64] = value.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getFieldEncryptionKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
    return plaintext.toString('utf8');
  } catch (err) {
    console.error('[Crypto] Field decryption failed — returning masked placeholder:', err.message);
    return '[Encrypted data unavailable]';
  }
}

/**
 * Decrypt every key in `fields` on each row object (mutates copies).
 * Usage: decryptRow(row, ['customer_notes'])
 */
function decryptRow(row, fields) {
  if (!row) return row;
  for (const f of fields) {
    if (row[f] !== null && row[f] !== undefined) {
      row[f] = decryptField(row[f]);
    }
  }
  return row;
}

function decryptRows(rows, fields) {
  if (!Array.isArray(rows)) return rows;
  for (const r of rows) decryptRow(r, fields);
  return rows;
}

module.exports = {
  encryptField,
  decryptField,
  decryptRow,
  decryptRows,
  PREFIX
};
