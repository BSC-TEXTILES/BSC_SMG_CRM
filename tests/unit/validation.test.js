const test = require('node:test');
const assert = require('node:assert');
const { 
  isValidEmail, 
  isValidMobile, 
  validatePasswordPolicy, 
  isValidUsername 
} = require('../../backend/src/validators/userValidator');

test('Email Validation', (t) => {
  assert.strictEqual(isValidEmail('test@example.com'), true);
  assert.strictEqual(isValidEmail('user.name+tag@company.co.in'), true);
  
  assert.strictEqual(isValidEmail('invalid-email'), false);
  assert.strictEqual(isValidEmail('@missinguser.com'), false);
  assert.strictEqual(isValidEmail('spaces in@email.com'), false);
  assert.strictEqual(isValidEmail(''), false);
  assert.strictEqual(isValidEmail(null), false);
});

test('Mobile Number Validation (Indian Format)', (t) => {
  assert.strictEqual(isValidMobile('9876543210'), true);
  assert.strictEqual(isValidMobile('+919876543210'), true);
  assert.strictEqual(isValidMobile('09876543210'), true);
  
  // Fails on non-Indian prefixes/formats assuming basic rules
  assert.strictEqual(isValidMobile('1234567890'), false); // Doesn't start with 6-9
  assert.strictEqual(isValidMobile('98765'), false); // Too short
  assert.strictEqual(isValidMobile('abcdefghij'), false); // Letters
});

test('Password Policy Validation', (t) => {
  // Valid passwords
  assert.strictEqual(validatePasswordPolicy('StrongPass123!'), null);
  assert.strictEqual(validatePasswordPolicy('A1b2C3d4E5'), null);
  
  // Invalid passwords
  assert.ok(validatePasswordPolicy('short1A'), 'Should fail length < 8');
  assert.ok(validatePasswordPolicy('nouppercase123'), 'Should fail missing uppercase');
  assert.ok(validatePasswordPolicy('NOLOWERCASE123'), 'Should fail missing lowercase');
  assert.ok(validatePasswordPolicy('NoDigitsHere!'), 'Should fail missing digit');
});

test('Username Format Validation', (t) => {
  assert.strictEqual(isValidUsername('admin.user'), true);
  assert.strictEqual(isValidUsername('hr_manager'), true);
  assert.strictEqual(isValidUsername('user@domain.com'), true);
  
  assert.strictEqual(isValidUsername('ab'), false); // Too short
  assert.strictEqual(isValidUsername('user with spaces'), false);
});
