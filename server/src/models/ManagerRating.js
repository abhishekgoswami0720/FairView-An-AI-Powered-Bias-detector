const mongoose = require('mongoose');
const { Schema } = mongoose;
const { lockRecord } = require('./lockRecord');

// The manager's rating of one piece of work. Given BEFORE the work goes to the client,
// so the manager never sees the client's score first. LOCKED once saved.
const managerRatingSchema = new Schema(
  {
    org: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    // unique: one manager rating per piece of work.
    task: { type: Schema.Types.ObjectId, ref: 'Task', required: true, unique: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    manager: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    employee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    score: {
      type: Number, required: true, min: 1, max: 5,
      validate: { validator: Number.isInteger, message: 'Choose 1 to 5 stars.' },
    },
    comment: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

managerRatingSchema.index({ org: 1, manager: 1, employee: 1 });
managerRatingSchema.plugin(lockRecord, { modelName: 'ManagerRating' });

module.exports = mongoose.model('ManagerRating', managerRatingSchema);
