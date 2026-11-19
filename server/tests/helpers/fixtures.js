// Builds a small company directly in the database, plus helpers that walk a piece of
// work through the real API (submit -> manager rating -> deliver -> client rating).
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../src/app');
const Organization = require('../../src/models/Organization');
const User = require('../../src/models/User');
const Project = require('../../src/models/Project');
const { outbox } = require('../../src/services/mailer');

const PASSWORD = 'password123';
let hash;
let counter = 0;

async function makeUser(org, role, name, extra = {}) {
  hash ||= await bcrypt.hash(PASSWORD, 4);
  counter += 1;
  return User.create({ org: org._id, role, name, email: `${name.toLowerCase()}.${counter}@fv.test`, passwordHash: hash, ...extra });
}

const auth = (user) => `Bearer ${jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;

// One company: HR, two managers, three employees, one project per manager.
async function makeCompany(name = 'Acme') {
  const org = await Organization.create({ name });
  const hr = await makeUser(org, 'hr', `${name}Hr`);
  const rahul = await makeUser(org, 'manager', `${name}Rahul`);
  const sara = await makeUser(org, 'manager', `${name}Sara`);
  const priya = await makeUser(org, 'employee', `${name}Priya`);
  const aman = await makeUser(org, 'employee', `${name}Aman`);
  const dev = await makeUser(org, 'employee', `${name}Dev`);
  const project = await Project.create({
    org: org._id, name: 'Checkout', manager: rahul._id,
    client: { name: 'Mark Ellis', email: `mark.${org._id}@client.example`, company: 'ShopWave' },
  });
  const saraProject = await Project.create({
    org: org._id, name: 'Data platform', manager: sara._id,
    client: { name: 'Tom Reid', email: `tom.${org._id}@client.example`, company: 'Medicore' },
  });
  return { org, hr, rahul, sara, priya, aman, dev, project, saraProject };
}

const api = {
  get: (user, url) => request(app).get(url).set('Authorization', auth(user)),
  post: (user, url, body) => request(app).post(url).set('Authorization', auth(user)).send(body),
  patch: (user, url, body) => request(app).patch(url).set('Authorization', auth(user)).send(body),
  put: (user, url, body) => request(app).put(url).set('Authorization', auth(user)).send(body),
  delete: (user, url) => request(app).delete(url).set('Authorization', auth(user)),
  public: request(app),
};

// The newest email to this address, and the token in its link.
function lastEmailTo(email) {
  return outbox.find((m) => m.to === email);
}
function tokenFrom(mail, kind) {
  const match = mail && mail.text.match(new RegExp(`/${kind}/(\\S+)`));
  return match ? match[1] : null;
}

// Walks one piece of work to the given stage and returns its id (and the client token).
async function workTo(stage, { manager, employee, project, managerScore = 4, clientScore = 4, title = 'Work' }) {
  const created = await api.post(manager, '/api/tasks', { projectId: String(project._id), employeeId: String(employee._id), title });
  expect(created.status).toBe(201);
  const id = created.body._id;
  if (stage === 'assigned') return { id };
  await api.patch(employee, `/api/tasks/${id}/status`, { status: 'in_progress' }).expect(200);
  if (stage === 'in_progress') return { id };
  await api.patch(employee, `/api/tasks/${id}/status`, { status: 'submitted', submission: 'https://git.example/pr/1' }).expect(200);
  if (stage === 'submitted') return { id };
  await api.post(manager, `/api/tasks/${id}/rating`, { score: managerScore }).expect(201);
  if (stage === 'manager_rated') return { id };
  await api.post(manager, `/api/tasks/${id}/deliver`).expect(200);
  const token = tokenFrom(lastEmailTo(project.client.email), 'rate');
  if (stage === 'delivered') return { id, token };
  await api.public.post(`/api/public/rate/${token}`).send({ score: clientScore }).expect(201);
  return { id, token };
}

module.exports = { makeCompany, makeUser, auth, api, lastEmailTo, tokenFrom, workTo, outbox, PASSWORD };
