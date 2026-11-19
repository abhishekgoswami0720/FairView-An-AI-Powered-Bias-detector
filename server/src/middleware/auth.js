const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { required } = require('../config/env');

// requireAuth: checks the login token on every request, then loads the person from the
// database. Loading them each time means a deactivated person or a changed role takes
// effect immediately, not when their token runs out.
// The website sends the token in the header:  Authorization: Bearer <token>
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Please log in.' });
  }
  let payload;
  try {
    payload = jwt.verify(token, required('JWT_SECRET'));
  } catch {
    return res.status(401).json({ error: 'Your login has expired or is invalid. Please log in again.' });
  }
  const user = /^[a-f0-9]{24}$/i.test(String(payload.sub))
    ? await User.findById(payload.sub).select('org role active name')
    : null;
  if (!user || !user.active) {
    return res.status(401).json({ error: 'This account is not active. Please log in again.' });
  }
  req.user = { id: String(user._id), org: String(user.org), role: user.role, name: user.name };
  return next();
}

// requireRole('hr', 'manager'): only lets these roles through.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do this.' });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
