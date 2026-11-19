const AuditLog = require('../models/AuditLog');

// Writes one line in the permanent audit log.
// Pass a session to write it inside the same transaction as the action itself:
// then the action and its audit line are saved together, or not at all.
async function audit({ org, actor, actorLabel, action, entity, entityId, outcome = 'allowed', detail }, session) {
  const entry = {
    org,
    actor,
    actorLabel,
    action,
    entity,
    entityId: entityId ? String(entityId) : undefined,
    outcome,
    detail: detail ? String(detail).slice(0, 500) : undefined,
  };
  await AuditLog.create([entry], session ? { session } : undefined);
}

// Shortcut for the usual case: the logged-in user did something.
function auditBy(req, fields, session) {
  return audit({ org: req.user.org, actor: req.user.id, ...fields }, session);
}

module.exports = audit;
module.exports.auditBy = auditBy;
