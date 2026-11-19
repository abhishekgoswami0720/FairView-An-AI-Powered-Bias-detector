// Starts the real server: connect to the database, then listen for requests.
const { required, port, isProduction, smtpUrl, mlUrl } = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');

async function start() {
  required('JWT_SECRET'); // fail fast if the secret is missing
  await connectDB(required('MONGODB_URI'));
  if (!smtpUrl) console.warn(isProduction ? 'WARNING: SMTP_URL is not set, so no email will reach clients.' : 'No SMTP_URL: emails are printed here instead of being sent.');
  if (!mlUrl) console.warn('No ML_URL: the gap analysis is switched off.');
  app.listen(port, () => console.log(`FairView API running on http://localhost:${port}`));
}

start().catch((err) => {
  console.error('Could not start the server:', err.message);
  process.exit(1);
});
