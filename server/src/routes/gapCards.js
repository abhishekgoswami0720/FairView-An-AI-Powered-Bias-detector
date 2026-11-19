const express = require('express');
const GapCard = require('../models/GapCard');
const { requireAuth, requireRole } = require('../middleware/auth');
const { auditBy } = require('../utils/audit');
const httpError = require('../utils/httpError');
const v = require('../utils/validate');
const views = require('../services/views');
const analysis = require('../services/analysis');

const router = express.Router();
router.use(requireAuth, requireRole('hr'));

// GET /api/gap-cards?status=open  (HR)
router.get('/', async (req, res) => {
  const filter = { org: req.user.org };
  if (req.query.status) filter.status = v.oneOf(req.query.status, ['open', 'reviewed'], 'Status');
  const cards = await GapCard.find(filter)
    .populate('manager', 'name')
    .populate('employee', 'name')
    .sort({ status: 1, createdAt: -1 })
    .limit(200);
  // Most unusual first: by |z|, then by the Isolation Forest pattern score.
  cards.sort((a, b) =>
    a.status !== b.status
      ? (a.status === 'open' ? -1 : 1)
      : Math.abs(b.latest?.z ?? 0) - Math.abs(a.latest?.z ?? 0) || (b.latest?.patternScore ?? 0) - (a.latest?.patternScore ?? 0)
  );
  res.json(cards);
});

// GET /api/gap-cards/:id  (HR) -> the card and every rating behind it.
router.get('/:id', async (req, res) => {
  const detail = await views.gapCardDetail(req.user, v.id(req.params.id));
  if (!detail) throw httpError(404, 'Gap Card not found.');
  res.json(detail);
});

// POST /api/gap-cards/:id/review  (HR) { outcome, note }
// HR records what they did. The card's numbers stay as they were.
router.post('/:id/review', async (req, res) => {
  const b = req.body || {};
  const card = await GapCard.findOne({ _id: v.id(req.params.id), org: req.user.org });
  if (!card) throw httpError(404, 'Gap Card not found.');
  if (card.status !== 'open') throw httpError(409, 'This card has already been reviewed.');
  card.status = 'reviewed';
  card.review = {
    by: req.user.id,
    at: new Date(),
    outcome: v.oneOf(b.outcome, ['no_issue', 'discussed_with_manager', 'escalated'], 'Outcome'),
    note: v.text(b.note, 'Note', { max: 2000 }),
  };
  await card.save();
  await auditBy(req, { action: 'gapcard.review', entity: 'GapCard', entityId: card._id, detail: card.review.outcome });
  res.json(card);
});

// POST /api/gap-cards/analyse  (HR) -> run the gap analysis now.
router.post('/analyse', async (req, res) => {
  const result = await analysis.runAnalysis(req.user.org);
  await auditBy(req, { action: 'analysis.run', entity: 'Organization', entityId: req.user.org, detail: result.status });
  res.json(result);
});

module.exports = router;
