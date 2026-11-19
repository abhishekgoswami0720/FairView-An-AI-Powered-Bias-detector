const mongoose = require('mongoose');
const { Schema } = mongoose;

// Clients are NOT users: they rate through a one-time link and never log in.
const ROLES = ['hr', 'manager', 'employee'];

const userSchema = new Schema(
  {
    org: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, immutable: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email is not a valid email address.'],
    },
    // Stored only as a bcrypt hash. Empty until the person accepts their invite.
    // select: false means it is never read unless the code asks for it on purpose.
    passwordHash: { type: String, select: false },
    role: { type: String, enum: ROLES, required: true },
    // People who leave are deactivated, never deleted, so their ratings keep a name.
    active: { type: Boolean, default: true },
    // Invite link data. The nonce changes on every new invite, which kills older links.
    inviteNonce: { type: String, select: false },
    inviteExpiresAt: { type: Date },
  },
  { timestamps: true }
);

// Never send secrets in an API reply, even if they were loaded by mistake.
userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.passwordHash;
    delete ret.inviteNonce;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
