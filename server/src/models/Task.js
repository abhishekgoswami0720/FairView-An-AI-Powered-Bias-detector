const mongoose = require('mongoose');
const { Schema } = mongoose;

// One piece of work (like a Jira ticket) with exactly one owner.
// Status flow: assigned -> in_progress -> submitted -> delivered
// The manager can send submitted work back to in_progress (rework) until he rates it.
// Whether it has been rated is NOT stored here: the rating records are the only truth.
const taskSchema = new Schema(
  {
    org: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, immutable: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, immutable: true },
    manager: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    employee: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000 },
    status: {
      type: String,
      enum: ['assigned', 'in_progress', 'submitted', 'delivered'],
      default: 'assigned',
    },
    submission: { type: String, trim: true, maxlength: 5000 },
    submittedAt: Date,
    deliveredAt: Date,
    // When the last rating link for this task stops working. After this moment, or once
    // the client has rated, both ratings are shown to the employee.
    ratingWindowEndsAt: Date,
  },
  { timestamps: true }
);

taskSchema.index({ org: 1, employee: 1 });
taskSchema.index({ org: 1, manager: 1, status: 1 });
taskSchema.index({ project: 1 });

module.exports = mongoose.model('Task', taskSchema);
