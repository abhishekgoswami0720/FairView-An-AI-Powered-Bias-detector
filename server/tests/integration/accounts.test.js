const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Organization = require('../../src/models/Organization');
const AuditLog = require('../../src/models/AuditLog');
const db = require('../helpers/db');
const { makeCompany, api, lastEmailTo, tokenFrom, PASSWORD } = require('../helpers/fixtures');

let c;
beforeAll(async () => {
  await db.connect();
  c = await makeCompany();
});
afterAll(db.disconnect);

const login = (email, password = PASSWORD) => request(app).post('/api/auth/login').send({ email, password });

describe('Company sign-up', () => {
  const signup = (body) => request(app).post('/api/orgs').send(body);

  test('creates a new company and its first HR admin, and logs them in', async () => {
    const res = await signup({ orgName: 'Bluepeak', name: 'Neha', email: 'neha@bluepeak.test', password: 'long-password' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ role: 'hr', orgName: 'Bluepeak', email: 'neha@bluepeak.test' });
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.body.orgName).toBe('Bluepeak');
  });

  test('cannot reuse an email that already has an account', async () => {
    const res = await signup({ orgName: 'Other', name: 'X', email: c.priya.email, password: 'long-password' });
    expect(res.status).toBe(409);
    expect(await Organization.countDocuments({ name: 'Other' })).toBe(0); // nothing half-created
  });

  test('checks every field', async () => {
    expect((await signup({ orgName: '', name: 'X', email: 'x@x.test', password: 'long-password' })).status).toBe(400);
    expect((await signup({ orgName: 'A', name: 'X', email: 'bad', password: 'long-password' })).status).toBe(400);
    expect((await signup({ orgName: 'A', name: 'X', email: 'y@x.test', password: 'short' })).status).toBe(400);
  });
});

describe('Login', () => {
  test('right password gives a token', async () => {
    const res = await login(c.priya.email);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ role: 'employee', orgName: 'Acme' });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test('wrong password and unknown email get the same answer', async () => {
    const wrong = await login(c.priya.email, 'wrong-password');
    const unknown = await login('nobody@nowhere.test');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toBe(unknown.body.error);
  });

  test('email is not case-sensitive', async () => {
    expect((await login(c.priya.email.toUpperCase())).status).toBe(200);
  });

  test('refuses non-text input (no query injection)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: { $ne: null }, password: PASSWORD });
    expect(res.status).toBe(400);
  });
});

describe('Tokens', () => {
  test('no token, forged token -> 401', async () => {
    expect((await request(app).get('/api/projects')).status).toBe(401);
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign({ sub: String(c.hr._id) }, 'attacker-secret');
    expect((await request(app).get('/api/projects').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
  });

  test('a deactivated person is locked out at once, even with a valid token', async () => {
    const temp = await User.create({ org: c.org._id, role: 'employee', name: 'Temp', email: 'temp@fv.test' });
    expect((await api.get(temp, '/api/tasks')).status).toBe(200);
    expect((await api.patch(c.hr, `/api/users/${temp._id}`, { active: false })).status).toBe(200);
    expect((await api.get(temp, '/api/tasks')).status).toBe(401);
  });

  test('a role change takes effect at once', async () => {
    const temp = await User.create({ org: c.org._id, role: 'employee', name: 'Temp2', email: 'temp2@fv.test' });
    expect((await api.get(temp, '/api/insights/team')).status).toBe(403);
    await api.patch(c.hr, `/api/users/${temp._id}`, { role: 'manager' }).expect(200);
    expect((await api.get(temp, '/api/insights/team')).status).toBe(200);
  });
});

describe('Invites', () => {
  test('HR invites a person, who sets their own password through the emailed link', async () => {
    const res = await api.post(c.hr, '/api/users', { name: 'Kabir', email: 'kabir@fv.test', role: 'employee' });
    expect(res.status).toBe(201);
    expect(res.body.emailSent).toBe(true);
    const token = tokenFrom(lastEmailTo('kabir@fv.test'), 'invite');

    const info = await request(app).get(`/api/public/invite/${token}`);
    expect(info.body).toMatchObject({ name: 'Kabir', role: 'employee', orgName: 'Acme' });

    expect((await login('kabir@fv.test')).status).toBe(401); // no password yet
    const accepted = await request(app).post(`/api/public/invite/${token}`).send({ password: 'my-own-password' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.user.email).toBe('kabir@fv.test');
    expect((await login('kabir@fv.test', 'my-own-password')).status).toBe(200);

    // The link works only once.
    expect((await request(app).post(`/api/public/invite/${token}`).send({ password: 'another-password' })).status).toBe(404);
  });

  test('a new invite makes the old link stop working', async () => {
    await api.post(c.hr, '/api/users', { name: 'Isha', email: 'isha@fv.test', role: 'employee' }).expect(201);
    const oldToken = tokenFrom(lastEmailTo('isha@fv.test'), 'invite');
    const user = await User.findOne({ email: 'isha@fv.test' });
    await api.post(c.hr, `/api/users/${user._id}/resend-invite`).expect(200);
    const newToken = tokenFrom(lastEmailTo('isha@fv.test'), 'invite');
    expect(newToken).not.toBe(oldToken);
    expect((await request(app).get(`/api/public/invite/${oldToken}`)).status).toBe(404);
    expect((await request(app).get(`/api/public/invite/${newToken}`)).status).toBe(200);
  });

  test('an expired invite is refused', async () => {
    await api.post(c.hr, '/api/users', { name: 'Old', email: 'old@fv.test', role: 'employee' }).expect(201);
    const token = tokenFrom(lastEmailTo('old@fv.test'), 'invite');
    await User.updateOne({ email: 'old@fv.test' }, { $set: { inviteExpiresAt: new Date(Date.now() - 1000) } });
    expect((await request(app).post(`/api/public/invite/${token}`).send({ password: 'whatever-123' })).status).toBe(410);
  });

  test('only HR can invite, and HR cannot invite into another company', async () => {
    for (const user of [c.rahul, c.priya]) {
      expect((await api.post(user, '/api/users', { name: 'X', email: `x${user._id}@fv.test`, role: 'hr' })).status).toBe(403);
    }
    const other = await makeCompany('Globex');
    const res = await api.post(other.hr, '/api/users', { name: 'Y', email: 'y@fv.test', role: 'employee' });
    expect((await User.findById(res.body.user.id ?? res.body.user._id)).org.toString()).toBe(String(other.org._id));
  });

  test('HR imports people from a CSV file; bad rows are reported, good rows still added', async () => {
    const csv = [
      'Name,Email,Role',
      'Arjun Mehta,arjun@fv.test,employee',
      'Sara Two,sara2@fv.test,MANAGER',
      'No Email,,employee',
      'Bad Role,badrole@fv.test,ceo',
      `Duplicate,${c.priya.email},employee`,
    ].join('\n');
    const res = await request(app)
      .post('/api/users/import')
      .set('Authorization', require('../helpers/fixtures').auth(c.hr))
      .set('Content-Type', 'text/csv')
      .send(csv);
    expect(res.status).toBe(201);
    expect(res.body.created.map((r) => r.email)).toEqual(['arjun@fv.test', 'sara2@fv.test']);
    expect(res.body.errors.map((e) => e.line)).toEqual([4, 5, 6]);
    expect(res.body.errors[2].error).toMatch(/already has an account/);
    expect(lastEmailTo('arjun@fv.test')).toBeDefined();
  });

  test('a CSV without the right headers is refused', async () => {
    const res = await api.post(c.hr, '/api/users/import', { csv: 'a,b\n1,2' });
    expect(res.status).toBe(400);
  });

  test('every invite is in the audit log', async () => {
    expect(await AuditLog.countDocuments({ org: c.org._id, action: 'user.invite' })).toBeGreaterThanOrEqual(4);
  });
});

describe('People list', () => {
  test('HR sees emails and who has joined; others see names and roles only', async () => {
    const hrView = await api.get(c.hr, '/api/users');
    const priya = hrView.body.find((u) => u.name === 'AcmePriya');
    expect(priya).toMatchObject({ email: c.priya.email, joined: true, active: true });
    const managerView = await api.get(c.rahul, '/api/users?role=employee');
    expect(managerView.body.every((u) => u.email === undefined && u.role === 'employee')).toBe(true);
  });

  test('HR cannot lock themselves out', async () => {
    expect((await api.patch(c.hr, `/api/users/${c.hr._id}`, { active: false })).status).toBe(409);
    expect((await api.patch(c.hr, `/api/users/${c.hr._id}`, { role: 'employee' })).status).toBe(409);
  });
});
