const express = require('express');
const Organization = require('../models/Organization');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const limits = require('../middleware/rateLimits');
const accounts = require('../services/accounts');
const httpError = require('../utils/httpError');

const router = express.Router();

// POST /api/auth/login  { email, password }
// Same message for "no such user" and "wrong password", so nobody can find out which emails exist.
router.post('/login', limits.login, async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    throw httpError(400, 'Email and password are required.');
  }
  res.json(await accounts.login(email.trim().toLowerCase(), password));
});

// GET /api/auth/me  -> who am I?
router.get('/me', requireAuth, async (req, res) => {
  const [user, org] = await Promise.all([User.findById(req.user.id), Organization.findById(req.user.org).select('name')]);
  res.json(accounts.publicUser(user, org.name));
});

module.exports = router;
