const mongoose = require('mongoose');

async function connectDB(uri) {
  // Give up after 5 seconds instead of 30, so a wrong address fails quickly with a clear message.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await assertReplicaSet();
  console.log('Connected to MongoDB');
}

// Ratings are saved in transactions (all steps or none), and MongoDB only
// supports transactions on a replica set. Atlas always is one.
async function assertReplicaSet() {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    await mongoose.disconnect();
    throw new Error(
      'MongoDB must run as a replica set, because FairView saves ratings in transactions. ' +
        'MongoDB Atlas already is one. For a local MongoDB, see "Local MongoDB" in server/README.md.'
    );
  }
}

module.exports = connectDB;
