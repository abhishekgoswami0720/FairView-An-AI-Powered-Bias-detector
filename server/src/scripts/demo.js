// npm run demo
// Runs FairView with a temporary MongoDB inside this process: no Atlas, no IP list, no
// database setup. The demo company is created on every start, and everything is thrown
// away when you stop it (Ctrl+C). The first run downloads MongoDB (about 100 MB) once.
//
// Use it for demos and when Atlas can't be reached. For real data, use "npm run dev".
const crypto = require('crypto');
require('dotenv').config({ quiet: true });

async function main() {
  console.log('Starting a temporary database in memory (the first run downloads MongoDB, about 100 MB)...');
  const { MongoMemoryReplSet } = require('mongodb-memory-server');
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });

  // Settings for the demo. These win over .env, so your Atlas address is never touched.
  process.env.MONGODB_URI = replSet.getUri('fairview');
  process.env.JWT_SECRET ||= crypto.randomBytes(32).toString('hex');
  process.env.DEV_OUTBOX ??= 'true';

  // Loaded only now, so they read the settings above.
  const mongoose = require('mongoose');
  const connectDB = require('../config/db');
  const { seedDemo } = require('./seed');
  const app = require('../app');
  const { port, mlUrl } = require('../config/env');

  await connectDB(process.env.MONGODB_URI);
  await seedDemo();
  const server = app.listen(port, () => {
    console.log(`\nFairView demo API running on http://localhost:${port}`);
    console.log('Now start the web app (cd client, npm run dev) and open http://localhost:5173');
    if (!mlUrl) console.log('Tip: start the ML service and set ML_URL in .env to see Gap Cards.');
    console.log('Press Ctrl+C to stop. All demo data is deleted when you stop.');
  });

  const stop = async () => {
    server.close();
    await mongoose.disconnect();
    await replSet.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error('Could not start the demo:', err.message);
  process.exit(1);
});
