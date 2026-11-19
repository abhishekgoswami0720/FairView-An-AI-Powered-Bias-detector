// Small input checks. Every value from a request goes through one of these before it
// reaches a database query, so a value like { "$gt": "" } can never become part of a filter.
const httpError = require('./httpError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_RE = /^[a-f0-9]{24}$/i;

// A MongoDB id, as text.
function id(value, field = 'id') {
  if (typeof value !== 'string' || !ID_RE.test(value)) throw httpError(400, `Invalid ${field}.`);
  return value;
}

// Optional or required text with a length limit. Returns the trimmed text or undefined.
function text(value, field, { required = false, max = 1000 } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw httpError(400, `${field} is required.`);
    return undefined;
  }
  if (typeof value !== 'string') throw httpError(400, `${field} must be text.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw httpError(400, `${field} is required.`);
  if (trimmed.length > max) throw httpError(400, `${field} is too long (max ${max} characters).`);
  return trimmed || undefined;
}

function email(value, field = 'Email') {
  const e = text(value, field, { required: true, max: 254 }).toLowerCase();
  if (!EMAIL_RE.test(e)) throw httpError(400, `${field} is not a valid email address.`);
  return e;
}

// 1 to 5 stars, whole numbers only. Accepts 4 or "4".
function stars(value) {
  if (typeof value !== 'number' && typeof value !== 'string') throw httpError(400, 'Choose 1 to 5 stars.');
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw httpError(400, 'Choose 1 to 5 stars.');
  return n;
}

function oneOf(value, allowed, field) {
  if (!allowed.includes(value)) throw httpError(400, `${field} must be one of: ${allowed.join(', ')}.`);
  return value;
}

function password(value) {
  if (typeof value !== 'string' || value.length < 8) throw httpError(400, 'Password must be at least 8 characters.');
  if (value.length > 200) throw httpError(400, 'Password is too long.');
  return value;
}

module.exports = { id, text, email, stars, oneOf, password, EMAIL_RE };
