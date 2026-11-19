// Limits how often one address can hit the routes that attackers like:
// password guessing on login, and link guessing on the public pages.
const { rateLimit } = require('express-rate-limit');
const { rateLimitOff } = require('../config/env');

const MINUTE = 60 * 1000;

function limiter(windowMs, limit, error) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => rateLimitOff,
    message: { error },
  });
}

module.exports = {
  login: limiter(15 * MINUTE, 20, 'Too many login attempts. Please wait 15 minutes and try again.'),
  signup: limiter(60 * MINUTE, 10, 'Too many sign-ups from this network. Please try again later.'),
  publicLinks: limiter(15 * MINUTE, 100, 'Too many requests. Please wait a few minutes and try again.'),
};
