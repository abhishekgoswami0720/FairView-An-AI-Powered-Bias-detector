// Starts one throw-away MongoDB replica set for the whole test run.
// It runs in memory, so the tests need no database of your own. The first run downloads a
// MongoDB program (about 100 MB); set MONGOMS_SYSTEM_BINARY to use one you already have.
const { MongoMemoryReplSet } = require('mongodb-memory-server');

module.exports = async () => {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  globalThis.__MONGO_REPLSET__ = replSet;
  process.env.MONGO_TEST_URI = replSet.getUri();
};
