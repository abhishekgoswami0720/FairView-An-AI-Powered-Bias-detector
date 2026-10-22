// Proves the client-rating rules at the API level.
const request = require('supertest');

jest.mock('../src/models/Project', () => ({ findById: jest.fn() }));
jest.mock('../src/models/Task', () => ({ exists: jest.fn() }));
jest.mock('../src/models/ClientRating', () => ({ create: jest.fn(), findOne: jest.fn() }));
jest.mock('../src/models/AuditLog', () => ({ create: jest.fn().mockResolvedValue({}) }));

const Project = require('../src/models/Project');
const Task = require('../src/models/Task');
const ClientRating = require('../src/models/ClientRating');
const AuditLog = require('../src/models/AuditLog');
const app = require('../src/app');
const { ids, tokenFor, fakeProject } = require('./helpers');

beforeEach(() => jest.clearAllMocks());

describe('Nobody can edit or delete a client rating', () => {
  const people = [
    ['client', ids.client], ['manager', ids.manager], ['employee', ids.priya], ['hr', ids.hr],
  ];
  const methods = ['put', 'patch', 'delete'];

  test.each(people.flatMap(([role, id]) => methods.map((m) => [m.toUpperCase(), role, id])))(
    '%s by %s -> 403 and logged as blocked',
    async (method, role, id) => {
      const res = await request(app)[method.toLowerCase()](`/api/ratings/${ids.rating}`)
        .set('Authorization', tokenFor(id, role))
        .send({ score: 1 });
      expect(res.status).toBe(403);
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ actor: id, entity: 'ClientRating', entityId: ids.rating, outcome: 'blocked' })
      );
    }
  );

  test('without logging in -> 401 (and nothing is changed)', async () => {
    const res = await request(app).patch(`/api/ratings/${ids.rating}`).send({ score: 1 });
    expect(res.status).toBe(401);
  });
});

describe('Giving a client rating', () => {
  const rate = (id, role, body) =>
    request(app).post('/api/ratings').set('Authorization', tokenFor(id, role)).send(body);
  const body = { projectId: ids.project, score: 8, review: 'Good work' };

  test.each(['manager', 'employee', 'hr'])('a %s cannot give a client rating', async (role) => {
    const res = await rate(ids.manager, role, body);
    expect(res.status).toBe(403);
    expect(ClientRating.create).not.toHaveBeenCalled();
  });

  test('a client cannot rate someone else\'s project', async () => {
    Project.findById.mockResolvedValue(fakeProject({ status: 'delivered' }));
    const res = await rate(ids.otherClient, 'client', body);
    expect(res.status).toBe(403);
    expect(ClientRating.create).not.toHaveBeenCalled();
  });

  test('a project cannot be rated before it is delivered', async () => {
    Project.findById.mockResolvedValue(fakeProject({ status: 'open' }));
    const res = await rate(ids.client, 'client', body);
    expect(res.status).toBe(409);
  });

  test('a project cannot be rated twice', async () => {
    Project.findById.mockResolvedValue(fakeProject({ status: 'rated' }));
    const res = await rate(ids.client, 'client', body);
    expect(res.status).toBe(409);
  });

  test('the owning client rates a delivered project -> saved, project marked rated, logged', async () => {
    const project = fakeProject({ status: 'delivered' });
    Project.findById.mockResolvedValue(project);
    ClientRating.create.mockResolvedValue({ _id: ids.rating, score: 8 });

    const res = await rate(ids.client, 'client', body);
    expect(res.status).toBe(201);
    expect(ClientRating.create).toHaveBeenCalledWith(
      expect.objectContaining({ project: ids.project, client: ids.client, score: 8 })
    );
    expect(project.status).toBe('rated');
    expect(project.save).toHaveBeenCalled();
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'rating.create', outcome: 'allowed' }));
  });
});

describe('Who can see a client rating', () => {
  const see = (id, role) =>
    request(app).get(`/api/ratings/project/${ids.project}`).set('Authorization', tokenFor(id, role));

  beforeEach(() => {
    Project.findById.mockResolvedValue(fakeProject({ status: 'rated' }));
    ClientRating.findOne.mockResolvedValue({ score: 8 });
  });

  test('the project\'s manager can see it (read-only)', async () => {
    expect((await see(ids.manager, 'manager')).status).toBe(200);
  });

  test('a different manager cannot', async () => {
    expect((await see(ids.otherManager, 'manager')).status).toBe(403);
  });

  test('an employee who worked on the project can', async () => {
    Task.exists.mockResolvedValue({ _id: ids.task });
    expect((await see(ids.priya, 'employee')).status).toBe(200);
  });

  test('an employee who did not work on it cannot', async () => {
    Task.exists.mockResolvedValue(null);
    expect((await see(ids.aman, 'employee')).status).toBe(403);
  });
});
