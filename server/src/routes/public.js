const express = require('express');
const limits = require('../middleware/rateLimits');
const workflow = require('../services/workflow');
const accounts = require('../services/accounts');
const v = require('../utils/validate');

// Pages that work WITHOUT a login. Each one is protected by a signed link instead.
const router = express.Router();
router.use(limits.publicLinks);

// GET /api/public/rate/:token  -> what the client is about to rate.
router.get('/rate/:token', async (req, res) => {
  res.json(await workflow.describeRatingLink(req.params.token));
});

// POST /api/public/rate/:token  { score: 1-5, comment }  -> the client's rating, locked at once.
router.post('/rate/:token', async (req, res) => {
  const b = req.body || {};
  const input = { score: v.stars(b.score), comment: v.text(b.comment, 'Comment', { max: 1000 }) };
  const rating = await workflow.submitClientRating(req.params.token, input);
  res.status(201).json({ ok: true, score: rating.score });
});

// GET /api/public/invite/:token  -> who is being invited.
router.get('/invite/:token', async (req, res) => {
  res.json(await accounts.describeInvite(req.params.token));
});

// POST /api/public/invite/:token  { password }  -> sets the password and logs the person in.
router.post('/invite/:token', async (req, res) => {
  res.json(await accounts.acceptInvite(req.params.token, v.password(req.body?.password)));
});

module.exports = router;
