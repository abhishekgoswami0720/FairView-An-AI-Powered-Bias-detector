// Who sees which rating, and the summary numbers for each role's screen.
//
// Visibility rules:
//   HR        sees every rating in the company.
//   Manager   sees his own rating, and the client's once it exists (which is always after his).
//   Employee  sees both ratings only once they are "revealed": the client has rated, or the
//             rating link has run out. Before that, she only sees whether each side has rated,
//             so nobody can lobby the client after seeing a low manager score.
const mongoose = require('mongoose');
const Task = require('../models/Task');
const User = require('../models/User');
const ManagerRating = require('../models/ManagerRating');
const ClientRating = require('../models/ClientRating');
const GapCard = require('../models/GapCard');
const Organization = require('../models/Organization');
const sameId = require('../utils/sameId');

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const round = (x, d = 2) => (x == null || Number.isNaN(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function isRevealed(task, clientRating) {
  return Boolean(clientRating) || Boolean(task.ratingWindowEndsAt && task.ratingWindowEndsAt < new Date());
}

// Adds a `ratings` object to each task, following the rules above.
async function withRatings(tasks, viewer) {
  const ids = tasks.map((t) => t._id);
  const [managerRatings, clientRatings] = await Promise.all([
    ManagerRating.find({ task: { $in: ids } }).lean(),
    ClientRating.find({ task: { $in: ids } }).lean(),
  ]);
  const byTask = (list) => new Map(list.map((r) => [String(r.task), r]));
  const mByTask = byTask(managerRatings);
  const cByTask = byTask(clientRatings);

  return tasks.map((t) => {
    const task = typeof t.toJSON === 'function' ? t.toJSON() : t;
    const m = mByTask.get(String(task._id));
    const c = cByTask.get(String(task._id));
    const revealed = isRevealed(task, c);
    const isHr = viewer.role === 'hr';
    const isManager = sameId(task.manager?._id ?? task.manager, viewer.id);
    const showManager = isHr || isManager || revealed;
    const showClient = isHr || isManager || revealed;
    return {
      ...task,
      ratings: {
        managerDone: Boolean(m),
        clientDone: Boolean(c),
        revealed,
        manager: m && showManager ? { id: m._id, score: m.score, comment: m.comment || null, at: m.createdAt } : null,
        client: c && showClient
          ? { id: c._id, score: c.score, comment: c.comment || null, at: c.createdAt, clientName: c.clientName, ...(isHr ? { clientEmail: c.clientEmail } : {}) }
          : null,
      },
    };
  });
}

// Pairs of (manager stars, client stars) for the same work, grouped by a key.
async function ratedPairs(filter) {
  const clientRatings = await ClientRating.find(filter).lean();
  const managerRatings = await ManagerRating.find({ task: { $in: clientRatings.map((r) => r.task) } }).lean();
  const mByTask = new Map(managerRatings.map((r) => [String(r.task), r]));
  return clientRatings
    .filter((c) => mByTask.has(String(c.task)))
    .map((c) => ({ task: c.task, manager: c.manager, employee: c.employee, managerScore: mByTask.get(String(c.task)).score, clientScore: c.score, at: c.createdAt }));
}

function summarise(pairs) {
  const managerAvg = avg(pairs.map((p) => p.managerScore));
  const clientAvg = avg(pairs.map((p) => p.clientScore));
  return {
    n: pairs.length,
    managerAvg: round(managerAvg),
    clientAvg: round(clientAvg),
    meanGap: round(managerAvg != null ? managerAvg - clientAvg : null),
  };
}

// Employee: her own record.
async function employeeRecord(viewer) {
  const tasks = await Task.find({ org: viewer.org, employee: viewer.id, status: 'delivered' })
    .sort({ deliveredAt: -1 })
    .populate('project', 'name client.company')
    .populate('manager', 'name');
  const rows = await withRatings(tasks, viewer);
  const revealed = rows.filter((r) => r.ratings.revealed);
  return {
    summary: {
      delivered: rows.length,
      clientRated: rows.filter((r) => r.ratings.clientDone).length,
      clientAvg: round(avg(revealed.filter((r) => r.ratings.client).map((r) => r.ratings.client.score))),
      managerAvg: round(avg(revealed.filter((r) => r.ratings.manager).map((r) => r.ratings.manager.score))),
    },
    work: rows,
  };
}

// Manager: how his ratings compare with clients' ratings, person by person.
// This lets a manager spot his own gap before HR ever needs to.
async function teamView(viewer) {
  const pairs = await ratedPairs({ org: viewer.org, manager: viewer.id });
  const employeeIds = [...new Set(pairs.map((p) => String(p.employee)))];
  const taskEmployees = await Task.distinct('employee', { org: viewer.org, manager: viewer.id });
  const allIds = [...new Set([...employeeIds, ...taskEmployees.map(String)])];
  const people = await User.find({ _id: { $in: allIds } }).select('name active');
  const delivered = await Task.countDocuments({ org: viewer.org, manager: viewer.id, status: 'delivered' });
  return {
    overall: { ...summarise(pairs), delivered, clientRated: pairs.length },
    people: people
      .map((u) => ({ id: u._id, name: u.name, active: u.active, ...summarise(pairs.filter((p) => sameId(p.employee, u._id))) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// HR: the company at a glance.
async function overview(viewer) {
  const org = oid(viewer.org);
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const [orgDoc, roleCounts, deliveredRecent, clientRatedRecent, openCards, reviewedCards, pairs, managers] = await Promise.all([
    Organization.findById(org).select('name analysis'),
    User.aggregate([{ $match: { org, active: true } }, { $group: { _id: '$role', n: { $sum: 1 } } }]),
    Task.countDocuments({ org, status: 'delivered', deliveredAt: { $gte: since } }),
    ClientRating.countDocuments({ org, createdAt: { $gte: since } }),
    GapCard.countDocuments({ org, status: 'open' }),
    GapCard.countDocuments({ org, status: 'reviewed' }),
    ratedPairs({ org }),
    User.find({ org, role: 'manager' }).select('name active'),
  ]);
  const people = Object.fromEntries(roleCounts.map((r) => [r._id, r.n]));
  return {
    orgName: orgDoc.name,
    analysis: orgDoc.analysis || null,
    people: { hr: people.hr || 0, manager: people.manager || 0, employee: people.employee || 0 },
    last90Days: {
      delivered: deliveredRecent,
      clientRated: clientRatedRecent,
      // The number that matters most: without client ratings there is nothing to compare.
      clientRatingRate: deliveredRecent ? round(Math.min(1, clientRatedRecent / deliveredRecent), 3) : null,
    },
    gapCards: { open: openCards, reviewed: reviewedCards },
    managers: managers
      .map((m) => ({ id: m._id, name: m.name, active: m.active, ...summarise(pairs.filter((p) => sameId(p.manager, m._id))) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// HR: one Gap Card with every rating behind it.
async function gapCardDetail(viewer, cardId) {
  const card = await GapCard.findOne({ _id: cardId, org: viewer.org })
    .populate('manager', 'name email')
    .populate('employee', 'name email')
    .populate('review.by', 'name');
  if (!card) return null;
  const pairs = await ratedPairs({ org: viewer.org, manager: card.manager._id });
  const mine = pairs.filter((p) => sameId(p.employee, card.employee._id));
  const rest = pairs.filter((p) => !sameId(p.employee, card.employee._id));
  const tasks = await Task.find({ _id: { $in: mine.map((p) => p.task) } }).select('title project deliveredAt').populate('project', 'name client.company');
  const [mRatings, cRatings] = await Promise.all([
    ManagerRating.find({ task: { $in: mine.map((p) => p.task) } }).lean(),
    ClientRating.find({ task: { $in: mine.map((p) => p.task) } }).lean(),
  ]);
  const mBy = new Map(mRatings.map((r) => [String(r.task), r]));
  const cBy = new Map(cRatings.map((r) => [String(r.task), r]));
  const ratings = tasks
    .map((t) => {
      const m = mBy.get(String(t._id));
      const c = cBy.get(String(t._id));
      return {
        taskId: t._id,
        title: t.title,
        project: t.project?.name,
        clientCompany: t.project?.client?.company || null,
        ratedAt: c.createdAt,
        managerScore: m.score,
        managerComment: m.comment || null,
        clientScore: c.score,
        clientComment: c.comment || null,
        clientName: c.clientName,
        clientEmail: c.clientEmail,
      };
    })
    .sort((a, b) => new Date(a.ratedAt) - new Date(b.ratedAt));
  return {
    card,
    current: { pair: summarise(mine), rest: summarise(rest), distinctClients: new Set(ratings.map((r) => r.clientEmail)).size },
    ratings,
  };
}

module.exports = { withRatings, employeeRecord, teamView, overview, gapCardDetail, isRevealed, ratedPairs };
