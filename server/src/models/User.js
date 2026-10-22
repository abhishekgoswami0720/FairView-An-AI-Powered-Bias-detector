const mongoose = require('mongoose');

const ROLES = ['client', 'manager', 'employee', 'hr'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // The password is stored only as a scrambled hash.
    // select: false means it is never returned unless we ask for it on purpose.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
