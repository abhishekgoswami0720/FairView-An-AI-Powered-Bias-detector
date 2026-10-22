const mongoose = require('mongoose');
const { Schema } = mongoose;

// A task is one piece of a project, given to one employee.
// Status flow: assigned -> in_progress -> submitted
// The manager can send submitted work back to in_progress (rework).
const taskSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, immutable: true },
    manager: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    employee: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    // workShare = how much of the project this task is (0.7 = 70%).
    // immutable: fixed when the task is created, so nobody can change it
    // later to hide unfairness (see synopsis section 11.2).
    workShare: { type: Number, required: true, min: 0.01, max: 1, immutable: true },
    status: { type: String, enum: ['assigned', 'in_progress', 'submitted'], default: 'assigned' },
    submission: { type: String, trim: true, maxlength: 5000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);
