const mongoose = require('mongoose');
const { Schema } = mongoose;

// A one-time link that lets the client rate one piece of work without an account.
// The link itself is never stored: it is rebuilt from this record's id and a secret
// key (see services/links.js), so a copy of the database cannot be used to rate.
const ratingLinkSchema = new Schema(
  {
    org: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, immutable: true },
    task: { type: Schema.Types.ObjectId, ref: 'Task', required: true, immutable: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, immutable: true },
    clientName: { type: String, trim: true, immutable: true },
    clientEmail: { type: String, required: true, lowercase: true, trim: true, immutable: true },
    expiresAt: { type: Date, required: true },
    usedAt: Date,      // set when the client rates; the link never works again
    revokedAt: Date,   // set when a newer link replaces this one
    sentAt: Date,
    remindedAt: Date,  // at most one reminder per link
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

ratingLinkSchema.index({ usedAt: 1, revokedAt: 1, remindedAt: 1, sentAt: 1 });

module.exports = mongoose.model('RatingLink', ratingLinkSchema);
