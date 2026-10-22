const express = require('express');
const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const ManagerAssessment = require('../models/ManagerAssessment');
const { requireAuth, requireRole } = require('../middleware/auth');
const httpError = require('../utils/httpError');
const sameId = require('../utils/sameId');
const audit = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

// POST /api/projects  (client) { title, description, managerId }
router.post('/', requireRole('client'), async (req, res) => {
  const { title, description, managerId } = req.body || {};
  const manager = await User.findById(managerId);
  if (!manager || manager.role !== 'manager') throw httpError(400, 'Please choose a valid manager.');

  const project = await Project.create({ title, description, client: req.user.id, manager: manager._id });
  await audit({ actor: req.user.id, action: 'project.create', entity: 'Project', entityId: project._id });
  res.status(201).json(project);
});

// GET /api/projects - each role sees only the projects that concern them.
router.get('/', async (req, res) => {
  const { id, role } = req.user;
  let filter;
  if (role === 'client') filter = { client: id };
  else if (role === 'manager') filter = { manager: id };
  else if (role === 'employee') filter = { _id: { $in: await Task.distinct('project', { employee: id }) } };
  else filter = {}; // hr sees everything
  res.json(await Project.find(filter).sort({ createdAt: -1 }));
});

// POST /api/projects/:id/deliver  (manager) - hand the finished project to the client.
// Allowed only when every task is submitted AND the manager has rated every task.
// This forces the manager to rate BEFORE seeing the client's score.
router.post('/:id/deliver', requireRole('manager'), async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw httpError(404, 'Project not found.');
  if (!sameId(project.manager, req.user.id)) throw httpError(403, 'This is not your project.');
  if (project.status !== 'open') throw httpError(409, 'This project has already been delivered.');

  const tasks = await Task.find({ project: project._id });
  if (tasks.length === 0) throw httpError(409, 'Add at least one task before delivering.');
  if (tasks.some((t) => t.status !== 'submitted')) throw httpError(409, 'All tasks must be submitted first.');

  const assessed = await ManagerAssessment.countDocuments({ project: project._id });
  if (assessed < tasks.length) throw httpError(409, 'Rate every task before delivering the project.');

  project.status = 'delivered';
  await project.save();
  await audit({ actor: req.user.id, action: 'project.deliver', entity: 'Project', entityId: project._id });
  res.json(project);
});

module.exports = router;
