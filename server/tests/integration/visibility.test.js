// Who can see what, and no company can ever see another company's data.
const Task = require('../../src/models/Task');
const ClientRating = require('../../src/models/ClientRating');
const ManagerRating = require('../../src/models/ManagerRating');
const AuditLog = require('../../src/models/AuditLog');
const db = require('../helpers/db');
const { makeCompany, api, workTo } = require('../helpers/fixtures');

let c;
let other;
beforeAll(async () => {
  await db.connect();
  c = await makeCompany('Acme');
  other = await makeCompany('Globex');
});
afterAll(db.disconnect);

const work = (stage, extra = {}) => workTo(stage, { manager: c.rahul, employee: c.priya, project: c.project, ...extra });
const ratingsOf = async (user, id) => (await api.get(user, `/api/tasks/${id}`)).body.ratings;

describe('Ratings are revealed to the employee only when both are in', () => {
  test('before the client rates, Priya sees that her manager rated, but not the score', async () => {
    const { id } = await work('delivered', { managerScore: 2 });
    const r = await ratingsOf(c.priya, id);
    expect(r).toMatchObject({ managerDone: true, clientDone: false, revealed: false, manager: null, client: null });
  });

  test('after the client rates, she sees both', async () => {
    const { id } = await work('client_rated', { managerScore: 2, clientScore: 5 });
    const r = await ratingsOf(c.priya, id);
    expect(r.revealed).toBe(true);
    expect(r.manager.score).toBe(2);
    expect(r.client.score).toBe(5);
    expect(r.client.clientEmail).toBeUndefined(); // only HR sees the client's email
  });

  test('if the client never rates, the manager score is shown once the link runs out', async () => {
    const { id } = await work('delivered', { managerScore: 3 });
    await Task.updateOne({ _id: id }, { $set: { ratingWindowEndsAt: new Date(Date.now() - 1000) } });
    const r = await ratingsOf(c.priya, id);
    expect(r).toMatchObject({ revealed: true, client: null });
    expect(r.manager.score).toBe(3);
  });

  test('the manager always sees his own rating, and the client rating once it exists', async () => {
    const { id } = await work('client_rated', { managerScore: 3, clientScore: 4 });
    const r = await ratingsOf(c.rahul, id);
    expect(r.manager.score).toBe(3);
    expect(r.client.score).toBe(4);
  });

  test('HR sees everything, including who the client was', async () => {
    const { id } = await work('client_rated');
    const r = await ratingsOf(c.hr, id);
    expect(r.client.clientEmail).toBe(c.project.client.email);
  });

  test("other people cannot open someone's work", async () => {
    const { id } = await work('client_rated');
    expect((await api.get(c.aman, `/api/tasks/${id}`)).status).toBe(403);
    expect((await api.get(c.sara, `/api/tasks/${id}`)).status).toBe(403);
  });

  test('the employee record only averages revealed ratings', async () => {
    const res = await api.get(c.priya, '/api/insights/record');
    expect(res.status).toBe(200);
    const revealed = res.body.work.filter((w) => w.ratings.revealed && w.ratings.client);
    const expected = revealed.reduce((s, w) => s + w.ratings.client.score, 0) / revealed.length;
    expect(res.body.summary.clientAvg).toBeCloseTo(expected, 2);
  });
});

describe('Projects', () => {
  test("employees see their projects but not the client's email", async () => {
    await work('assigned');
    const res = await api.get(c.priya, '/api/projects');
    expect(res.body.map((p) => p.name)).toContain('Checkout');
    expect(res.body.every((p) => p.client.email === undefined)).toBe(true);
    expect((await api.get(c.aman, `/api/projects/${c.project._id}`)).status).toBe(403); // no work there
  });

  test("the project's manager and HR can open it; another manager cannot", async () => {
    await work('assigned');
    const mine = await api.get(c.rahul, `/api/projects/${c.project._id}`);
    expect(mine.status).toBe(200);
    expect(mine.body.project.manager.name).toBe('AcmeRahul');
    expect(mine.body.tasks.length).toBeGreaterThan(0);
    expect((await api.get(c.hr, `/api/projects/${c.project._id}`)).status).toBe(200);
    expect((await api.get(c.sara, `/api/projects/${c.project._id}`)).status).toBe(403);
  });

  test("a manager sees only his own projects", async () => {
    const res = await api.get(c.sara, '/api/projects');
    expect(res.body.map((p) => p.name)).toEqual(['Data platform']);
  });
});

describe('Companies are sealed off from each other', () => {
  test("another company's HR gets 404 for everything of ours", async () => {
    const { id } = await work('client_rated');
    expect((await api.get(other.hr, `/api/tasks/${id}`)).status).toBe(404);
    expect((await api.get(other.hr, `/api/projects/${c.project._id}`)).status).toBe(404);
    expect((await api.post(other.hr, `/api/tasks/${id}/resend-link`)).status).toBe(404);
    expect((await api.patch(other.hr, `/api/users/${c.priya._id}`, { active: false })).status).toBe(404);
    const lists = await Promise.all(['/api/tasks', '/api/projects', '/api/users', '/api/insights/audit'].map((u) => api.get(other.hr, u)));
    for (const res of lists) expect(JSON.stringify(res.body)).not.toMatch(/Acme/);
  });

  test("a manager cannot put another company's employee on his project", async () => {
    const res = await api.post(c.rahul, '/api/tasks', { projectId: String(c.project._id), employeeId: String(other.priya._id), title: 'X' });
    expect(res.status).toBe(400);
  });
});

describe('Ratings can never be changed, through the API or the database', () => {
  test.each(['put', 'patch', 'delete'])('%s on a client or manager rating -> 403 for every role, and logged', async (method) => {
    const { id } = await work('client_rated');
    const client = await ClientRating.findOne({ task: id });
    const manager = await ManagerRating.findOne({ task: id });
    for (const user of [c.hr, c.rahul, c.priya]) {
      expect((await api[method](user, `/api/ratings/client/${client._id}`, { score: 1 })).status).toBe(403);
      expect((await api[method](user, `/api/ratings/manager/${manager._id}`, { score: 5 })).status).toBe(403);
    }
    expect(await AuditLog.countDocuments({ entityId: String(client._id), outcome: 'blocked' })).toBe(3);
    expect((await ClientRating.findById(client._id)).score).toBe(client.score);
  });

  test('a direct database update is refused too', async () => {
    const { id } = await work('client_rated');
    await expect(ClientRating.updateOne({ task: id }, { $set: { score: 1 } })).rejects.toThrow(/locked/);
    await expect(ManagerRating.deleteOne({ task: id })).rejects.toThrow(/locked/);
  });
});
