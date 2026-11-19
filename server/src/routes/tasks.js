const express = require('express');
const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const ManagerRating = require('../models/ManagerRating');
const { requireAuth, requireRole } = require('../middleware/auth');
const { auditBy } = require('../utils/audit');
const httpError = require('../utils/httpError');
const sameId = require('../utils/sameId');
const v = require('../utils/validate');
const workflow = require('../services/workflow');
const views = require('../services/views');

const router = express.Router();
router.use(requireAuth);

const STATUSES = ['assigned', 'in_progress', 'submitted', 'delivered'];

// POST /api/tasks  (manager) { projectId, employeeId, title, description }
// One piece of work, one owner.
router.post('/', requireRole('manager'), async (req, res) => {
  const b = req.body || {};
  const project = await Project.findOne({ _id: v.id(b.projectId, 'project'), org: req.user.org });
  if (!project) throw httpError(404, 'Project not found.');
  if (!sameId(project.manager, req.user.id)) throw httpError(403, 'This is not your project.');
  if (project.status !== 'active') throw httpError(409, 'This project is closed for new work.');

  const employee = await User.findOne({ _id: v.id(b.employeeId, 'employee'), org: req.user.org, role: 'employee', active: true });
  if (!employee) throw httpError(400, 'Please choose an active employee.');

  const task = await Task.create({
    org: req.user.org,
    project: project._id,
    manager: req.user.id,
    employee: employee._id,
    title: v.text(b.title, 'Title', { required: true, max: 200 }),
    description: v.text(b.description, 'Description', { max: 5000 }),
  });
  await auditBy(req, { action: 'task.create', entity: 'Task', entityId: task._id, detail: `Assigned to ${employee.name}` });
  res.status(201).json(task);
});

// GET /api/tasks?status=submitted&projectId=...
// Employee: her work. Manager: work he manages. HR: everything.
router.get('/', async (req, res) => {
  const { org, id, role } = req.user;
  const filter = { org };
  if (role === 'employee') filter.employee = id;
  if (role === 'manager') filter.manager = id;
  if (req.query.status) filter.status = v.oneOf(req.query.status, STATUSES, 'Status');
  if (req.query.projectId) filter.project = v.id(req.query.projectId, 'project');
  const tasks = await Task.find(filter)
    .populate('project', 'name client.company')
    .populate('employee', 'name')
    .populate('manager', 'name')
    .sort({ updatedAt: -1 })
    .limit(500);
  res.json(await views.withRatings(tasks, req.user));
});

// GET /api/tasks/:id
router.get('/:id', async (req, res) => {
  const task = await Task.findOne({ _id: v.id(req.params.id), org: req.user.org })
    .populate('project', 'name client.company client.name')
    .populate('employee', 'name')
    .populate('manager', 'name');
  if (!task) throw httpError(404, 'Task not found.');
  const allowed = req.user.role === 'hr' || sameId(task.manager._id, req.user.id) || sameId(task.employee._id, req.user.id);
  if (!allowed) throw httpError(403, 'You do not have access to this task.');
  const [withRatings] = await views.withRatings([task], req.user);
  res.json(withRatings);
});

// PATCH /api/tasks/:id/status  { status, submission }
// Employee: assigned -> in_progress -> submitted
// Manager:  submitted -> in_progress (send back for rework, only before he has rated it)
router.patch('/:id/status', requireRole('employee', 'manager'), async (req, res) => {
  const b = req.body || {};
  const status = v.oneOf(b.status, ['in_progress', 'submitted'], 'Status');
  const task = await Task.findOne({ _id: v.id(req.params.id), org: req.user.org });
  if (!task) throw httpError(404, 'Task not found.');

  const project = await Project.findById(task.project).select('status');
  if (project.status !== 'active') throw httpError(409, 'This project is closed.');

  if (req.user.role === 'employee') {
    if (!sameId(task.employee, req.user.id)) throw httpError(403, 'This is not your task.');
    const next = { assigned: 'in_progress', in_progress: 'submitted' };
    if (next[task.status] !== status) throw httpError(409, `Work that is "${task.status}" cannot move to "${status}".`);
    if (status === 'submitted') {
      task.submission = v.text(b.submission, 'A link or note about the work', { required: true, max: 5000 });
      task.submittedAt = new Date();
    }
  } else {
    if (!sameId(task.manager, req.user.id)) throw httpError(403, 'This is not your task.');
    if (!(task.status === 'submitted' && status === 'in_progress')) {
      throw httpError(409, 'A manager can only send submitted work back for rework.');
    }
    if (await ManagerRating.exists({ task: task._id })) {
      throw httpError(409, 'You have already rated this work, so it cannot be sent back.');
    }
  }

  task.status = status;
  await task.save();
  await auditBy(req, { action: `task.${status === 'in_progress' && req.user.role === 'manager' ? 'rework' : status}`, entity: 'Task', entityId: task._id });
  res.json(task);
});

// POST /api/tasks/:id/rating  (manager) { score: 1-5, comment }
// The blind rating: given before delivery, so before the client's rating can exist. Locked once saved.
router.post('/:id/rating', requireRole('manager'), async (req, res) => {
  const b = req.body || {};
  const rating = await workflow.rateAsManager(req, v.id(req.params.id), {
    score: v.stars(b.score),
    comment: v.text(b.comment, 'Comment', { max: 1000 }),
  });
  res.status(201).json(rating);
});

// POST /api/tasks/:id/deliver  (manager) -> emails the client a one-time rating link.
router.post('/:id/deliver', requireRole('manager'), async (req, res) => {
  const { task, emailSent } = await workflow.deliverTask(req, v.id(req.params.id));
  res.json({ task, emailSent });
});

// POST /api/tasks/:id/resend-link  (task's manager or HR) -> a new link; older ones stop working.
router.post('/:id/resend-link', requireRole('manager', 'hr'), async (req, res) => {
  res.json(await workflow.resendRatingLink(req, v.id(req.params.id)));
});

module.exports = router;
