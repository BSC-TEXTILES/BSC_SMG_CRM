const authService = require('../services/authService');
const { successRes, errorRes } = require('../utils/response');
const { createCaptcha, verifyCaptcha } = require('../utils/captcha');

const loginSecurity = require('../utils/loginSecurity');

// Session lifetime: users who do not sign out are logged out automatically
// after this many hours (token expiry, cookie lifetime and the client timer
// all use the same value).
const SESSION_HOURS = parseInt(process.env.SESSION_HOURS || '6', 10);
const SESSION_MS = SESSION_HOURS * 60 * 60 * 1000;

// Messages that are intentional business outcomes — safe to show to users.
// Anything else (DB errors, etc.) is logged server-side and replaced with a
// generic message so internal details never reach the client.
const SAFE_LOGIN_ERRORS = new Set([
  'Username and password are required',
  'Incorrect username or password',
  'Your account has been deactivated. Please contact administrator.',
  'Too many failed login attempts. Account temporarily locked for 10 minutes.'
]);

class AuthController {
  /**
   * Public: Check if an account or IP is currently locked out.
   * Returns { isLocked: boolean, remainingSeconds: number }
   */
  async lockStatus(req, res) {
    const username = req.query.username || '';
    const lockInfo = loginSecurity.checkLock(username, req.ip);
    return res.json({
      success: true,
      data: {
        isLocked: lockInfo.isLocked,
        remainingSeconds: lockInfo.remainingSeconds
      }
    });
  }

  /**
   * Public: issues a fresh numeric captcha (SVG + opaque id). The code itself
   * never leaves the server; the client refreshes it every 30 seconds.
   */
  async captcha(req, res) {
    const { id, svg, codeLength, expiresInSeconds } = createCaptcha();
    return res.json({ success: true, data: { captchaId: id, svg, codeLength, expiresInSeconds } });
  }

  async login(req, res) {
    const { username, password, captchaId, captchaText } = req.body || {};
    const clientIp = req.ip;
    const userAgent = req.headers['user-agent'];

    try {
      // 1. Check account / IP lockout first
      const lockCheck = loginSecurity.checkLock(username, clientIp);
      if (lockCheck.isLocked) {
        return res.status(423).json({
          success: false,
          locked: true,
          remainingSeconds: lockCheck.remainingSeconds,
          message: `Too many failed login attempts. Account temporarily locked for 10 minutes. Please wait ${Math.ceil(lockCheck.remainingSeconds / 60)} minute(s).`
        });
      }

      // 2. Suspicious / automated bot login activity check
      const botCheck = loginSecurity.detectSuspiciousActivity(username, clientIp, userAgent);
      if (botCheck.detected) {
        return res.status(429).json({
          success: false,
          locked: true,
          remainingSeconds: botCheck.remainingSeconds,
          message: 'Suspicious request pattern detected. Access temporarily restricted. Please try again later.'
        });
      }

      // 3. CAPTCHA verification: one-time use
      const captchaResult = verifyCaptcha(captchaId, captchaText);
      if (captchaResult !== 'ok') {
        const message = captchaResult === 'expired'
          ? 'The captcha expired. A new one has been generated - please try again.'
          : 'Incorrect captcha. A new one has been generated - please try again.';
        return errorRes(res, message, [message], 401);
      }

      // 4. Authenticate credentials via AuthService
      const result = await authService.login(username, password, clientIp, userAgent);

      // Successful login -> Reset failed attempts counter
      loginSecurity.recordSuccess(username, clientIp);

      // Set server-side httpOnly session cookie
      res.cookie('token', result.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: String(process.env.COOKIE_SECURE || 'false') === 'true',
        maxAge: SESSION_MS,
        path: '/'
      });
      return successRes(res, result, 'Login successful');
    } catch (err) {
      // Record failed credential attempt for rate limiting & temporary lock
      let lockResult = { locked: false, remainingSeconds: 0, attemptsLeft: 5 };
      if (err.message === 'Incorrect username or password') {
        lockResult = loginSecurity.recordFailure(username, clientIp, err.message);
      }

      if (lockResult.locked) {
        return res.status(423).json({
          success: false,
          locked: true,
          remainingSeconds: lockResult.remainingSeconds,
          message: 'Account locked due to 5 consecutive failed attempts. Please try again in 10 minutes.'
        });
      }

      let message = SAFE_LOGIN_ERRORS.has(err.message) ? err.message : 'Login failed. Please try again.';
      if (err.message === 'Incorrect username or password' && lockResult.attemptsLeft > 0 && lockResult.attemptsLeft <= 3) {
        message += ` (${lockResult.attemptsLeft} attempt${lockResult.attemptsLeft === 1 ? '' : 's'} remaining before 10-minute lock)`;
      }

      if (!SAFE_LOGIN_ERRORS.has(err.message)) {
        console.error('[AuthController.login]', err.message);
      }
      return errorRes(res, message, [message], 401);
    }
  }

  async verifyUser(req, res) {
    try {
      const { username, password } = req.body;
      const result = await authService.verifyUser(username, password);
      return res.json(result);
    } catch (err) {
      console.error('[AuthController.verifyUser]', err.message);
      return res.json({ success: false });
    }
  }

  async logout(req, res) {
    try {
      let token = null;
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
      }
      await authService.logout(token, req.user ? req.user.id : null, req.user ? req.user.username : null, req.ip);
      res.clearCookie('token', { path: '/' });
      return successRes(res, {}, 'Logged out successfully');
    } catch (err) {
      return errorRes(res, 'Logout failed', [err.message], 500);
    }
  }

  async getMe(req, res) {
    return successRes(res, { user: req.user }, 'User profile retrieved');
  }
}

module.exports = new AuthController();
