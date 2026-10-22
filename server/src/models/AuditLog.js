const mongoose = require('mongoose');
const { Schema } = mongoose;
const { lockRecord } = require('./lockRecord');

// A permanent diary of important actions. Entries can be added, never changed or deleted.
const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },      // e.g. 'rating.create', 'rating.edit'
    entity: { type: String, required: true },      // e.g. 'ClientRating'
    entityId: { type: String },
    outcome: { type: String, enum: ['allowed', 'blocked'], required: true },
    detail: { type: String, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.plugin(lockRecord, { modelName: 'AuditLog' });

module.exports = mongoose.model('AuditLog', auditLogSchema);
