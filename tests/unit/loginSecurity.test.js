/**
 * Unit Tests — Login Rate Limiting, 10-Minute Lockout & Bot Detection
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const loginSecurity = require('../../backend/src/utils/loginSecurity');

test('LoginSecurity: initial state is unlocked', () => {
  const status = loginSecurity.checkLock('testuser1@bsc.com', '127.0.0.10');
  assert.equal(status.isLocked, false);
  assert.equal(status.remainingSeconds, 0);
});

test('LoginSecurity: 1 to 4 failed attempts do not lock account', () => {
  const user = 'testuser2@bsc.com';
  const ip = '127.0.0.11';

  for (let i = 1; i <= 4; i++) {
    const res = loginSecurity.recordFailure(user, ip, 'Wrong password');
    assert.equal(res.locked, false);
    assert.equal(res.attemptsLeft, 5 - i);
    const lock = loginSecurity.checkLock(user, ip);
    assert.equal(lock.isLocked, false);
  }
});

test('LoginSecurity: 5th failed attempt immediately locks account for 10 minutes', () => {
  const user = 'testuser3@bsc.com';
  const ip = '127.0.0.12';

  for (let i = 1; i <= 4; i++) {
    loginSecurity.recordFailure(user, ip, 'Wrong password');
  }

  const res5 = loginSecurity.recordFailure(user, ip, 'Wrong password');
  assert.equal(res5.locked, true);
  assert.equal(res5.attemptsLeft, 0);
  assert.ok(res5.remainingSeconds > 590 && res5.remainingSeconds <= 600);

  const lock = loginSecurity.checkLock(user, ip);
  assert.equal(lock.isLocked, true);
  assert.ok(lock.remainingSeconds > 590 && lock.remainingSeconds <= 600);
});

test('LoginSecurity: successful authentication resets failed counter', () => {
  const user = 'testuser4@bsc.com';
  const ip = '127.0.0.13';

  loginSecurity.recordFailure(user, ip, 'Wrong password');
  loginSecurity.recordFailure(user, ip, 'Wrong password');
  loginSecurity.recordSuccess(user, ip);

  const lock = loginSecurity.checkLock(user, ip);
  assert.equal(lock.isLocked, false);

  // Next attempt should have 4 attempts left (not locked)
  const nextRes = loginSecurity.recordFailure(user, ip, 'Wrong password');
  assert.equal(nextRes.attemptsLeft, 4);
});
