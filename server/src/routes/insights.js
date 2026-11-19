const express = require('express');
const AuditLog = require('../models/AuditLog');
const { requireAuth, requireRole } = require('../middleware/auth');
const views = require('../services/views');
const v = require('../utils/validate');

const router = express.Router();
router.use(requireAuth);

// GET /api/insights/record  (employee) -> my delivered work and what clients said.
router.get('/record', requireRole('employee'), async (req, res) => {
  res.json(await views.employeeRecord(req.user));
});

// GET /api/insights/team  (manager) -> my ratings vs clients' ratings, person by person.
router.get('/team', requireRole('manager'), async (req, res) => {
  res.json(await views.teamView(req.user));
});

// GET /api/insights/overview  (HR) -> the company at a glance.
router.get('/overview', requireRole('hr'), async (req, res) => {
  res.json(await views.overview(req.user));
});

// GET /api/insights/audit?entity=ClientRating&outcome=blocked&before=<date>  (HR)
router.get('/audit', requireRole('hr'), async (req, res) => {
  const filter = { org: req.user.org };
  if (req.query.entity) filter.entity = v.text(req.query.entity, 'entity', { max: 50 });
  if (req.query.outcome) filter.outcome = v.oneOf(req.query.outcome, ['allowed', 'blocked'], 'outcome');
  if (req.query.before) {
    const before = new Date(String(req.query.before));
    if (!Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };
  }
  const entries = await AuditLog.find(filter).populate('actor', 'name role').sort({ createdAt: -1 }).limit(100);
  res.json(entries);
});

module.exports = router;
