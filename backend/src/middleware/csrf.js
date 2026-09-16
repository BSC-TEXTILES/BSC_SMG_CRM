const crypto = require('crypto');

const generateCsrfToken = () => crypto.randomBytes(32).toString('hex');

const csrfProtection = (req, res, next) => {
  // Allow safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Exempt auth routes if needed, but login can be protected if we fetch CSRF first.
  // Actually, since login doesn't have a token yet typically, we should let login pass,
  // OR require a CSRF token fetch before login.
  
  const tokenFromHeader = req.headers['x-csrf-token'];
  const tokenFromCookie = req.cookies['_csrf'];

  if (!tokenFromHeader || !tokenFromCookie || tokenFromHeader !== tokenFromCookie) {
    const err = new Error('Invalid CSRF token');
    err.code = 'CSRF_ERROR';
    return next(err);
  }

  next();
};

const setCsrfCookie = (req, res, next) => {
  if (!req.cookies['_csrf']) {
    const token = generateCsrfToken();
    res.cookie('_csrf', token, {
      httpOnly: false, // Must be readable by JS to send in header
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/'
    });
  }
  next();
};

module.exports = {
  csrfProtection,
  setCsrfCookie
};
