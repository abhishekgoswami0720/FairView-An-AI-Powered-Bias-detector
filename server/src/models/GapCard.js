const mongoose = require('mongoose');
const { Schema } = mongoose;

// The numbers behind a Gap Card. "gap" = manager stars - client stars for the same work.
const statsFields = {
  n: Number,             // rated pieces of work for this manager-employee pair
  managerAvg: Number,    // the manager's average stars for this employee
  clientAvg: Number,     // the clients' average stars for the same work
  meanGap: Number,       // average gap for this pair
  restN: Number,         // ratings the manager gave his other employees
  restMeanGap: Number,   // his usual gap with everyone else
  z: Number,             // how unusual this pair's gap is (|z| >= 2 raises a card)
  direction: { type: String, enum: ['lower', 'higher'] }, // rates this person lower or higher than usual
  patternScore: Number,  // Isolation Forest: 0 = ordinary, 1 = most unusual pattern in the company
};

// A Gap Card tells HR: "this manager's ratings of this person keep landing far from
// the clients' ratings of the same work. Worth a look." It is never a verdict.
const gapCardSchema = new Schema(
  {
    org: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, immutable: true },
    manager: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    employee: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    status: { type: String, enum: ['open', 'reviewed'], default: 'open' },
    // The numbers when the card was raised. Never changed, so the reason for the card stays on record.
    snapshot: { type: new Schema(statsFields, { _id: false }), immutable: true },
    // The numbers from the latest analysis run, updated while the card is open.
    latest: new Schema(statsFields, { _id: false }),
    latestAt: Date,
    review: {
      by: { type: Schema.Types.ObjectId, ref: 'User' },
      at: Date,
      outcome: { type: String, enum: ['no_issue', 'discussed_with_manager', 'escalated'] },
      note: { type: String, trim: true, maxlength: 2000 },
    },
  },
  { timestamps: true }
);

// At most one OPEN card per manager-employee pair.
gapCardSchema.index(
  { org: 1, manager: 1, employee: 1 },
  { unique: true, partialFilterExpression: { status: 'open' } }
);
gapCardSchema.index({ org: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('GapCard', gapCardSchema);
