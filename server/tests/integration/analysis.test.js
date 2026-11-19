// Gap Cards: the backend sends rated pairs to the ML service and turns its answer into cards.
// The ML service is replaced by a small fake server here; the real one has its own tests (ml/tests).
const express = require('express');
const mongoose = require('mongoose');
const db = require('../helpers/db');

let stub;
let stubAnswer = () => ({ pairs: [] });
let lastRequest;

let fx; // fixtures, loaded after ML_URL is set
let analysis;
let GapCard;
let Organization;
let c;

beforeAll(async () => {
  const ml = express();
  ml.use(express.json({ limit: '5mb' }));
  ml.post('/analyze', (req, res) => {
    lastRequest = { body: req.body, apiKey: req.headers['x-api-key'] };
    const answer = stubAnswer(req.body);
    if (answer === 'fail') return res.status(500).json({});
    return res.json(answer);
  });
  stub = ml.listen(0);
  process.env.ML_URL = `http://127.0.0.1:${stub.address().port}`;
  process.env.ML_API_KEY = 'ml-key';
  // Load the app only now, so it picks up ML_URL.
  fx = require('../helpers/fixtures');
  analysis = require('../../src/services/analysis');
  GapCard = require('../../src/models/GapCard');
  Organization = require('../../src/models/Organization');
  await db.connect();
  c = await fx.makeCompany();
  // Rahul: 3 pieces for Priya (manager 2, client 5) and 3 for Aman (4 and 4).
  for (let i = 0; i < 3; i++) {
    await fx.workTo('client_rated', { manager: c.rahul, employee: c.priya, project: c.project, managerScore: 2, clientScore: 5 });
    await fx.workTo('client_rated', { manager: c.rahul, employee: c.aman, project: c.project, managerScore: 4, clientScore: 4 });
  }
  await fx.workTo('delivered', { manager: c.rahul, employee: c.priya, project: c.project }); // not rated by the client
});
afterAll(async () => {
  await db.disconnect();
  stub.close();
});

const flaggedAnswer = (body, extra = {}) => ({
  pairs: [
    { managerId: String(c.rahul._id), employeeId: String(c.priya._id), n: 3, managerAvg: 2, clientAvg: 5, meanGap: -3, restN: 3, restMeanGap: 0, z: -6.2, eligible: true, flagged: true, direction: 'lower', patternScore: 0.71, ...extra },
    { managerId: String(c.rahul._id), employeeId: String(c.aman._id), n: 3, managerAvg: 4, clientAvg: 4, meanGap: 0, restN: 3, restMeanGap: -3, z: 1.1, eligible: true, flagged: false, direction: 'higher', patternScore: 0.45 },
  ],
});

describe('Sending data to the ML service', () => {
  test('only work rated by BOTH sides is sent, with the API key and the settings', async () => {
    await analysis.runAnalysis(c.org._id);
    expect(lastRequest.apiKey).toBe('ml-key');
    expect(lastRequest.body.pairs).toHaveLength(6);
    expect(lastRequest.body.settings).toEqual({ minPair: 10, minRest: 10, threshold: 2.5 });
    const priya = lastRequest.body.pairs.filter((p) => p.employeeId === String(c.priya._id));
    expect(priya.every((p) => p.managerScore === 2 && p.clientScore === 5)).toBe(true);
  });
});

describe('Turning results into Gap Cards', () => {
  test('a flagged pair gets one open card; a fair pair gets none', async () => {
    stubAnswer = flaggedAnswer;
    const result = await analysis.runAnalysis(c.org._id);
    expect(result).toMatchObject({ status: 'ok', cardsCreated: 1, pairsAnalysed: 6 });
    const cards = await GapCard.find({ org: c.org._id });
    expect(cards).toHaveLength(1);
    expect(String(cards[0].employee)).toBe(String(c.priya._id));
    expect(cards[0].snapshot).toMatchObject({ z: -6.2, direction: 'lower', n: 3 });
  });

  test('running again does not duplicate the card, but refreshes its latest numbers', async () => {
    stubAnswer = (b) => flaggedAnswer(b, { z: -7.5 });
    const result = await analysis.runAnalysis(c.org._id);
    expect(result.cardsCreated).toBe(0);
    const card = await GapCard.findOne({ org: c.org._id });
    expect(card.snapshot.z).toBe(-6.2); // the reason for the card never changes
    expect(card.latest.z).toBe(-7.5);
  });

  test('HR sees the card with every rating behind it, and reviews it once', async () => {
    const list = await fx.api.get(c.hr, '/api/gap-cards?status=open');
    expect(list.status).toBe(200);
    expect(list.body[0].employee.name).toBe('AcmePriya');
    const detail = await fx.api.get(c.hr, `/api/gap-cards/${list.body[0]._id}`);
    expect(detail.body.ratings).toHaveLength(3);
    expect(detail.body.ratings[0]).toMatchObject({ managerScore: 2, clientScore: 5, clientEmail: c.project.client.email });
    expect(detail.body.current.rest).toMatchObject({ n: 3, meanGap: 0 });

    const review = await fx.api.post(c.hr, `/api/gap-cards/${list.body[0]._id}/review`, { outcome: 'discussed_with_manager', note: 'Talked to Rahul.' });
    expect(review.status).toBe(200);
    expect(review.body.status).toBe('reviewed');
    expect((await fx.api.post(c.hr, `/api/gap-cards/${list.body[0]._id}/review`, { outcome: 'no_issue' })).status).toBe(409);
  });

  test('a reviewed pair is not flagged again until there are enough new ratings', async () => {
    stubAnswer = (b) => flaggedAnswer(b, { n: 7 }); // 3 + 4 new: not enough (needs 5 more)
    expect((await analysis.runAnalysis(c.org._id)).cardsCreated).toBe(0);
    stubAnswer = (b) => flaggedAnswer(b, { n: 8 }); // 3 + 5 new
    expect((await analysis.runAnalysis(c.org._id)).cardsCreated).toBe(1);
  });

  test('only HR can see or act on Gap Cards', async () => {
    for (const user of [c.rahul, c.priya]) {
      expect((await fx.api.get(user, '/api/gap-cards')).status).toBe(403);
      expect((await fx.api.post(user, '/api/gap-cards/analyse')).status).toBe(403);
    }
  });
});

describe('When the ML service is down', () => {
  test('the failure is recorded for HR, and nothing else breaks', async () => {
    stubAnswer = () => 'fail';
    const result = await analysis.runAnalysis(c.org._id);
    expect(result.status).toBe('failed');
    const org = await Organization.findById(c.org._id);
    expect(org.analysis.lastStatus).toBe('failed');
    const overview = await fx.api.get(c.hr, '/api/insights/overview');
    expect(overview.body.analysis.lastStatus).toBe('failed');
  });

  test('HR can run the analysis by hand', async () => {
    stubAnswer = () => ({ pairs: [] });
    const res = await fx.api.post(c.hr, '/api/gap-cards/analyse');
    expect(res.body).toMatchObject({ status: 'ok' });
  });
});

describe('Overview numbers', () => {
  test('client rating rate and per-manager averages', async () => {
    const res = await fx.api.get(c.hr, '/api/insights/overview');
    expect(res.body.last90Days).toMatchObject({ delivered: 7, clientRated: 6 });
    expect(res.body.last90Days.clientRatingRate).toBeCloseTo(6 / 7, 2);
    const rahul = res.body.managers.find((m) => m.name === 'AcmeRahul');
    expect(rahul).toMatchObject({ n: 6, managerAvg: 3, clientAvg: 4.5, meanGap: -1.5 });
  });

  test("the manager's own team view compares him with clients, person by person", async () => {
    const res = await fx.api.get(c.rahul, '/api/insights/team');
    const priya = res.body.people.find((p) => p.name === 'AcmePriya');
    expect(priya).toMatchObject({ n: 3, managerAvg: 2, clientAvg: 5, meanGap: -3 });
    expect(mongoose.connection.readyState).toBe(1);
  });
});
