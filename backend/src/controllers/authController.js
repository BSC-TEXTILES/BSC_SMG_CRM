const authService = require('../services/authService');
const { successRes, errorRes } = require('../utils/response');
const { createCaptcha, verifyCaptcha } = require('../utils/captcha');

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
  'Your account has been deactivated. Please contact administrator.'
]);

class AuthController {
  /**
   * Public: issues a fresh numeric captcha (SVG + opaque id). The code itself
   * never leaves the server; the client refreshes it every 30 seconds.
   */
  async captcha(req, res) {
    const { id, svg, expiresInSeconds } = createCaptcha();
    return res.json({ success: true, data: { captchaId: id, svg, expiresInSeconds } });
  }

  async login(req, res) {
    try {
      // ── CAPTCHA first: one-time use, checked before any credential work ──
      const { username, password, captchaId, captchaText } = req.body;
      const captchaResult = verifyCaptcha(captchaId, captchaText);
      if (captchaResult !== 'ok') {
        const message = captchaResult === 'expired'
          ? 'The captcha expired. A new one has been generated - please try again.'
          : 'Incorrect captcha. A new one has been generated - please try again.';
        return errorRes(res, message, [message], 401);
      }

      const result = await authService.login(username, password, req.ip, req.headers['user-agent']);

      // ── Server-side session: the token is ALSO planted as an httpOnly
      // cookie so the browser session is managed entirely by the backend and
      // the JavaScript can never read or tamper with it. ──
      res.cookie('token', result.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: String(process.env.COOKIE_SECURE || 'false') === 'true',
        maxAge: SESSION_MS,
        path: '/'
      });
      return successRes(res, result, 'Login successful');
    } catch (err) {
      const message = SAFE_LOGIN_ERRORS.has(err.message) ? err.message : 'Login failed. Please try again.';
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
