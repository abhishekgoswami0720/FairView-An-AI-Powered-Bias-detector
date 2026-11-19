const express = require('express');
const { requireAuth } = require('../middleware/auth');
const blockEdits = require('../middleware/blockEdits');

const router = express.Router();
router.use(requireAuth);

// THE LOCK: there is no way to edit or delete a rating.
// Every attempt, by any role (HR included), gets 403 and is written to the audit log.
// Ratings are created through /api/tasks/:id/rating (manager) and /api/public/rate/:token (client).
for (const [path, entity] of [['/client/:id', 'ClientRating'], ['/manager/:id', 'ManagerRating']]) {
  router.put(path, blockEdits(entity));
  router.patch(path, blockEdits(entity));
  router.delete(path, blockEdits(entity));
}

module.exports = router;
