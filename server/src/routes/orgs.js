const express = require('express');
const limits = require('../middleware/rateLimits');
const accounts = require('../services/accounts');
const v = require('../utils/validate');

const router = express.Router();

// POST /api/orgs  { orgName, name, email, password }  (public)
// A new company signs up and its first HR admin is created.
router.post('/', limits.signup, async (req, res) => {
  const b = req.body || {};
  const result = await accounts.signupOrganization({
    orgName: v.text(b.orgName, 'Company name', { required: true, max: 120 }),
    name: v.text(b.name, 'Your name', { required: true, max: 120 }),
    email: v.email(b.email),
    password: v.password(b.password),
  });
  res.status(201).json(result);
});

module.exports = router;
