const mongoose = require('mongoose');
const { Schema } = mongoose;
const { lockRecord } = require('./lockRecord');

// A permanent diary of important actions. Entries can be added, never changed or deleted.
const auditLogSchema = new Schema(
  {
    org: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },  // empty for clients and the system
    actorLabel: { type: String, maxlength: 300 },          // e.g. 'client mark@client.com'
    action: { type: String, required: true },              // e.g. 'task.deliver', 'rating.client.create'
    entity: { type: String, required: true },              // e.g. 'ClientRating'
    entityId: { type: String },
    outcome: { type: String, enum: ['allowed', 'blocked'], required: true },
    detail: { type: String, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ org: 1, createdAt: -1 });
auditLogSchema.plugin(lockRecord, { modelName: 'AuditLog' });

module.exports = mongoose.model('AuditLog', auditLogSchema);
