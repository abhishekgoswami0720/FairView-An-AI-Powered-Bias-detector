const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const httpError = require('../utils/httpError');
const audit = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

// POST /api/users  (HR only) - create an account.
// There is no public sign-up: otherwise anyone could register as "hr" or "manager".
router.post('/', requireRole('hr'), async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!password || String(password).length < 8) {
    throw httpError(400, 'Password must be at least 8 characters.');
  }
  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = await User.create({ name, email, passwordHash, role });
  await audit({ actor: req.user.id, action: 'user.create', entity: 'User', entityId: user._id });
  res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
});

// GET /api/users?role=manager - list people (only name and role, no emails).
// Clients need this to pick a manager; managers need it to pick employees.
router.get('/', async (req, res) => {
  const filter = req.query.role ? { role: String(req.query.role) } : {};
  const users = await User.find(filter, { name: 1, role: 1 });
  res.json(users);
});

module.exports = router;
