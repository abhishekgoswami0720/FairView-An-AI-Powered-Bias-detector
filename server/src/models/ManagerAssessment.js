const mongoose = require('mongoose');
const { Schema } = mongoose;
const { lockRecord } = require('./lockRecord');

// The manager's own rating of one task.
// It is LOCKED once saved, and must be given BEFORE the project is delivered,
// so the manager never sees the client's score before rating.
const managerAssessmentSchema = new Schema(
  {
    task: { type: Schema.Types.ObjectId, ref: 'Task', required: true, unique: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    manager: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    employee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    score: {
      type: Number, required: true, min: 1, max: 10,
      validate: { validator: Number.isInteger, message: 'Score must be a whole number from 1 to 10.' },
    },
    feedback: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

managerAssessmentSchema.plugin(lockRecord, { modelName: 'ManagerAssessment' });

module.exports = mongoose.model('ManagerAssessment', managerAssessmentSchema);
