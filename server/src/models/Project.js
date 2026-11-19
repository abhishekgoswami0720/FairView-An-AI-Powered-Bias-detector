const mongoose = require('mongoose');
const { Schema } = mongoose;

const EMAIL = [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Client email is not a valid email address.'];

// A client project run by one manager. The client is a contact, not a user:
// every finished piece of work is sent to this email for a 10-second rating.
const projectSchema = new Schema(
  {
    org: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, immutable: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000 },
    // immutable: the manager of a project can never be swapped (see Decision.md D-20).
    manager: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    client: {
      name: { type: String, required: true, trim: true, maxlength: 120 },
      email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254, match: EMAIL },
      company: { type: String, trim: true, maxlength: 120 },
    },
    // closed projects take no new tasks.
    status: { type: String, enum: ['active', 'closed'], default: 'active' },
  },
  { timestamps: true }
);

projectSchema.index({ org: 1, manager: 1 });

module.exports = mongoose.model('Project', projectSchema);
