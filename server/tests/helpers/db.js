// Each test file gets its own empty database inside the shared test replica set.
const mongoose = require('mongoose');
const crypto = require('crypto');

async function connect() {
  const dbName = `fv_test_${crypto.randomBytes(4).toString('hex')}`;
  // runtimeAdapters: the MongoDB driver normally loads 'os' with a dynamic import(), which
  // Jest's sandbox does not support, and the connection then fails with a confusing
  // "Missing required sub-document 'driver'" error. Handing it 'os' directly avoids that.
  await mongoose.connect(process.env.MONGO_TEST_URI, { dbName, runtimeAdapters: { os: require('os') } });
  // Build the unique indexes before any test relies on them.
  for (const model of Object.values(mongoose.models)) await model.createIndexes();
}

async function disconnect() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

module.exports = { connect, disconnect };
