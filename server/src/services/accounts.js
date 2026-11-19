// Companies, people and logins.
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { parse } = require('csv-parse/sync');
const Organization = require('../models/Organization');
const User = require('../models/User');
const { ROLES } = require('../models/User');
const audit = require('../utils/audit');
const { auditBy } = require('../utils/audit');
const httpError = require('../utils/httpError');
const v = require('../utils/validate');
const { required, jwtExpiresIn, inviteDays } = require('../config/env');
const links = require('./links');
const emails = require('./emails');

const BCRYPT_COST = 10;
const MAX_IMPORT_ROWS = 500;

function loginToken(user) {
  return jwt.sign({ sub: String(user._id) }, required('JWT_SECRET'), { expiresIn: jwtExpiresIn });
}

function publicUser(user, orgName) {
  return { id: user._id, name: user.name, email: user.email, role: user.role, org: user.org, orgName };
}

// A new company signs up. This is the only public way to create an account, and it can
// only create a brand-new company with its first HR admin: nobody can join an existing
// company or choose a role this way.
async function signupOrganization({ orgName, name, email, password }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  let org;
  let user;
  await mongoose.connection.transaction(async (session) => {
    if (await User.exists({ email }).session(session)) throw httpError(409, 'An account with this email already exists.');
    [org] = await Organization.create([{ name: orgName }], { session });
    [user] = await User.create([{ org: org._id, name, email, passwordHash, role: 'hr' }], { session });
    await audit({ org: org._id, actor: user._id, action: 'org.create', entity: 'Organization', entityId: org._id }, session);
  });
  return { token: loginToken(user), user: publicUser(user, org.name) };
}

function newInvite() {
  return {
    inviteNonce: crypto.randomBytes(16).toString('hex'),
    inviteExpiresAt: new Date(Date.now() + inviteDays * 24 * 60 * 60 * 1000),
  };
}

// HR adds a person. They get an email with a link to choose their own password,
// so HR never knows anyone's password.
async function inviteUser(req, { name, email, role }) {
  const invite = newInvite();
  const user = await User.create({ org: req.user.org, name, email, role, ...invite });
  await auditBy(req, { action: 'user.invite', entity: 'User', entityId: user._id, detail: `${email} as ${role}` });
  const emailSent = await emails.sendInvite(user._id, invite.inviteNonce, req.user.name);
  return { user, emailSent };
}

async function resendInvite(req, userId) {
  const user = await User.findOne({ _id: userId, org: req.user.org }).select('+passwordHash');
  if (!user) throw httpError(404, 'Person not found.');
  if (user.passwordHash) throw httpError(409, 'This person has already set their password.');
  const invite = newInvite(); // the new nonce makes every older invite link stop working
  await User.updateOne({ _id: user._id }, { $set: invite });
  await auditBy(req, { action: 'user.invite.resend', entity: 'User', entityId: user._id });
  return { emailSent: await emails.sendInvite(user._id, invite.inviteNonce, req.user.name) };
}

// CSV with the columns name, email, role (header row required). Each row is added on its
// own: one bad row does not stop the others, and every problem is reported back by row number.
async function importUsers(req, csvText) {
  let rows;
  try {
    rows = parse(csvText, { columns: (h) => h.map((c) => String(c).trim().toLowerCase()), skip_empty_lines: true, trim: true, bom: true });
  } catch (err) {
    throw httpError(400, `This file is not a valid CSV: ${err.message}`);
  }
  if (rows.length === 0) throw httpError(400, 'The file has no rows.');
  if (rows.length > MAX_IMPORT_ROWS) throw httpError(400, `At most ${MAX_IMPORT_ROWS} people per file.`);
  if (!('name' in rows[0] && 'email' in rows[0] && 'role' in rows[0])) {
    throw httpError(400, 'The first row must be the headers: name, email, role');
  }
  const created = [];
  const errors = [];
  for (const [i, row] of rows.entries()) {
    const line = i + 2; // +1 for the header, +1 because people count from 1
    try {
      const name = v.text(row.name, 'Name', { required: true, max: 120 });
      const email = v.email(row.email);
      const role = v.oneOf(String(row.role).toLowerCase(), ROLES, 'Role');
      const { user, emailSent } = await inviteUser(req, { name, email, role });
      created.push({ line, id: user._id, name, email, role, emailSent });
    } catch (err) {
      errors.push({ line, error: err.code === 11000 ? 'This email already has an account.' : err.message });
    }
  }
  return { created, errors };
}

async function describeInvite(token) {
  const user = await findInvitedUser(token);
  const org = await Organization.findById(user.org).select('name');
  return { name: user.name, email: user.email, role: user.role, orgName: org.name };
}

async function findInvitedUser(token) {
  const userId = links.idFromToken(token);
  const user = userId && (await User.findById(userId).select('+inviteNonce +passwordHash'));
  if (!user || !user.inviteNonce || !links.matches('invite', token, user.inviteNonce)) {
    throw httpError(404, 'This invite link is not valid or has already been used.');
  }
  if (user.inviteExpiresAt < new Date()) throw httpError(410, 'This invite has expired. Ask your HR team to send a new one.');
  if (!user.active) throw httpError(403, 'This account has been deactivated.');
  return user;
}

async function acceptInvite(token, password) {
  const user = await findInvitedUser(token);
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  // Only succeeds if the nonce is still the one in the link, so the link works exactly once.
  const result = await User.updateOne(
    { _id: user._id, inviteNonce: user.inviteNonce },
    { $set: { passwordHash }, $unset: { inviteNonce: 1, inviteExpiresAt: 1 } }
  );
  if (result.modifiedCount !== 1) throw httpError(409, 'This invite link has already been used.');
  await audit({ org: user.org, actor: user._id, action: 'user.invite.accept', entity: 'User', entityId: user._id });
  const org = await Organization.findById(user.org).select('name');
  return { token: loginToken(user), user: publicUser(user, org.name) };
}

// Runs a bcrypt check even when the email is unknown, so both cases take the same time
// and nobody can find out which emails have accounts by timing the reply.
const DUMMY_HASH = bcrypt.hashSync('fairview-timing-guard', BCRYPT_COST);

async function login(email, password) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !user.passwordHash || !ok) throw httpError(401, 'Wrong email or password.');
  if (!user.active) throw httpError(403, 'This account has been deactivated. Contact your HR team.');
  const org = await Organization.findById(user.org).select('name');
  return { token: loginToken(user), user: publicUser(user, org.name) };
}

module.exports = {
  signupOrganization, inviteUser, resendInvite, importUsers, describeInvite, acceptInvite, login, publicUser,
};
