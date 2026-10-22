const AuditLog = require('../models/AuditLog');

// Writes one line in the permanent audit log.
async function audit({ actor, action, entity, entityId, outcome = 'allowed', detail }) {
  await AuditLog.create({
    actor,
    action,
    entity,
    entityId: entityId ? String(entityId) : undefined,
    outcome,
    detail,
  });
}

module.exports = audit;
