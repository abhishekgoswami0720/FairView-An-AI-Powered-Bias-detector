const express = require('express');
const { outbox } = require('../services/mailer');

// Development only (DEV_OUTBOX=true, never in production): shows the emails that would
// have been sent, so the client rating page and invites can be tried without real email.
const router = express.Router();

const tokenAfter = (text, kind) => text.match(new RegExp(`/${kind}/(\\S+)`))?.[1] || null;

// GET /api/dev/outbox  -> newest first
router.get('/outbox', (req, res) => {
  res.json(
    outbox.map((m) => ({
      ...m,
      links: m.text.match(/https?:\/\/\S+/g) || [],
      ratingToken: tokenAfter(m.text, 'rate'),
      inviteToken: tokenAfter(m.text, 'invite'),
    }))
  );
});

module.exports = router;
