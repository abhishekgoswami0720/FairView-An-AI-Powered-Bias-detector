// Gap analysis: collects every piece of work that has BOTH ratings, sends the pairs to
// the Python ML service, and turns its answer into Gap Cards for HR.
const Organization = require('../models/Organization');
const ManagerRating = require('../models/ManagerRating');
const ClientRating = require('../models/ClientRating');
const GapCard = require('../models/GapCard');
const audit = require('../utils/audit');
const { mlUrl, mlApiKey, autoAnalysis, analysis: settings } = require('../config/env');

const ML_TIMEOUT_MS = 20000;
const DEBOUNCE_MS = 3000;

// One row per piece of work rated by both the manager and the client.
// Work the client never rated is left out: a missing rating never counts against anyone.
async function collectPairs(orgId) {
  const clientRatings = await ClientRating.find({ org: orgId }).select('task manager employee score createdAt').lean();
  const managerRatings = await ManagerRating.find({ org: orgId, task: { $in: clientRatings.map((r) => r.task) } })
    .select('task score')
    .lean();
  const managerScore = new Map(managerRatings.map((r) => [String(r.task), r.score]));
  return clientRatings
    .filter((r) => managerScore.has(String(r.task)))
    .map((r) => ({
      taskId: String(r.task),
      managerId: String(r.manager),
      employeeId: String(r.employee),
      managerScore: managerScore.get(String(r.task)),
      clientScore: r.score,
      ratedAt: r.createdAt,
    }));
}

async function callMlService(pairs) {
  const res = await fetch(`${mlUrl}/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': mlApiKey },
    body: JSON.stringify({
      pairs: pairs.map(({ managerId, employeeId, managerScore, clientScore }) => ({ managerId, employeeId, managerScore, clientScore })),
      settings: { minPair: settings.minPair, minRest: settings.minRest, threshold: settings.threshold },
    }),
    signal: AbortSignal.timeout(ML_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`ML service answered ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body.pairs)) throw new Error('ML service sent an unexpected answer');
  return body.pairs;
}

const STAT_KEYS = ['n', 'managerAvg', 'clientAvg', 'meanGap', 'restN', 'restMeanGap', 'z', 'direction', 'patternScore'];
const statsOf = (r) => Object.fromEntries(STAT_KEYS.map((k) => [k, r[k] ?? undefined]));

// Creates a card for each newly flagged pair and refreshes the numbers on open cards.
// A pair that HR has already reviewed is flagged again only after enough NEW ratings
// (settings.reflagAfter), so the same card doesn't come straight back.
async function applyResults(orgId, results) {
  let created = 0;
  for (const r of results) {
    if (!r.eligible) continue;
    const pair = { org: orgId, manager: r.managerId, employee: r.employeeId };
    const open = await GapCard.findOne({ ...pair, status: 'open' });
    if (open) {
      open.latest = statsOf(r);
      open.latestAt = new Date();
      await open.save();
      continue;
    }
    if (!r.flagged) continue;
    const last = await GapCard.findOne(pair).sort({ createdAt: -1 });
    if (last && r.n < last.snapshot.n + settings.reflagAfter) continue;
    try {
      const card = await GapCard.create({ ...pair, snapshot: statsOf(r), latest: statsOf(r), latestAt: new Date() });
      created += 1;
      await audit({ org: orgId, actorLabel: 'FairView analysis', action: 'gapcard.create', entity: 'GapCard', entityId: card._id, detail: `z = ${r.z?.toFixed(2)} over ${r.n} pieces of work` });
    } catch (err) {
      if (err.code !== 11000) throw err; // 11000: another run created the same card a moment ago
    }
  }
  return created;
}

async function runAnalysis(orgId) {
  const save = (fields) => Organization.updateOne({ _id: orgId }, { $set: { analysis: { lastRunAt: new Date(), ...fields } } });
  if (!mlUrl) {
    await save({ lastStatus: 'disabled' });
    return { status: 'disabled' };
  }
  try {
    const pairs = await collectPairs(orgId);
    const results = await callMlService(pairs);
    const cardsCreated = await applyResults(orgId, results);
    await save({ lastStatus: 'ok', pairsAnalysed: pairs.length });
    return { status: 'ok', pairsAnalysed: pairs.length, cardsCreated };
  } catch (err) {
    const message = err.name === 'TimeoutError' ? 'The ML service did not answer in time.' : err.message;
    await save({ lastStatus: 'failed', lastError: message });
    console.error('Gap analysis failed:', message);
    return { status: 'failed', error: message };
  }
}

// After a client rating, run the analysis for that company a few seconds later.
// Several ratings in a row lead to a single run.
const timers = new Map();
function schedule(orgId) {
  if (!autoAnalysis || !mlUrl) return;
  const key = String(orgId);
  clearTimeout(timers.get(key));
  const timer = setTimeout(() => {
    timers.delete(key);
    runAnalysis(orgId).catch((err) => console.error('Gap analysis crashed:', err.message));
  }, DEBOUNCE_MS);
  timer.unref(); // never keeps the process alive on its own
  timers.set(key, timer);
}

module.exports = { collectPairs, runAnalysis, applyResults, schedule };
