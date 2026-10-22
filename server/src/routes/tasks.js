const express = require('express');
const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const ManagerAssessment = require('../models/ManagerAssessment');
const { requireAuth, requireRole } = require('../middleware/auth');
const httpError = require('../utils/httpError');
const sameId = require('../utils/sameId');
const audit = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

// Tiny tolerance for decimal maths (0.1 + 0.2 is not exactly 0.3 in computers).
const EPSILON = 1e-9;

// POST /api/tasks  (manager) { projectId, employeeId, title, workShare }
router.post('/', requireRole('manager'), async (req, res) => {
  const { projectId, employeeId, title, workShare } = req.body || {};

  const project = await Project.findById(projectId);
  if (!project) throw httpError(404, 'Project not found.');
  if (!sameId(project.manager, req.user.id)) throw httpError(403, 'This is not your project.');
  if (project.status !== 'open') throw httpError(409, 'This project is closed for new tasks.');

  const employee = await User.findById(employeeId);
  if (!employee || employee.role !== 'employee') throw httpError(400, 'Please choose a valid employee.');

  // All work shares in one project must add up to 100% or less.
  const existing = await Task.find({ project: project._id });
  const used = existing.reduce((sum, t) => sum + t.workShare, 0);
  if (used + Number(workShare) > 1 + EPSILON) {
    throw httpError(400, `Only ${Math.round((1 - used) * 100)}% of this project is left to assign.`);
  }

  const task = await Task.create({
    project: project._id, manager: req.user.id, employee: employee._id, title, workShare,
  });
  await audit({ actor: req.user.id, action: 'task.create', entity: 'Task', entityId: task._id });
  res.status(201).json(task);
});

// GET /api/tasks - employees see their tasks, managers see tasks they gave, HR sees all.
// Clients do not see individual tasks: they rate the whole delivered project.
router.get('/', requireRole('employee', 'manager', 'hr'), async (req, res) => {
  const { id, role } = req.user;
  const filter = role === 'employee' ? { employee: id } : role === 'manager' ? { manager: id } : {};
  if (req.query.projectId) filter.project = req.query.projectId;
  res.json(await Task.find(filter).sort({ createdAt: -1 }));
});

// PATCH /api/tasks/:id/status  { status, submission }
// Employee: assigned -> in_progress -> submitted
// Manager:  submitted -> in_progress (send back for rework, only before rating it)
router.patch('/:id/status', requireRole('employee', 'manager'), async (req, res) => {
  const { status, submission } = req.body || {};
  const task = await Task.findById(req.params.id);
  if (!task) throw httpError(404, 'Task not found.');

  const project = await Project.findById(task.project);
  if (!project || project.status !== 'open') throw httpError(409, 'This project is closed.');

  const { id, role } = req.user;
  const employeeMoves = { assigned: 'in_progress', in_progress: 'submitted' };

  if (role === 'employee') {
    if (!sameId(task.employee, id)) throw httpError(403, 'This is not your task.');
    if (employeeMoves[task.status] !== status) {
      throw httpError(409, `A task that is "${task.status}" cannot move to "${status}".`);
    }
    if (status === 'submitted') {
      if (!submission || !String(submission).trim()) throw httpError(400, 'Describe or link the work you are submitting.');
      task.submission = submission;
    }
  } else {
    if (!sameId(task.manager, id)) throw httpError(403, 'This is not your task.');
    if (!(task.status === 'submitted' && status === 'in_progress')) {
      throw httpError(409, 'A manager can only send submitted work back for rework.');
    }
    if (await ManagerAssessment.exists({ task: task._id })) {
      throw httpError(409, 'You have already rated this task, so it cannot be sent back.');
    }
  }

  task.status = status;
  await task.save();
  await audit({ actor: id, action: `task.${status}`, entity: 'Task', entityId: task._id });
  res.json(task);
});

module.exports = router;
