// The steps of FairView's core loop that change more than one record.
// Each one runs in a transaction: every step is saved, or none is.
//
//   manager rates (blind)  ->  deliver (creates a rating link)  ->  client rates through the link
const mongoose = require('mongoose');
const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const Organization = require('../models/Organization');
const ManagerRating = require('../models/ManagerRating');
const ClientRating = require('../models/ClientRating');
const RatingLink = require('../models/RatingLink');
const audit = require('../utils/audit');
const { auditBy } = require('../utils/audit');
const httpError = require('../utils/httpError');
const sameId = require('../utils/sameId');
const { ratingLinkDays, maxLinksPerTask } = require('../config/env');
const links = require('./links');
const emails = require('./emails');
const analysis = require('./analysis');

const DAY = 24 * 60 * 60 * 1000;
const transaction = (fn) => mongoose.connection.transaction(fn);

async function loadOwnTask(req, taskId, session) {
  const task = await Task.findOne({ _id: taskId, org: req.user.org }).session(session || null);
  if (!task) throw httpError(404, 'Task not found.');
  if (!sameId(task.manager, req.user.id)) throw httpError(403, 'This is not your task.');
  return task;
}

// 1. The manager rates submitted work. He has not seen the client's rating, because the
//    client can only rate after delivery, and delivery needs this rating first.
async function rateAsManager(req, taskId, { score, comment }) {
  let rating;
  await transaction(async (session) => {
    const task = await loadOwnTask(req, taskId, session);
    if (task.status !== 'submitted') {
      throw httpError(409, task.status === 'delivered' ? 'This work is already delivered.' : 'You can rate work only after it is submitted.');
    }
    if (await ManagerRating.exists({ task: task._id }).session(session)) {
      throw httpError(409, 'You have already rated this work. Ratings cannot be changed.');
    }
    [rating] = await ManagerRating.create(
      [{ org: task.org, task: task._id, project: task.project, manager: task.manager, employee: task.employee, score, comment }],
      { session }
    );
    await auditBy(req, { action: 'rating.manager.create', entity: 'ManagerRating', entityId: rating._id }, session);
  });
  return rating;
}

// 2. Deliver: the work goes to the client and a one-time rating link is created.
//    The email is sent only after everything is saved.
async function deliverTask(req, taskId) {
  let task;
  let link;
  await transaction(async (session) => {
    task = await loadOwnTask(req, taskId, session);
    if (task.status === 'delivered') throw httpError(409, 'This work is already delivered.');
    if (task.status !== 'submitted') throw httpError(409, 'The work has not been submitted yet.');
    if (!(await ManagerRating.exists({ task: task._id }).session(session))) {
      throw httpError(409, 'Rate this work before delivering it. You rate first, then the client.');
    }
    const project = await Project.findById(task.project).session(session);
    const expiresAt = new Date(Date.now() + ratingLinkDays * DAY);
    [link] = await RatingLink.create(
      [{
        org: task.org, task: task._id, project: project._id,
        clientName: project.client.name, clientEmail: project.client.email,
        expiresAt, createdBy: req.user.id,
      }],
      { session }
    );
    task.status = 'delivered';
    task.deliveredAt = new Date();
    task.ratingWindowEndsAt = expiresAt;
    await task.save({ session });
    await auditBy(req, { action: 'task.deliver', entity: 'Task', entityId: task._id, detail: `Rating link sent to ${project.client.email}` }, session);
  });
  const emailSent = await emails.sendRatingLink(link._id, 'request');
  return { task, emailSent };
}

// Sends a fresh link when the first one was lost or expired. Older links stop working.
// Allowed for the task's manager and HR, only while the client has not rated.
async function resendRatingLink(req, taskId) {
  let link;
  await transaction(async (session) => {
    const task = await Task.findOne({ _id: taskId, org: req.user.org }).session(session);
    if (!task) throw httpError(404, 'Task not found.');
    if (req.user.role !== 'hr' && !sameId(task.manager, req.user.id)) throw httpError(403, 'This is not your task.');
    if (task.status !== 'delivered') throw httpError(409, 'Only delivered work has a rating link.');
    if (await ClientRating.exists({ task: task._id }).session(session)) throw httpError(409, 'The client has already rated this work.');
    if ((await RatingLink.countDocuments({ task: task._id }).session(session)) >= maxLinksPerTask) {
      throw httpError(409, `A rating link has already been sent ${maxLinksPerTask} times for this work.`);
    }
    const project = await Project.findById(task.project).session(session);
    const now = new Date();
    await RatingLink.updateMany({ task: task._id, usedAt: null, revokedAt: null }, { $set: { revokedAt: now } }, { session });
    const expiresAt = new Date(now.getTime() + ratingLinkDays * DAY);
    [link] = await RatingLink.create(
      [{
        org: task.org, task: task._id, project: project._id,
        clientName: project.client.name, clientEmail: project.client.email,
        expiresAt, createdBy: req.user.id,
      }],
      { session }
    );
    task.ratingWindowEndsAt = expiresAt;
    await task.save({ session });
    await auditBy(req, { action: 'ratinglink.resend', entity: 'Task', entityId: task._id, detail: `New link sent to ${project.client.email}` }, session);
  });
  const emailSent = await emails.sendRatingLink(link._id, 'request');
  return { emailSent };
}

// What the client sees when opening the link. Never reveals the manager's rating.
async function describeRatingLink(token) {
  const linkId = links.idFromToken(token);
  if (!linkId || !links.matches('rate', token)) throw httpError(404, 'This rating link is not valid.');
  const link = await RatingLink.findById(linkId);
  if (!link) throw httpError(404, 'This rating link is not valid.');
  const [org, project, task] = await Promise.all([
    Organization.findById(link.org).select('name'),
    Project.findById(link.project).select('name'),
    Task.findById(link.task).select('title description submission employee'),
  ]);
  const employee = await User.findById(task.employee).select('name');
  let state = 'ready';
  if (link.usedAt) state = 'used';
  else if (link.revokedAt) state = 'replaced';
  else if (link.expiresAt < new Date()) state = 'expired';
  return {
    state,
    orgName: org.name,
    projectName: project.name,
    taskTitle: task.title,
    taskDescription: task.description || null,
    submission: task.submission || null,
    employeeName: employee.name,
    clientName: link.clientName,
    expiresAt: link.expiresAt,
  };
}

// 3. The client rates. Input is checked BEFORE the link is used up, so a typo never wastes a link.
async function submitClientRating(token, { score, comment }) {
  const linkId = links.idFromToken(token);
  if (!linkId || !links.matches('rate', token)) throw httpError(404, 'This rating link is not valid.');
  let rating;
  await transaction(async (session) => {
    const link = await RatingLink.findById(linkId).session(session);
    if (!link) throw httpError(404, 'This rating link is not valid.');
    if (link.usedAt) throw httpError(409, 'This work has already been rated. Thank you!');
    if (link.revokedAt) throw httpError(410, 'This link was replaced by a newer one. Please use the latest email.');
    if (link.expiresAt < new Date()) throw httpError(410, 'This link has expired. Ask the team to send a new one.');
    const task = await Task.findById(link.task).session(session);
    // Claim the link: only one request can ever change usedAt from empty to a date.
    const claimed = await RatingLink.updateOne(
      { _id: link._id, usedAt: null, revokedAt: null },
      { $set: { usedAt: new Date() } },
      { session }
    );
    if (claimed.modifiedCount !== 1) throw httpError(409, 'This work has already been rated. Thank you!');
    [rating] = await ClientRating.create(
      [{
        org: task.org, task: task._id, project: task.project, manager: task.manager, employee: task.employee,
        score, comment, clientName: link.clientName, clientEmail: link.clientEmail, link: link._id,
      }],
      { session }
    );
    await audit(
      { org: task.org, actorLabel: `client ${link.clientEmail}`, action: 'rating.client.create', entity: 'ClientRating', entityId: rating._id },
      session
    );
  });
  analysis.schedule(rating.org);
  return rating;
}

module.exports = { rateAsManager, deliverTask, resendRatingLink, describeRatingLink, submitClientRating };
