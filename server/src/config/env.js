// Reads settings from the .env file and stops the server early if something important is missing.
require('dotenv').config({ quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env (see .env.example)`);
  return value;
}

// "a, b ,c" -> ['a', 'b', 'c']
function list(name, fallback) {
  return (process.env[name] || fallback)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  required,
  isProduction,
  isTest: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT) || 5000,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  // Websites allowed to call the API from a browser (the React app).
  corsOrigins: list('CORS_ORIGIN', 'http://localhost:5173'),
  // Where the React app lives. Rating and invite links in emails point here.
  appUrl: (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  // Number of proxies in front of the server (Render, Railway, Nginx...), for correct client IPs.
  trustProxy: Number(process.env.TRUST_PROXY) || 0,
  rateLimitOff: process.env.RATE_LIMIT === 'off',

  // Email. Without SMTP_URL, emails are printed to the console instead of being sent.
  smtpUrl: process.env.SMTP_URL || '',
  mailFrom: process.env.MAIL_FROM || 'FairView <no-reply@fairview.local>',
  // Shows sent emails at GET /api/dev/outbox. Never available in production.
  devOutbox: process.env.DEV_OUTBOX === 'true' && !isProduction,

  // The Python ML service. Leave ML_URL empty to switch the gap analysis off.
  mlUrl: (process.env.ML_URL || '').replace(/\/$/, ''),
  mlApiKey: process.env.ML_API_KEY || '',
  autoAnalysis: process.env.AUTO_ANALYSIS !== 'false',

  ratingLinkDays: Number(process.env.RATING_LINK_DAYS) || 14,
  reminderAfterDays: Number(process.env.REMINDER_AFTER_DAYS) || 3,
  inviteDays: 7,
  maxLinksPerTask: 3,

  // Gap analysis rules (sent to the ML service with every request).
  analysis: {
    minPair: 10,     // rated pieces of work needed for one manager-employee pair
    minRest: 10,     // rated pieces of work the manager gave his OTHER employees
    threshold: 2.5,  // |z| at or above this raises a Gap Card (chosen from ml/reports/evaluation.md)
    reflagAfter: 5,  // new ratings needed before a reviewed pair can be flagged again
  },
};
