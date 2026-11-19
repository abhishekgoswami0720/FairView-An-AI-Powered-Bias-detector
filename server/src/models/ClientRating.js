const mongoose = require('mongoose');
const { Schema } = mongoose;
const { lockRecord } = require('./lockRecord');

// The client's rating of one delivered piece of work, given through a one-time link.
// This is the "second witness" at the heart of FairView, so it is LOCKED:
// nobody (not the manager, not HR, not the client) can edit or delete it.
const clientRatingSchema = new Schema(
  {
    org: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    // unique: one client rating per piece of work.
    task: { type: Schema.Types.ObjectId, ref: 'Task', required: true, unique: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    // Copied from the task so the gap analysis needs no extra lookups.
    manager: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    employee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    score: {
      type: Number, required: true, min: 1, max: 5,
      validate: { validator: Number.isInteger, message: 'Choose 1 to 5 stars.' },
    },
    comment: { type: String, trim: true, maxlength: 1000 },
    // Who rated, as it was at that moment (the project's client contact can change later).
    clientName: { type: String, trim: true, maxlength: 120 },
    clientEmail: { type: String, trim: true, lowercase: true, maxlength: 254 },
    link: { type: Schema.Types.ObjectId, ref: 'RatingLink' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

clientRatingSchema.index({ org: 1, manager: 1, employee: 1 });
clientRatingSchema.plugin(lockRecord, { modelName: 'ClientRating' });

module.exports = mongoose.model('ClientRating', clientRatingSchema);
