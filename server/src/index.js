// Starts the real server: connect to the database, then listen for requests.
const { required, port } = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');

async function start() {
  required('JWT_SECRET'); // fail fast if the secret is missing
  await connectDB(required('MONGODB_URI'));
  app.listen(port, () => console.log(`FairView API running on http://localhost:${port}`));
}

start().catch((err) => {
  console.error('Could not start the server:', err.message);
  process.exit(1);
});
