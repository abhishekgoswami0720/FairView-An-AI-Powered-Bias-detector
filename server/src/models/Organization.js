const mongoose = require('mongoose');
const { Schema } = mongoose;

// One company using FairView. Every other record belongs to exactly one organization,
// and no query ever mixes data from two organizations.
const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // Result of the last gap analysis run, shown to HR.
    analysis: {
      lastRunAt: Date,
      lastStatus: { type: String, enum: ['ok', 'failed', 'disabled'] },
      lastError: { type: String, maxlength: 500 },
      pairsAnalysed: Number,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Organization', organizationSchema);
