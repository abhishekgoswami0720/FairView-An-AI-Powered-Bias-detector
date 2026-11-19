// The emails FairView sends, and the code that sends them.
// Emails are always sent AFTER the database change has been saved, never inside a
// transaction, so a failed save can never have sent an email.
const Organization = require('../models/Organization');
const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const RatingLink = require('../models/RatingLink');
const { sendMail } = require('./mailer');
const links = require('./links');

const day = (date) => new Date(date).toDateString();

function ratingEmail({ kind, clientName, orgName, employeeName, taskTitle, projectName, url, expiresAt }) {
  const reminder = kind === 'reminder';
  return {
    subject: reminder
      ? `Reminder: how was "${taskTitle}"?`
      : `How was "${taskTitle}"? Rate ${employeeName}'s work in 10 seconds`,
    text: [
      `Hi ${clientName ? clientName.split(' ')[0] : 'there'},`,
      '',
      reminder
        ? `${orgName} delivered "${taskTitle}" (${projectName}) a few days ago and would still value your rating.`
        : `${orgName} has delivered "${taskTitle}" on ${projectName}. It was built by ${employeeName}.`,
      '',
      'How good was it? One tap on 1 to 5 stars, no account needed:',
      url,
      '',
      `Your rating goes on ${employeeName}'s record and cannot be changed by anyone, including their manager.`,
      `The link works once and expires on ${day(expiresAt)}.`,
      '',
      'FairView',
    ].join('\n'),
  };
}

// Sends the rating link (first time or reminder) and records when it was sent.
// Returns true if the email went out, false if it failed (the link still exists and can be resent).
async function sendRatingLink(linkId, kind = 'request') {
  try {
    const link = await RatingLink.findById(linkId);
    const [org, project, task] = await Promise.all([
      Organization.findById(link.org).select('name'),
      Project.findById(link.project).select('name'),
      Task.findById(link.task).select('title employee'),
    ]);
    const employee = await User.findById(task.employee).select('name');
    const mail = ratingEmail({
      kind,
      clientName: link.clientName,
      orgName: org.name,
      employeeName: employee.name,
      taskTitle: task.title,
      projectName: project.name,
      url: links.ratingUrl(link._id),
      expiresAt: link.expiresAt,
    });
    await sendMail({ to: link.clientEmail, ...mail });
    // RatingLink is not a locked model, so this update is allowed.
    await RatingLink.updateOne({ _id: link._id }, { $set: kind === 'reminder' ? { remindedAt: new Date() } : { sentAt: new Date() } });
    return true;
  } catch (err) {
    console.error(`Could not send rating email for link ${linkId}:`, err.message);
    return false;
  }
}

async function sendInvite(userId, nonce, invitedByName) {
  try {
    const user = await User.findById(userId).select('name email role org inviteExpiresAt');
    const org = await Organization.findById(user.org).select('name');
    await sendMail({
      to: user.email,
      subject: `${invitedByName} invited you to ${org.name} on FairView`,
      text: [
        `Hi ${user.name},`,
        '',
        `${invitedByName} has added you to ${org.name} on FairView as ${user.role === 'hr' ? 'an HR admin' : `a ${user.role}`}.`,
        'Choose your password here to get started:',
        links.inviteUrl(user._id, nonce),
        '',
        `This link works once and expires on ${day(user.inviteExpiresAt)}.`,
        '',
        'FairView',
      ].join('\n'),
    });
    return true;
  } catch (err) {
    console.error(`Could not send invite to user ${userId}:`, err.message);
    return false;
  }
}

module.exports = { sendRatingLink, sendInvite, ratingEmail };
