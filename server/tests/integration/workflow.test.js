// The core loop: assign -> submit -> manager rates (blind) -> deliver -> client rates via link.
const request = require('supertest');
const app = require('../../src/app');
const Task = require('../../src/models/Task');
const RatingLink = require('../../src/models/RatingLink');
const ClientRating = require('../../src/models/ClientRating');
const ManagerRating = require('../../src/models/ManagerRating');
const AuditLog = require('../../src/models/AuditLog');
const db = require('../helpers/db');
const { makeCompany, api, lastEmailTo, tokenFrom, workTo } = require('../helpers/fixtures');

let c;
beforeAll(async () => {
  await db.connect();
  c = await makeCompany();
});
afterAll(db.disconnect);

const work = (stage, extra = {}) => workTo(stage, { manager: c.rahul, employee: c.priya, project: c.project, ...extra });

describe('Projects', () => {
  test('a manager creates his own project with a client contact', async () => {
    const res = await api.post(c.rahul, '/api/projects', {
      name: 'Partner portal', client: { name: 'Lisa Grant', email: 'Lisa@Freightline.example', company: 'Freightline' },
    });
    expect(res.status).toBe(201);
    expect(res.body.manager).toBe(String(c.rahul._id));
    expect(res.body.client.email).toBe('lisa@freightline.example');
  });

  test('HR creates a project for a chosen manager', async () => {
    const res = await api.post(c.hr, '/api/projects', { name: 'HR made', managerId: String(c.sara._id), client: { name: 'A', email: 'a@client.example' } });
    expect(res.status).toBe(201);
    expect(res.body.manager).toBe(String(c.sara._id));
  });

  test("the client email can't belong to a FairView user (no rating your own team)", async () => {
    const res = await api.post(c.rahul, '/api/projects', { name: 'Sneaky', client: { name: 'Me', email: c.rahul.email } });
    expect(res.status).toBe(400);
  });

  test('employees cannot create projects', async () => {
    expect((await api.post(c.priya, '/api/projects', { name: 'X', client: { name: 'A', email: 'b@client.example' } })).status).toBe(403);
  });

  test('only HR can change the client contact, and it is logged', async () => {
    expect((await api.patch(c.rahul, `/api/projects/${c.saraProject._id}/client`, { name: 'Z', email: 'z@client.example' })).status).toBe(403);
    const res = await api.patch(c.hr, `/api/projects/${c.saraProject._id}/client`, { name: 'Tom New', email: 'tom.new@medicore.example' });
    expect(res.status).toBe(200);
    const entry = await AuditLog.findOne({ action: 'project.client.change', entityId: String(c.saraProject._id) });
    expect(entry.detail).toMatch(/-> tom.new@medicore.example/);
  });
});

describe('Assigning and doing the work', () => {
  test('only the project manager can add work, and only for an active employee', async () => {
    const body = { projectId: String(c.project._id), employeeId: String(c.priya._id), title: 'X' };
    expect((await api.post(c.sara, '/api/tasks', body)).status).toBe(403);
    expect((await api.post(c.rahul, '/api/tasks', { ...body, employeeId: String(c.sara._id) })).status).toBe(400);
  });

  test('the employee moves her work forward one step at a time', async () => {
    const { id } = await work('assigned');
    expect((await api.patch(c.priya, `/api/tasks/${id}/status`, { status: 'submitted', submission: 'x' })).status).toBe(409);
    await api.patch(c.priya, `/api/tasks/${id}/status`, { status: 'in_progress' }).expect(200);
    expect((await api.patch(c.priya, `/api/tasks/${id}/status`, { status: 'submitted' })).status).toBe(400); // needs a link or note
    await api.patch(c.priya, `/api/tasks/${id}/status`, { status: 'submitted', submission: 'https://git/pr/2' }).expect(200);
    expect((await Task.findById(id)).submittedAt).toBeInstanceOf(Date);
  });

  test("someone else's work cannot be moved", async () => {
    const { id } = await work('assigned');
    expect((await api.patch(c.aman, `/api/tasks/${id}/status`, { status: 'in_progress' })).status).toBe(403);
  });

  test('the manager can send work back for rework, but not after he has rated it', async () => {
    const { id } = await work('submitted');
    await api.patch(c.rahul, `/api/tasks/${id}/status`, { status: 'in_progress' }).expect(200);
    await api.patch(c.priya, `/api/tasks/${id}/status`, { status: 'submitted', submission: 'v2' }).expect(200);
    await api.post(c.rahul, `/api/tasks/${id}/rating`, { score: 3 }).expect(201);
    expect((await api.patch(c.rahul, `/api/tasks/${id}/status`, { status: 'in_progress' })).status).toBe(409);
  });

  test('a closed project takes no new work', async () => {
    const closed = await api.post(c.rahul, '/api/projects', { name: 'Old', client: { name: 'A', email: 'old@client.example' } });
    await api.patch(c.rahul, `/api/projects/${closed.body._id}/status`, { status: 'closed' }).expect(200);
    const res = await api.post(c.rahul, '/api/tasks', { projectId: closed.body._id, employeeId: String(c.priya._id), title: 'X' });
    expect(res.status).toBe(409);
  });
});

describe('The manager rates first (blind)', () => {
  test('cannot rate before the work is submitted', async () => {
    const { id } = await work('in_progress');
    expect((await api.post(c.rahul, `/api/tasks/${id}/rating`, { score: 4 })).status).toBe(409);
  });

  test('cannot deliver before rating', async () => {
    const { id } = await work('submitted');
    const res = await api.post(c.rahul, `/api/tasks/${id}/deliver`);
    expect(res.status).toBe(409);
    expect(await RatingLink.countDocuments({ task: id })).toBe(0);
    expect((await Task.findById(id)).status).toBe('submitted');
  });

  test('rates once, 1 to 5 stars, only his own team', async () => {
    const { id } = await work('submitted');
    expect((await api.post(c.rahul, `/api/tasks/${id}/rating`, { score: 6 })).status).toBe(400);
    expect((await api.post(c.sara, `/api/tasks/${id}/rating`, { score: 4 })).status).toBe(403);
    expect((await api.post(c.rahul, `/api/tasks/${id}/rating`, { score: 4, comment: 'Good' })).status).toBe(201);
    expect((await api.post(c.rahul, `/api/tasks/${id}/rating`, { score: 5 })).status).toBe(409);
    expect((await ManagerRating.findOne({ task: id })).score).toBe(4);
  });
});

describe('Delivery and the client rating link', () => {
  test('delivery emails the client a one-time link', async () => {
    const { id } = await work('manager_rated', { title: 'Payment retry' });
    const res = await api.post(c.rahul, `/api/tasks/${id}/deliver`);
    expect(res.status).toBe(200);
    expect(res.body.emailSent).toBe(true);
    const mail = lastEmailTo(c.project.client.email);
    expect(mail.subject).toMatch(/Payment retry/);
    expect(mail.text).toMatch(/AcmePriya/);
    expect((await Task.findById(id)).status).toBe('delivered');
    expect((await api.post(c.rahul, `/api/tasks/${id}/deliver`)).status).toBe(409);
  });

  test("the client's page shows the work and who built it, but never the manager's score", async () => {
    const { token } = await work('delivered', { title: 'Coupon codes', managerScore: 2 });
    const res = await request(app).get(`/api/public/rate/${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ state: 'ready', taskTitle: 'Coupon codes', employeeName: 'AcmePriya', orgName: 'Acme', clientName: 'Mark Ellis' });
    expect(JSON.stringify(res.body)).not.toMatch(/score/i);
  });

  test('the client rates once; a typo does not use up the link', async () => {
    const { id, token } = await work('delivered');
    expect((await request(app).post(`/api/public/rate/${token}`).send({ score: 0 })).status).toBe(400);
    expect((await request(app).post(`/api/public/rate/${token}`).send({ score: 5, comment: 'Great' })).status).toBe(201);
    expect((await request(app).post(`/api/public/rate/${token}`).send({ score: 1 })).status).toBe(409);
    const rating = await ClientRating.findOne({ task: id });
    expect(rating).toMatchObject({ score: 5, comment: 'Great', clientEmail: c.project.client.email });
    expect(String(rating.manager)).toBe(String(c.rahul._id));
    expect((await request(app).get(`/api/public/rate/${token}`)).body.state).toBe('used');
  });

  test('two clicks at the same moment save only one rating', async () => {
    const { id, token } = await work('delivered');
    const results = await Promise.all([1, 2, 3].map((s) => request(app).post(`/api/public/rate/${token}`).send({ score: s + 2 })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await ClientRating.countDocuments({ task: id })).toBe(1);
  });

  test('a forged or altered link is refused', async () => {
    const { token } = await work('delivered');
    const altered = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA');
    expect((await request(app).get(`/api/public/rate/${altered}`)).status).toBe(404);
    expect((await request(app).post(`/api/public/rate/${altered}`).send({ score: 5 })).status).toBe(404);
    expect((await request(app).get('/api/public/rate/not-a-token')).status).toBe(404);
  });

  test('an expired link is refused', async () => {
    const { id, token } = await work('delivered');
    await RatingLink.updateOne({ task: id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await request(app).get(`/api/public/rate/${token}`)).body.state).toBe('expired');
    expect((await request(app).post(`/api/public/rate/${token}`).send({ score: 4 })).status).toBe(410);
  });

  test('resending makes a new link and the old one stops working (at most 3 links)', async () => {
    const { id, token: first } = await work('delivered');
    await api.post(c.rahul, `/api/tasks/${id}/resend-link`).expect(200);
    const second = tokenFrom(lastEmailTo(c.project.client.email), 'rate');
    expect(second).not.toBe(first);
    expect((await request(app).post(`/api/public/rate/${first}`).send({ score: 4 })).status).toBe(410);
    await api.post(c.hr, `/api/tasks/${id}/resend-link`).expect(200); // HR may resend too
    expect((await api.post(c.rahul, `/api/tasks/${id}/resend-link`)).status).toBe(409); // 3 links already
    const third = tokenFrom(lastEmailTo(c.project.client.email), 'rate');
    expect((await request(app).post(`/api/public/rate/${third}`).send({ score: 4 })).status).toBe(201);
    expect((await api.post(c.hr, `/api/tasks/${id}/resend-link`)).status).toBe(409); // already rated
  });

  test('the whole loop is in the audit log, the client included', async () => {
    const { id } = await work('client_rated');
    const actions = (await AuditLog.find({ $or: [{ entityId: id }, { entity: { $in: ['ManagerRating', 'ClientRating'] } }] })).map((a) => a.action);
    for (const action of ['task.create', 'task.in_progress', 'task.submitted', 'rating.manager.create', 'task.deliver', 'rating.client.create']) {
      expect(actions).toContain(action);
    }
    const clientEntry = await AuditLog.findOne({ action: 'rating.client.create' });
    expect(clientEntry.actorLabel).toBe(`client ${c.project.client.email}`);
  });
});
