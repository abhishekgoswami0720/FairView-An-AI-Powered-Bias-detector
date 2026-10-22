const express = require('express');
const ManagerAssessment = require('../models/ManagerAssessment');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { requireAuth, requireRole } = require('../middleware/auth');
const blockEdits = require('../middleware/blockEdits');
const httpError = require('../utils/httpError');
const sameId = require('../utils/sameId');
const audit = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

// POST /api/assessments  (manager) { taskId, score, feedback }
// The manager rates a submitted task. Allowed only while the project is still open,
// i.e. before delivery, so the manager has not seen the client's rating yet.
router.post('/', requireRole('manager'), async (req, res) => {
  const { taskId, score, feedback } = req.body || {};
  const task = await Task.findById(taskId);
  if (!task) throw httpError(404, 'Task not found.');
  if (!sameId(task.manager, req.user.id)) throw httpError(403, 'This is not your task.');
  if (task.status !== 'submitted') throw httpError(409, 'You can rate a task only after it is submitted.');

  const project = await Project.findById(task.project);
  if (!project || project.status !== 'open') throw httpError(409, 'This project is already delivered.');

  const assessment = await ManagerAssessment.create({
    task: task._id, project: task.project, manager: req.user.id, employee: task.employee, score, feedback,
  });
  await audit({ actor: req.user.id, action: 'assessment.create', entity: 'ManagerAssessment', entityId: assessment._id });
  res.status(201).json(assessment);
});

// GET /api/assessments - managers see what they wrote, employees see what was written about them.
router.get('/', requireRole('manager', 'employee', 'hr'), async (req, res) => {
  const { id, role } = req.user;
  const filter = role === 'manager' ? { manager: id } : role === 'employee' ? { employee: id } : {};
  res.json(await ManagerAssessment.find(filter).sort({ createdAt: -1 }));
});

// Manager ratings are locked too: editing or deleting is always refused and logged.
router.put('/:id', blockEdits('ManagerAssessment'));
router.patch('/:id', blockEdits('ManagerAssessment'));
router.delete('/:id', blockEdits('ManagerAssessment'));

module.exports = router;
