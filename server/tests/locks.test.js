// Proves the "write once" lock at the database-model level.
// These run the real Mongoose models; the lock fires BEFORE any database call.
const ClientRating = require('../src/models/ClientRating');
const ManagerAssessment = require('../src/models/ManagerAssessment');
const AuditLog = require('../src/models/AuditLog');
const Task = require('../src/models/Task');
const { LockedRecordError } = require('../src/models/lockRecord');

const LOCKED_MODELS = { ClientRating, ManagerAssessment, AuditLog };

describe.each(Object.entries(LOCKED_MODELS))('%s is write-once', (name, Model) => {
  const attempts = {
    updateOne: () => Model.updateOne({}, { $set: { score: 1 } }),
    updateMany: () => Model.updateMany({}, { $set: { score: 1 } }),
    findOneAndUpdate: () => Model.findOneAndUpdate({}, { $set: { score: 1 } }),
    findByIdAndUpdate: () => Model.findByIdAndUpdate('64d000000000000000000001', { score: 1 }),
    replaceOne: () => Model.replaceOne({}, {}),
    findOneAndReplace: () => Model.findOneAndReplace({}, {}),
    deleteOne: () => Model.deleteOne({}),
    deleteMany: () => Model.deleteMany({}),
    findOneAndDelete: () => Model.findOneAndDelete({}),
    findByIdAndDelete: () => Model.findByIdAndDelete('64d000000000000000000001'),
    bulkWrite: () => Model.bulkWrite([{ deleteMany: { filter: {} } }]),
  };

  test.each(Object.keys(attempts))('%s is refused', async (op) => {
    await expect(attempts[op]()).rejects.toBeInstanceOf(LockedRecordError);
  });

  test('saving an existing record (an edit) is refused', async () => {
    const doc = new Model({});
    doc.isNew = false; // pretend it was loaded from the database
    await expect(doc.save()).rejects.toBeInstanceOf(LockedRecordError);
  });

  test('deleting a loaded record is refused', async () => {
    const doc = new Model({});
    doc.isNew = false;
    await expect(doc.deleteOne()).rejects.toBeInstanceOf(LockedRecordError);
  });
});

describe('Rating scores', () => {
  const valid = { project: '64b000000000000000000001', client: '64a000000000000000000001' };

  test.each([1, 7, 10])('score %d is accepted', async (score) => {
    await expect(new ClientRating({ ...valid, score }).validate()).resolves.toBeUndefined();
  });

  test.each([0, 11, 7.5, -3])('score %d is rejected', async (score) => {
    await expect(new ClientRating({ ...valid, score }).validate()).rejects.toThrow();
  });
});

describe('Task work share', () => {
  test('cannot be changed after the task exists', () => {
    const task = new Task({ workShare: 0.4 });
    task.isNew = false;
    task.workShare = 0.9;
    expect(task.workShare).toBe(0.4);
  });

  test.each([0, 1.5])('work share %d is rejected', async (workShare) => {
    const task = new Task({
      project: '64b000000000000000000001', manager: '64a000000000000000000003',
      employee: '64a000000000000000000005', title: 'x', workShare,
    });
    await expect(task.validate()).rejects.toThrow();
  });
});
