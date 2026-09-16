const test = require('node:test');
const assert = require('node:assert');
const { checkPermission, ADMIN_ROLES } = require('../../backend/src/services/authorizationService');

test('Authorization Service - Authentication Check', async (t) => {
  const result = await checkPermission(null);
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.reason, 'Authentication required');
});

test('Authorization Service - Role Bypass', async (t) => {
  const user = { id: 1, role: 'Admin', active: 1 };
  // We skip mocking the DB for the active check by assuming it passes if DB fails,
  // or we can test the bypass logic directly.
  
  // Since we aren't mocking the DB pool here, the DB query might fail but the logic falls through.
  const result = await checkPermission(user, { module: 'any_module', action: 'can_edit' });
  
  // If the DB query throws due to no connection in CI, the catch block logs a warning
  // and execution continues to the role check.
  assert.strictEqual(result.allowed, true);
  assert.ok(result.reason.includes('Admin role bypasses module checks'));
});
