const mongoose = require('mongoose');

async function connectDB(uri) {
  // Give up after 5 seconds instead of 30, so a wrong address fails quickly with a clear message.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log('Connected to MongoDB');
}

module.exports = connectDB;
