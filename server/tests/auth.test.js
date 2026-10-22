const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

jest.mock('../src/models/User', () => ({ findOne: jest.fn(), findById: jest.fn(), find: jest.fn() }));
jest.mock('../src/models/AuditLog', () => ({ create: jest.fn().mockResolvedValue({}) }));

const User = require('../src/models/User');
const app = require('../src/app');
const { ids, tokenFor } = require('./helpers');

describe('Login', () => {
  const login = (body) => request(app).post('/api/auth/login').send(body);
  let hash;
  beforeAll(async () => { hash = await bcrypt.hash('password123', 4); });

  function userFound(user) {
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
  }

  test('correct password gives a token that carries the role', async () => {
    userFound({ _id: ids.manager, name: 'Rahul', role: 'manager', passwordHash: hash });
    const res = await login({ email: 'manager@fairview.test', password: 'password123' });
    expect(res.status).toBe(200);
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload).toMatchObject({ sub: ids.manager, role: 'manager' });
  });

  test('wrong password is refused', async () => {
    userFound({ _id: ids.manager, role: 'manager', passwordHash: hash });
    const res = await login({ email: 'manager@fairview.test', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('unknown email gets the same message as a wrong password', async () => {
    userFound(null);
    const res = await login({ email: 'nobody@fairview.test', password: 'password123' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Wrong email or password.');
  });

  test('missing fields are refused', async () => {
    expect((await login({})).status).toBe(400);
  });
});

describe('Token checks', () => {
  const get = (auth) => {
    const r = request(app).get('/api/projects');
    return auth ? r.set('Authorization', auth) : r;
  };

  test('no token -> 401', async () => {
    expect((await get()).status).toBe(401);
  });

  test('a forged token (wrong secret) -> 401', async () => {
    const fake = jwt.sign({ sub: ids.hr, role: 'hr' }, 'attacker-secret');
    expect((await get(`Bearer ${fake}`)).status).toBe(401);
  });

  test('an expired token -> 401', async () => {
    const old = jwt.sign({ sub: ids.hr, role: 'hr', exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET);
    expect((await get(`Bearer ${old}`)).status).toBe(401);
  });
});

describe('Creating accounts', () => {
  test('only HR can create users (no public sign-up)', async () => {
    for (const role of ['client', 'manager', 'employee']) {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', tokenFor(ids.client, role))
        .send({ name: 'X', email: 'x@x.test', password: 'password123', role: 'hr' });
      expect(res.status).toBe(403);
    }
  });
});
