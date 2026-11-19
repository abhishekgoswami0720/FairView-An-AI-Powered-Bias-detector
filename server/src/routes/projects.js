const express = require('express');
const mongoose = require('mongoose');
const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const { auditBy } = require('../utils/audit');
const httpError = require('../utils/httpError');
const sameId = require('../utils/sameId');
const v = require('../utils/validate');
const views = require('../services/views');

const router = express.Router();
router.use(requireAuth);

// The client contact must be a real outsider: an email that belongs to someone in
// FairView could be used to rate one's own team.
async function checkClient(raw) {
  const client = {
    name: v.text(raw?.name, 'Client name', { required: true, max: 120 }),
    email: v.email(raw?.email, 'Client email'),
    company: v.text(raw?.company, 'Client company', { max: 120 }),
  };
  if (await User.exists({ email: client.email })) {
    throw httpError(400, 'The client email belongs to a FairView user. Use the email of the person at the client who accepts the work.');
  }
  return client;
}

async function loadProject(req, id) {
  const project = await Project.findOne({ _id: v.id(id), org: req.user.org });
  if (!project) throw httpError(404, 'Project not found.');
  return project;
}

function canSee(req, project, employeeTaskExists) {
  return req.user.role === 'hr' || sameId(project.manager, req.user.id) || employeeTaskExists;
}

// POST /api/projects  (manager or HR) { name, description, client: { name, email, company }, managerId? }
// A manager creates his own projects; HR must say which manager runs it.
router.post('/', requireRole('manager', 'hr'), async (req, res) => {
  const b = req.body || {};
  let managerId = req.user.id;
  if (req.user.role === 'hr') {
    managerId = v.id(b.managerId, 'manager');
    const manager = await User.findOne({ _id: managerId, org: req.user.org, role: 'manager', active: true });
    if (!manager) throw httpError(400, 'Please choose an active manager.');
  }
  const project = await Project.create({
    org: req.user.org,
    name: v.text(b.name, 'Project name', { required: true, max: 200 }),
    description: v.text(b.description, 'Description', { max: 5000 }),
    manager: managerId,
    client: await checkClient(b.client),
  });
  await auditBy(req, { action: 'project.create', entity: 'Project', entityId: project._id, detail: `Client ${project.client.email}` });
  res.status(201).json(project);
});

// GET /api/projects  -> HR: all; manager: his own; employee: projects with a task of hers.
router.get('/', async (req, res) => {
  const { org, id, role } = req.user;
  const filter = { org };
  if (role === 'manager') filter.manager = id;
  if (role === 'employee') filter._id = { $in: await Task.distinct('project', { org, employee: id }) };
  const projects = await Project.find(filter).populate('manager', 'name').sort({ status: 1, createdAt: -1 });

  const counts = await Task.aggregate([
    { $match: { org: new mongoose.Types.ObjectId(org), project: { $in: projects.map((p) => p._id) } } },
    { $group: { _id: { project: '$project', status: '$status' }, n: { $sum: 1 } } },
  ]);
  const byProject = {};
  for (const c of counts) {
    const key = String(c._id.project);
    byProject[key] = { ...(byProject[key] || {}), [c._id.status]: c.n };
  }
  res.json(
    projects.map((p) => {
      const json = p.toJSON();
      // Only HR and the project's manager see the client's email address.
      if (role === 'employee') delete json.client.email;
      return { ...json, taskCounts: byProject[String(p._id)] || {} };
    })
  );
});

// GET /api/projects/:id  -> the project and its tasks (an employee sees only her own tasks).
router.get('/:id', async (req, res) => {
  const project = await loadProject(req, req.params.id);
  const isEmployee = req.user.role === 'employee';
  const taskFilter = { project: project._id, ...(isEmployee ? { employee: req.user.id } : {}) };
  const tasks = await Task.find(taskFilter).populate('employee', 'name').populate('manager', 'name').sort({ createdAt: -1 });
  // Check access before populating, while project.manager is still a plain id.
  if (!canSee(req, project, isEmployee && tasks.length > 0)) throw httpError(403, 'You do not have access to this project.');
  await project.populate('manager', 'name');
  const json = project.toJSON();
  if (isEmployee) delete json.client.email;
  res.json({ project: json, tasks: await views.withRatings(tasks, req.user) });
});

// PATCH /api/projects/:id/client  (HR only) { name, email, company }
// Only HR can change who receives rating links, and every change is logged.
// Links that were already sent keep going to the old contact.
router.patch('/:id/client', requireRole('hr'), async (req, res) => {
  const project = await loadProject(req, req.params.id);
  const before = project.client.email;
  project.client = await checkClient(req.body);
  await project.save();
  await auditBy(req, { action: 'project.client.change', entity: 'Project', entityId: project._id, detail: `${before} -> ${project.client.email}` });
  res.json(project);
});

// PATCH /api/projects/:id/status  (project's manager or HR) { status: 'active' | 'closed' }
router.patch('/:id/status', requireRole('manager', 'hr'), async (req, res) => {
  const project = await loadProject(req, req.params.id);
  if (req.user.role !== 'hr' && !sameId(project.manager, req.user.id)) throw httpError(403, 'This is not your project.');
  project.status = v.oneOf(req.body?.status, ['active', 'closed'], 'Status');
  await project.save();
  await auditBy(req, { action: `project.${project.status}`, entity: 'Project', entityId: project._id });
  res.json(project);
});

module.exports = router;
