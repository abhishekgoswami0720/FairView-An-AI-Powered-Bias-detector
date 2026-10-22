const jwt = require('jsonwebtoken');
const { required } = require('../config/env');

// requireAuth: checks the login token on every request.
// The website sends it in the header:  Authorization: Bearer <token>
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Please log in.' });
  }
  try {
    const payload = jwt.verify(token, required('JWT_SECRET'));
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ error: 'Your login has expired or is invalid. Please log in again.' });
  }
}

// requireRole('client', 'hr'): only lets these roles through.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do this.' });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
