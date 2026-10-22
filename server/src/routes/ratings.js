const express = require('express');
const ClientRating = require('../models/ClientRating');
const Project = require('../models/Project');
const Task = require('../models/Task');
const { requireAuth, requireRole } = require('../middleware/auth');
const blockEdits = require('../middleware/blockEdits');
const httpError = require('../utils/httpError');
const sameId = require('../utils/sameId');
const audit = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

// POST /api/ratings  (client) { projectId, score, review }
// The client rates their own delivered project. The rating is locked the moment it is saved.
router.post('/', requireRole('client'), async (req, res) => {
  const { projectId, score, review } = req.body || {};
  const project = await Project.findById(projectId);
  if (!project) throw httpError(404, 'Project not found.');
  if (!sameId(project.client, req.user.id)) throw httpError(403, 'This is not your project.');
  if (project.status === 'rated') throw httpError(409, 'This project has already been rated.');
  if (project.status !== 'delivered') throw httpError(409, 'You can rate a project only after it is delivered.');

  const rating = await ClientRating.create({ project: project._id, client: req.user.id, score, review });
  project.status = 'rated';
  await project.save();
  await audit({ actor: req.user.id, action: 'rating.create', entity: 'ClientRating', entityId: rating._id });
  res.status(201).json(rating);
});

// GET /api/ratings/project/:projectId - who can see a project's client rating:
// the client who gave it, the project's manager (read-only), HR, and employees who worked on it.
router.get('/project/:projectId', async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) throw httpError(404, 'Project not found.');

  const { id, role } = req.user;
  const allowed =
    role === 'hr' ||
    (role === 'client' && sameId(project.client, id)) ||
    (role === 'manager' && sameId(project.manager, id)) ||
    (role === 'employee' && (await Task.exists({ project: project._id, employee: id })));
  if (!allowed) throw httpError(403, 'You do not have permission to see this rating.');

  const rating = await ClientRating.findOne({ project: project._id });
  if (!rating) throw httpError(404, 'This project has not been rated yet.');
  res.json(rating);
});

// THE LOCK: there is no way to edit or delete a client rating.
// Every attempt, by any role, gets 403 and is written to the audit log.
router.put('/:id', blockEdits('ClientRating'));
router.patch('/:id', blockEdits('ClientRating'));
router.delete('/:id', blockEdits('ClientRating'));

module.exports = router;
