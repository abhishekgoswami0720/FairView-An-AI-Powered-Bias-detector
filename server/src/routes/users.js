const express = require('express');
const User = require('../models/User');
const { ROLES } = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const accounts = require('../services/accounts');
const { auditBy } = require('../utils/audit');
const httpError = require('../utils/httpError');
const sameId = require('../utils/sameId');
const v = require('../utils/validate');

const router = express.Router();
router.use(requireAuth);

// POST /api/users  (HR) { name, email, role }  -> sends an invite email.
// There is no public "join a company" sign-up: only HR adds people, and HR gives the role.
router.post('/', requireRole('hr'), async (req, res) => {
  const b = req.body || {};
  const { user, emailSent } = await accounts.inviteUser(req, {
    name: v.text(b.name, 'Name', { required: true, max: 120 }),
    email: v.email(b.email),
    role: v.oneOf(b.role, ROLES, 'Role'),
  });
  res.status(201).json({ user, emailSent });
});

// POST /api/users/import  (HR) text/csv body or { csv }  -> invites everyone in the file.
router.post('/import', requireRole('hr'), express.text({ type: ['text/csv', 'text/plain'], limit: '1mb' }), async (req, res) => {
  const csv = typeof req.body === 'string' ? req.body : req.body?.csv;
  if (typeof csv !== 'string' || !csv.trim()) throw httpError(400, 'Send the CSV file contents.');
  res.status(201).json(await accounts.importUsers(req, csv));
});

// POST /api/users/:id/resend-invite  (HR)
router.post('/:id/resend-invite', requireRole('hr'), async (req, res) => {
  res.json(await accounts.resendInvite(req, v.id(req.params.id)));
});

// GET /api/users?role=employee  -> people in my company.
// HR also sees emails, status and whether the invite was accepted; others see names and roles only.
router.get('/', async (req, res) => {
  const filter = { org: req.user.org };
  if (req.query.role) filter.role = v.oneOf(req.query.role, ROLES, 'Role');
  const isHr = req.user.role === 'hr';
  if (!isHr) filter.active = true;
  const users = await User.find(filter)
    .select(isHr ? 'name email role active createdAt +passwordHash' : 'name role')
    .sort({ name: 1 });
  res.json(
    users.map((u) =>
      isHr
        ? { id: u._id, name: u.name, email: u.email, role: u.role, active: u.active, joined: Boolean(u.passwordHash), createdAt: u.createdAt }
        : { id: u._id, name: u.name, role: u.role }
    )
  );
});

// PATCH /api/users/:id  (HR) { active?, role? }
// People are deactivated, never deleted, so their past ratings keep a name.
router.patch('/:id', requireRole('hr'), async (req, res) => {
  const id = v.id(req.params.id);
  const b = req.body || {};
  const user = await User.findOne({ _id: id, org: req.user.org });
  if (!user) throw httpError(404, 'Person not found.');
  const changes = [];
  if (b.active !== undefined) {
    if (typeof b.active !== 'boolean') throw httpError(400, 'active must be true or false.');
    if (sameId(user._id, req.user.id) && b.active === false) throw httpError(409, 'You cannot deactivate your own account.');
    if (user.active !== b.active) changes.push(b.active ? 'reactivated' : 'deactivated');
    user.active = b.active;
  }
  if (b.role !== undefined) {
    const role = v.oneOf(b.role, ROLES, 'Role');
    if (sameId(user._id, req.user.id) && role !== 'hr') throw httpError(409, 'You cannot remove your own HR role.');
    if (user.role !== role) changes.push(`role ${user.role} -> ${role}`);
    user.role = role;
  }
  await user.save();
  if (changes.length) await auditBy(req, { action: 'user.update', entity: 'User', entityId: user._id, detail: changes.join(', ') });
  res.json({ id: user._id, name: user.name, email: user.email, role: user.role, active: user.active });
});

module.exports = router;
