const audit = require('../utils/audit');

// For locked records (ratings): any attempt to edit or delete is refused with 403
// AND written to the audit log, so HR can see who tried.
function blockEdits(entity) {
  return async (req, res) => {
    await audit({
      actor: req.user.id,
      action: `${entity}.${req.method.toLowerCase()}`,
      entity,
      entityId: req.params.id,
      outcome: 'blocked',
      detail: `Tried to ${req.method} a locked ${entity}`,
    });
    return res.status(403).json({ error: `${entity} records are locked and cannot be changed or deleted.` });
  };
}

module.exports = blockEdits;
