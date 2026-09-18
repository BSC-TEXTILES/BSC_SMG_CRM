const test = require('node:test');
const assert = require('node:assert');
const {
  isValidEmail,
  isValidMobile,
  normalizeMobile,
  isValidDate,
  parsePositiveInt,
  validateWeddingRegistration
} = require('../../backend/src/validators/weddingValidator');

test('Wedding Email Validation', (t) => {
  assert.strictEqual(isValidEmail('customer@gmail.com'), true);
  assert.strictEqual(isValidEmail('customer.name@gmail.com'), true);
  assert.strictEqual(isValidEmail('customer_name@example.com'), true);

  assert.strictEqual(isValidEmail('abc'), false);
  assert.strictEqual(isValidEmail('abc@'), false);
  assert.strictEqual(isValidEmail('abc.com.'), false);
  assert.strictEqual(isValidEmail('@abc.com'), false);
  assert.strictEqual(isValidEmail('abc@.com'), false);
  assert.strictEqual(isValidEmail('abc@@gmail.com'), false);
  assert.strictEqual(isValidEmail('abc gmail.com'), false);
  assert.strictEqual(isValidEmail(''), false);
});

test('Wedding Mobile Validation (Indian)', (t) => {
  assert.strictEqual(isValidMobile('9876543210'), true);
  assert.strictEqual(isValidMobile('+919876543210'), true);
  assert.strictEqual(isValidMobile('09876543210'), true);

  assert.strictEqual(isValidMobile('123'), false);
  assert.strictEqual(isValidMobile('abcdefghij'), false);
  assert.strictEqual(isValidMobile('1234567890'), false);
  assert.strictEqual(isValidMobile('987654321'), false);
  assert.strictEqual(isValidMobile(''), false);
});

test('Mobile Normalization', (t) => {
  assert.strictEqual(normalizeMobile('9876543210'), '+919876543210');
  assert.strictEqual(normalizeMobile('+91 98765 43210'), '+919876543210');
  assert.strictEqual(normalizeMobile('919876543210'), '+919876543210');
  assert.strictEqual(normalizeMobile('09876543210'), '+919876543210');
  assert.strictEqual(normalizeMobile('not-a-number'), null);
});

test('Date Validation', (t) => {
  assert.strictEqual(isValidDate('2026-12-25', { required: true }), true);
  assert.strictEqual(isValidDate('2026-02-30', { required: true }), false);
  assert.strictEqual(isValidDate('not-a-date', { required: true }), false);
  assert.strictEqual(isValidDate('2026-13-01', { required: true }), false);
  assert.strictEqual(isValidDate('', { required: true }), false);
  assert.strictEqual(isValidDate('', { required: false }), true);
});

test('Numeric Validation', (t) => {
  assert.strictEqual(parsePositiveInt('200'), 200);
  assert.strictEqual(parsePositiveInt('0'), null);
  assert.strictEqual(parsePositiveInt('-5'), null);
  assert.strictEqual(parsePositiveInt('abc'), null);
  assert.strictEqual(parsePositiveInt(''), null);
  assert.strictEqual(parsePositiveInt(undefined), null);
});

test('Full Registration Payload Validation', (t) => {
  const valid = {
    customer_name: 'Ramesh Kumar',
    mobile: '9876543210',
    wedding_date: '2027-02-14',
    preferred_shopping_date: '2026-10-01',
    consent: true,
    email: 'ramesh@gmail.com',
    guest_count: '200'
  };
  assert.strictEqual(validateWeddingRegistration(valid).ok, true);

  const invalid = {
    customer_name: '   ',
    mobile: '12345',
    email: 'bad',
    wedding_date: '2020-01-01',
    preferred_shopping_date: '',
    consent: false
  };
  const result = validateWeddingRegistration(invalid);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some(e => /Customer name/i.test(e)));
  assert.ok(result.errors.some(e => /mobile/i.test(e)));
  assert.ok(result.errors.some(e => /email/i.test(e)));
  assert.ok(result.errors.some(e => /wedding date/i.test(e)));
  assert.ok(result.errors.some(e => /consent/i.test(e)));
});