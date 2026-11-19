// Sends ONE reminder for each rating link that has not been used after a few days
// (REMINDER_AFTER_DAYS, default 3). Run it once a day, for example with cron:
//   0 10 * * *  cd /path/to/server && npm run reminders
const mongoose = require('mongoose');
const { required, reminderAfterDays } = require('../config/env');
const connectDB = require('../config/db');
const RatingLink = require('../models/RatingLink');
const { sendRatingLink } = require('../services/emails');

async function main() {
  await connectDB(required('MONGODB_URI'));
  const now = new Date();
  const due = await RatingLink.find({
    usedAt: null,
    revokedAt: null,
    remindedAt: null,
    expiresAt: { $gt: now },
    sentAt: { $lt: new Date(now.getTime() - reminderAfterDays * 24 * 60 * 60 * 1000) },
  }).select('_id');
  let sent = 0;
  for (const link of due) if (await sendRatingLink(link._id, 'reminder')) sent += 1;
  console.log(`Reminders sent: ${sent} of ${due.length} due.`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
