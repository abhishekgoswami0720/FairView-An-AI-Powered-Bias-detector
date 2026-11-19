// Creates a demo company with six months of realistic work and ratings, so every screen
// has something to show. One manager quietly under-rates one employee and another
// over-rates one, so the gap analysis has real patterns to find.
//
//   npm run seed             add the demo company (stops if it already exists)
//   npm run seed -- --reset  WIPE THE WHOLE DATABASE first, then add the demo company
//
// All demo passwords are "password123". Use this only on a local or test database.
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { required, mlUrl } = require('../config/env');
const connectDB = require('../config/db');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const ManagerRating = require('../models/ManagerRating');
const ClientRating = require('../models/ClientRating');
const RatingLink = require('../models/RatingLink');
const GapCard = require('../models/GapCard');
const AuditLog = require('../models/AuditLog');
const links = require('../services/links');
const analysis = require('../services/analysis');

const MODELS = [Organization, User, Project, Task, ManagerRating, ClientRating, RatingLink, GapCard, AuditLog];
const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (d) => new Date(now - d * DAY);

// Same random numbers on every run, so the demo always looks the same.
function randomGenerator(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = randomGenerator(20261117);
const normal = (sd) => sd * Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
const stars = (x) => Math.max(1, Math.min(5, Math.round(x)));
const pick = (list) => list[Math.floor(rand() * list.length)];

const PEOPLE = {
  hr: { name: 'Neha Kapoor', email: 'hr@fairview.test' },
  managers: [
    { key: 'rahul', name: 'Rahul Verma', email: 'rahul@fairview.test', harshness: -0.2 },
    { key: 'sara', name: 'Sara Thomas', email: 'sara@fairview.test', harshness: 0.1 },
  ],
  // quality = how good the work really is (what clients see, on average)
  // bias    = extra stars the manager adds (+) or removes (-) for this one person
  employees: [
    { key: 'priya', name: 'Priya Sharma', manager: 'rahul', quality: 4.4, bias: -1.5, pieces: 15 },
    { key: 'aman', name: 'Aman Gupta', manager: 'rahul', quality: 3.6, bias: 0, pieces: 13 },
    { key: 'kabir', name: 'Kabir Singh', manager: 'rahul', quality: 3.9, bias: 0, pieces: 12 },
    { key: 'isha', name: 'Isha Rao', manager: 'rahul', quality: 3.3, bias: 0, pieces: 12 },
    { key: 'dev', name: 'Dev Patel', manager: 'sara', quality: 3.8, bias: 0, pieces: 13 },
    { key: 'meera', name: 'Meera Nair', manager: 'sara', quality: 4.1, bias: 0, pieces: 12 },
    { key: 'arjun', name: 'Arjun Mehta', manager: 'sara', quality: 3.2, bias: 1.3, pieces: 14 },
  ],
};

const PROJECTS = [
  {
    manager: 'rahul', name: 'Checkout revamp', description: 'New cart and payment flow for the web store.',
    client: { name: 'Mark Ellis', email: 'mark@shopwave.example', company: 'ShopWave' }, clientHarshness: 0,
    titles: ['Cart page speed fixes', 'Payment retry flow', 'Coupon code validation', 'Address autocomplete', 'Order summary redesign', 'Saved cards', 'Guest checkout', 'Checkout error messages', 'Tax calculation API', 'Mobile checkout layout', 'Abandoned cart email hook', 'Delivery slot picker'],
  },
  {
    manager: 'rahul', name: 'Partner portal', description: 'Portal for logistics partners to track shipments.',
    client: { name: 'Lisa Grant', email: 'lisa@freightline.example', company: 'Freightline' }, clientHarshness: -0.2,
    titles: ['Shipment search', 'Partner login with SSO', 'Bulk CSV upload', 'Delay alerts', 'Invoice download', 'Tracking map', 'Role-based access', 'Audit trail export', 'Dashboard filters', 'Rate card editor', 'Proof of delivery upload', 'Notification settings'],
  },
  {
    manager: 'sara', name: 'Data platform migration', description: 'Move reporting from on-premise SQL to the cloud.',
    client: { name: 'Tom Reid', email: 'tom@medicore.example', company: 'Medicore' }, clientHarshness: 0.1,
    titles: ['Patient visits pipeline', 'Nightly load job', 'Data quality checks', 'Billing report rebuild', 'Access controls on datasets', 'Backfill 2024 data', 'Pipeline monitoring', 'Cost dashboard', 'Schema documentation', 'Lab results feed', 'Retention policy job', 'Query performance tuning'],
  },
  {
    manager: 'sara', name: 'Mobile banking app', description: 'Android and iOS app for retail customers.',
    client: { name: 'Anita Shah', email: 'anita@paynest.example', company: 'PayNest' }, clientHarshness: 0,
    titles: ['UPI payment screen', 'Biometric login', 'Statement download', 'Card freeze toggle', 'Push notifications', 'Bill reminders', 'Spending insights', 'Beneficiary management', 'Dark mode', 'Crash fixes for Android 15', 'Offline balance view', 'Onboarding KYC flow'],
  },
];

const CLIENT_COMMENTS = {
  high: ['Exactly what we needed.', 'Clean work and on time.', 'Great attention to detail.', 'Our users noticed the difference.', 'Smooth handover, no surprises.'],
  mid: ['Works, a few rough edges.', 'Fine overall.', 'Needed one round of fixes.', 'OK, documentation could be better.'],
  low: ['Several bugs on first try.', 'Missed part of the brief.', 'Late and needed rework.'],
};
const MANAGER_COMMENTS = {
  high: ['Solid delivery.', 'Good work.', 'Well tested.'],
  mid: ['Acceptable.', 'Needs more ownership.', 'Could communicate more.'],
  low: ['Below expectations.', 'Needed a lot of follow-up.', 'Quality issues.'],
};
const commentFor = (bank, score) => (rand() < 0.55 ? pick(score >= 4 ? bank.high : score === 3 ? bank.mid : bank.low) : undefined);

async function main() {
  const reset = process.argv.includes('--reset');
  await connectDB(required('MONGODB_URI'));

  if (reset) {
    console.log(`Wiping database "${mongoose.connection.name}"...`);
    await mongoose.connection.dropDatabase();
  }
  await Promise.all(MODELS.map((m) => m.createIndexes()));

  if (await User.exists({ email: PEOPLE.hr.email })) {
    console.log('The demo company already exists. Run "npm run seed -- --reset" to wipe the database and start again.');
    return;
  }

  const passwordHash = await bcrypt.hash('password123', 10);
  const org = await Organization.create({ name: 'Bluepeak Digital' });
  const hr = await User.create({ org: org._id, role: 'hr', passwordHash, ...PEOPLE.hr });
  const managers = {};
  for (const m of PEOPLE.managers) {
    managers[m.key] = await User.create({ org: org._id, role: 'manager', passwordHash, name: m.name, email: m.email });
  }
  const employees = {};
  for (const e of PEOPLE.employees) {
    employees[e.key] = await User.create({ org: org._id, role: 'employee', passwordHash, name: e.name, email: `${e.key}@fairview.test` });
  }
  // Someone HR has invited who has not joined yet.
  await User.create({ org: org._id, role: 'employee', name: 'Rohan Das', email: 'rohan@fairview.test', inviteNonce: 'demo-not-joined', inviteExpiresAt: new Date(now + 5 * DAY) });

  const projects = [];
  for (const p of PROJECTS) {
    projects.push({
      ...p,
      doc: await Project.create({ org: org._id, name: p.name, description: p.description, manager: managers[p.manager]._id, client: p.client, createdAt: daysAgo(200) }),
      used: 0,
    });
  }
  const nextTitle = (project) => {
    const title = project.titles[project.used % project.titles.length];
    const round = Math.floor(project.used / project.titles.length);
    project.used += 1;
    return round ? `${title} (phase ${round + 1})` : title;
  };

  const tasks = [];
  const managerRatings = [];
  const clientRatings = [];
  const ratingLinks = [];
  const pendingLinks = [];

  for (const e of PEOPLE.employees) {
    const employee = employees[e.key];
    const managerInfo = PEOPLE.managers.find((m) => m.key === e.manager);
    const manager = managers[e.manager];
    const myProjects = projects.filter((p) => p.manager === e.manager);

    // Delivered work with both ratings, spread over the last six months.
    for (let i = 0; i < e.pieces; i++) {
      const project = myProjects[i % myProjects.length];
      const day = 175 - Math.floor((i * 165) / e.pieces) - Math.floor(rand() * 5);
      const clientScore = stars(e.quality + project.clientHarshness + normal(0.55));
      const managerScore = stars(e.quality + managerInfo.harshness + e.bias + normal(0.55));
      const taskId = new mongoose.Types.ObjectId();
      const linkId = new mongoose.Types.ObjectId();
      const base = { org: org._id, task: taskId, project: project.doc._id, manager: manager._id, employee: employee._id };
      tasks.push({
        _id: taskId, org: org._id, project: project.doc._id, manager: manager._id, employee: employee._id,
        title: nextTitle(project), status: 'delivered', submission: `https://git.bluepeak.example/${project.doc._id}/pr/${100 + tasks.length}`,
        createdAt: daysAgo(day + 9), updatedAt: daysAgo(day + 1), submittedAt: daysAgo(day + 3), deliveredAt: daysAgo(day + 1), ratingWindowEndsAt: daysAgo(day - 13),
      });
      managerRatings.push({ ...base, score: managerScore, comment: commentFor(MANAGER_COMMENTS, managerScore), createdAt: daysAgo(day + 2) });
      ratingLinks.push({ _id: linkId, org: org._id, task: taskId, project: project.doc._id, clientName: project.client.name, clientEmail: project.client.email, expiresAt: daysAgo(day - 13), sentAt: daysAgo(day + 1), usedAt: daysAgo(day), createdAt: daysAgo(day + 1), updatedAt: daysAgo(day) });
      clientRatings.push({ _id: new mongoose.Types.ObjectId(), ...base, score: clientScore, comment: commentFor(CLIENT_COMMENTS, clientScore), clientName: project.client.name, clientEmail: project.client.email, link: linkId, createdAt: daysAgo(day) });
    }

    // Work in other states, so every screen has something to act on.
    const project = myProjects[0];
    const open = (status, extra = {}) => tasks.push({
      _id: new mongoose.Types.ObjectId(), org: org._id, project: project.doc._id, manager: manager._id, employee: employee._id,
      title: nextTitle(project), status, createdAt: daysAgo(6), updatedAt: daysAgo(2), ...extra,
    });
    open('assigned');
    if (['priya', 'aman', 'dev', 'arjun'].includes(e.key)) open('in_progress');
    if (['priya', 'kabir', 'meera'].includes(e.key)) open('submitted', { submission: 'https://git.bluepeak.example/pr/review-me', submittedAt: daysAgo(1) });
    if (['priya', 'isha', 'dev'].includes(e.key)) {
      // Delivered and rated by the manager, waiting for the client.
      const taskId = new mongoose.Types.ObjectId();
      const linkId = new mongoose.Types.ObjectId();
      const expiresAt = new Date(now + 12 * DAY);
      tasks.push({
        _id: taskId, org: org._id, project: project.doc._id, manager: manager._id, employee: employee._id,
        title: nextTitle(project), status: 'delivered', submission: 'https://git.bluepeak.example/pr/awaiting-client',
        createdAt: daysAgo(8), updatedAt: daysAgo(2), submittedAt: daysAgo(3), deliveredAt: daysAgo(2), ratingWindowEndsAt: expiresAt,
      });
      const score = stars(e.quality + managerInfo.harshness + e.bias + normal(0.4));
      managerRatings.push({ org: org._id, task: taskId, project: project.doc._id, manager: manager._id, employee: employee._id, score, createdAt: daysAgo(2) });
      ratingLinks.push({ _id: linkId, org: org._id, task: taskId, project: project.doc._id, clientName: project.client.name, clientEmail: project.client.email, expiresAt, sentAt: daysAgo(2), createdAt: daysAgo(2), updatedAt: daysAgo(2) });
      pendingLinks.push({ employee: e.name, url: links.ratingUrl(linkId) });
    }
  }

  // Saved with timestamps: false so the dates above are kept as they are.
  await Task.insertMany(tasks, { timestamps: false });
  await ManagerRating.insertMany(managerRatings, { timestamps: false });
  await RatingLink.insertMany(ratingLinks, { timestamps: false });
  await ClientRating.insertMany(clientRatings, { timestamps: false });
  await AuditLog.insertMany([
    { org: org._id, actor: hr._id, action: 'org.create', entity: 'Organization', entityId: String(org._id), outcome: 'allowed', detail: 'Demo company created by the seed script' },
    { org: org._id, actor: managers.rahul._id, action: 'ClientRating.patch', entity: 'ClientRating', entityId: String(clientRatings[0]._id), outcome: 'blocked', detail: 'Tried to PATCH a locked ClientRating' },
  ]);

  console.log(`\nCreated "${org.name}": ${Object.keys(employees).length} employees, ${tasks.length} pieces of work, ${clientRatings.length} rated by both sides.`);
  console.log('\nLog in with password "password123":');
  console.log(`  HR        ${PEOPLE.hr.email}`);
  for (const m of PEOPLE.managers) console.log(`  Manager   ${m.email}`);
  for (const e of PEOPLE.employees) console.log(`  Employee  ${e.key}@fairview.test`);
  console.log('\nClient rating links waiting to be used (open one to see the client\'s page):');
  for (const l of pendingLinks) console.log(`  ${l.employee.padEnd(13)} ${l.url}`);

  if (mlUrl) {
    const result = await analysis.runAnalysis(org._id);
    console.log(`\nGap analysis: ${result.status}${result.status === 'ok' ? `, ${result.cardsCreated} Gap Card(s) raised` : result.error ? ` (${result.error})` : ''}`);
  } else {
    console.log('\nML_URL is not set, so no gap analysis was run. Start the ML service, set ML_URL, and press "Run analysis" on the HR overview.');
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
