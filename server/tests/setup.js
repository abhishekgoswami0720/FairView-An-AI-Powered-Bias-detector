// Runs before every test file.
const mongoose = require('mongoose');
process.env.JWT_SECRET = 'test-secret-only-for-tests';
// No database in unit tests: any accidental database call fails immediately instead of hanging.
mongoose.set('bufferCommands', false);
