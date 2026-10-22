const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { required, jwtExpiresIn } = require('../config/env');
const httpError = require('../utils/httpError');

const router = express.Router();

// POST /api/auth/login  { email, password }
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw httpError(400, 'Email and password are required.');

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+passwordHash');
  // Same message for "no such user" and "wrong password", so attackers cannot
  // find out which emails exist.
  const ok = user && (await bcrypt.compare(String(password), user.passwordHash));
  if (!ok) throw httpError(401, 'Wrong email or password.');

  const token = jwt.sign({ sub: String(user._id), role: user.role }, required('JWT_SECRET'), {
    expiresIn: jwtExpiresIn,
  });
  res.json({ token, user: { id: user._id, name: user.name, role: user.role } });
});

// GET /api/auth/me  -> who am I?
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw httpError(404, 'User not found.');
  res.json({ id: user._id, name: user.name, email: user.email, role: user.role });
});

module.exports = router;
