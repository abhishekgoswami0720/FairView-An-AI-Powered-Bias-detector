const mongoose = require('mongoose');
const { Schema } = mongoose;
const { lockRecord } = require('./lockRecord');

// The client's rating of a whole delivered project.
// This is the "outside check" at the heart of FairView, so it is LOCKED:
// nobody (not the manager, not HR, not the client) can edit or delete it.
const clientRatingSchema = new Schema(
  {
    // unique: a project can be rated only once.
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
    client: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    score: {
      type: Number, required: true, min: 1, max: 10,
      validate: { validator: Number.isInteger, message: 'Score must be a whole number from 1 to 10.' },
    },
    review: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

clientRatingSchema.plugin(lockRecord, { modelName: 'ClientRating' });

module.exports = mongoose.model('ClientRating', clientRatingSchema);
