// Sends email. With SMTP_URL set, mail goes out through that server (Gmail, SendGrid,
// Brevo... all give an SMTP address). Without it, mail is printed to the console and kept
// in a small in-memory outbox, which is enough for local development and the tests.
const { smtpUrl, mailFrom, isTest } = require('../config/env');

const OUTBOX_SIZE = 50;
const outbox = []; // newest first

let transport = null;
function getTransport() {
  if (!smtpUrl) return null;
  if (!transport) transport = require('nodemailer').createTransport(smtpUrl);
  return transport;
}

async function sendMail({ to, subject, text }) {
  const smtp = getTransport();
  if (smtp) {
    await smtp.sendMail({ from: mailFrom, to, subject, text });
    return 'smtp';
  }
  outbox.unshift({ to, subject, text, at: new Date().toISOString() });
  outbox.length = Math.min(outbox.length, OUTBOX_SIZE);
  if (!isTest) console.log(`\n--- email to ${to} ---\nSubject: ${subject}\n\n${text}\n---------------------\n`);
  return 'console';
}

module.exports = { sendMail, outbox };
