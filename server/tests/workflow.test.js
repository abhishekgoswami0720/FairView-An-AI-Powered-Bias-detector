// Proves two design rules from the synopsis:
//  1. Work shares in a project can never add up to more than 100%.
//  2. The manager must rate every task BEFORE delivering (so they never see the client score first).
const request = require('supertest');

jest.mock('../src/models/Project', () => ({ findById: jest.fn() }));
jest.mock('../src/models/Task', () => ({ find: jest.fn(), findById: jest.fn(), create: jest.fn() }));
jest.mock('../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../src/models/ManagerAssessment', () => ({ countDocuments: jest.fn(), create: jest.fn(), exists: jest.fn() }));
jest.mock('../src/models/AuditLog', () => ({ create: jest.fn().mockResolvedValue({}) }));

const Project = require('../src/models/Project');
const Task = require('../src/models/Task');
const User = require('../src/models/User');
const ManagerAssessment = require('../src/models/ManagerAssessment');
const app = require('../src/app');
const { ids, tokenFor, fakeProject } = require('./helpers');

beforeEach(() => jest.clearAllMocks());

describe('Work shares', () => {
  const addTask = (workShare) =>
    request(app)
      .post('/api/tasks')
      .set('Authorization', tokenFor(ids.manager, 'manager'))
      .send({ projectId: ids.project, employeeId: ids.aman, title: 'API work', workShare });

  beforeEach(() => {
    Project.findById.mockResolvedValue(fakeProject());
    User.findById.mockResolvedValue({ _id: ids.aman, role: 'employee' });
    Task.find.mockResolvedValue([{ workShare: 0.7 }]); // Priya already has 70%
    Task.create.mockImplementation(async (t) => ({ _id: ids.task, ...t }));
  });

  test('30% more fits exactly (0.7 + 0.3 = 1.0)', async () => {
    expect((await addTask(0.3)).status).toBe(201);
  });

  test('40% more would exceed 100% -> refused', async () => {
    const res = await addTask(0.4);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/30%/);
    expect(Task.create).not.toHaveBeenCalled();
  });

  test('another manager cannot add tasks to this project', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', tokenFor(ids.otherManager, 'manager'))
      .send({ projectId: ids.project, employeeId: ids.aman, title: 'x', workShare: 0.1 });
    expect(res.status).toBe(403);
  });
});

describe('Blind rating: manager rates before delivery', () => {
  const deliver = () =>
    request(app).post(`/api/projects/${ids.project}/deliver`).set('Authorization', tokenFor(ids.manager, 'manager'));

  test('cannot deliver while a task is still unrated', async () => {
    const project = fakeProject();
    Project.findById.mockResolvedValue(project);
    Task.find.mockResolvedValue([{ status: 'submitted' }, { status: 'submitted' }]);
    ManagerAssessment.countDocuments.mockResolvedValue(1); // only 1 of 2 rated
    const res = await deliver();
    expect(res.status).toBe(409);
    expect(project.status).toBe('open');
  });

  test('cannot deliver while a task is not yet submitted', async () => {
    Project.findById.mockResolvedValue(fakeProject());
    Task.find.mockResolvedValue([{ status: 'submitted' }, { status: 'in_progress' }]);
    expect((await deliver()).status).toBe(409);
  });

  test('delivers once every task is submitted and rated', async () => {
    const project = fakeProject();
    Project.findById.mockResolvedValue(project);
    Task.find.mockResolvedValue([{ status: 'submitted' }, { status: 'submitted' }]);
    ManagerAssessment.countDocuments.mockResolvedValue(2);
    const res = await deliver();
    expect(res.status).toBe(200);
    expect(project.status).toBe('delivered');
  });

  test('the manager cannot rate a task after the project is delivered', async () => {
    Task.findById.mockResolvedValue({
      _id: ids.task, project: ids.project, manager: ids.manager, employee: ids.priya, status: 'submitted',
    });
    Project.findById.mockResolvedValue(fakeProject({ status: 'delivered' }));
    const res = await request(app)
      .post('/api/assessments')
      .set('Authorization', tokenFor(ids.manager, 'manager'))
      .send({ taskId: ids.task, score: 4, feedback: 'late' });
    expect(res.status).toBe(409);
    expect(ManagerAssessment.create).not.toHaveBeenCalled();
  });
});
