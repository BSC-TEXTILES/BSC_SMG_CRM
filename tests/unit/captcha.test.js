/**
 * Unit Tests — numeric CAPTCHA generator (utils/captcha.js)
 * Covers: code shape, SVG rendering, verification semantics (ok / invalid /
 * one-time use) and unknown-id handling.
 */
const test = require('node:test');
const assert = require('node:assert');
const { createCaptcha, verifyCaptcha } = require('../../backend/src/utils/captcha');

test('created captcha has a 4-digit code and a rendered SVG', () => {
  const c = createCaptcha();
  assert.match(c.code, /^\d{4}$/);
  assert.ok(c.svg.includes('<svg'), 'SVG markup returned');
  assert.ok(c.svg.includes('<text'), 'digits are rendered as text nodes');
  assert.equal(c.id.length > 10, true, 'opaque captcha id issued');
  assert.equal(c.expiresInSeconds, 90);
});

test('verification: correct code verifies and consumes the captcha', () => {
  const c = createCaptcha();
  assert.equal(verifyCaptcha(c.id, c.code), 'ok');
});

test('verification is one-time use: a consumed captcha cannot be reused', () => {
  const c = createCaptcha();
  assert.equal(verifyCaptcha(c.id, c.code), 'ok');
  assert.equal(verifyCaptcha(c.id, c.code), 'invalid');
});

test('wrong code is invalid (and also consumed)', () => {
  const c = createCaptcha();
  const wrong = c.code === '0000' ? '9999' : '0000';
  assert.equal(verifyCaptcha(c.id, wrong), 'invalid');
  assert.equal(verifyCaptcha(c.id, c.code), 'invalid', 'consumed even on a wrong guess');
});

test('unknown / missing ids are invalid without throwing', () => {
  assert.equal(verifyCaptcha('no-such-id', '1234'), 'invalid');
  assert.equal(verifyCaptcha(undefined, undefined), 'invalid');
  assert.equal(verifyCaptcha('', ''), 'invalid');
});

test('whitespace around the answer is tolerated, digit mismatch is not', () => {
  const c = createCaptcha();
  assert.equal(verifyCaptcha(c.id, '  ' + c.code + '  '), 'ok');
});
