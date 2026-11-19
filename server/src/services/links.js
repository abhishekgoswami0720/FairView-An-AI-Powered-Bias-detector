// Signed links for clients (rate one piece of work) and new users (accept an invite).
//
// A link looks like  <record id>.<signature>
// The signature is an HMAC of the id made with a key derived from JWT_SECRET.
// Nothing secret is stored in the database: a stolen copy of the database cannot be
// turned into working links, and a link can be rebuilt any time (for reminder emails).
const crypto = require('crypto');
const { required, appUrl } = require('../config/env');

const TOKEN_RE = /^([a-f0-9]{24})\.([A-Za-z0-9_-]{43})$/;

function key() {
  return crypto.createHmac('sha256', required('JWT_SECRET')).update('fairview-signed-links-v1').digest();
}

function signature(purpose, id, extra = '') {
  return crypto.createHmac('sha256', key()).update(`${purpose}:${id}:${extra}`).digest('base64url');
}

function sign(purpose, id, extra = '') {
  return `${id}.${signature(purpose, String(id), extra)}`;
}

// Returns the record id inside a token, or null if the token has the wrong shape.
// This does NOT prove the token is genuine: call matches() for that.
function idFromToken(token) {
  const m = typeof token === 'string' ? TOKEN_RE.exec(token) : null;
  return m ? m[1] : null;
}

// True only if the token was made by this server for this purpose (and extra value).
function matches(purpose, token, extra = '') {
  const m = typeof token === 'string' ? TOKEN_RE.exec(token) : null;
  if (!m) return false;
  const given = Buffer.from(m[2]);
  const expected = Buffer.from(signature(purpose, m[1], extra));
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

const ratingUrl = (linkId) => `${appUrl}/rate/${sign('rate', linkId)}`;
const inviteUrl = (userId, nonce) => `${appUrl}/invite/${sign('invite', userId, nonce)}`;

module.exports = { sign, idFromToken, matches, ratingUrl, inviteUrl };
