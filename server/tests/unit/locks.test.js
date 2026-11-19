// Proves the "write once" lock at the model level. No database needed:
// the lock refuses every change BEFORE any database call is made.
const mongoose = require('mongoose');
const ClientRating = require('../../src/models/ClientRating');
const ManagerRating = require('../../src/models/ManagerRating');
const AuditLog = require('../../src/models/AuditLog');
const { LockedRecordError } = require('../../src/models/lockRecord');

beforeAll(() => mongoose.set('bufferCommands', false)); // any real database call fails at once

const LOCKED_MODELS = { ClientRating, ManagerRating, AuditLog };
const someId = '64d000000000000000000001';

describe.each(Object.entries(LOCKED_MODELS))('%s is write-once', (name, Model) => {
  const attempts = {
    updateOne: () => Model.updateOne({}, { $set: { score: 1 } }),
    updateMany: () => Model.updateMany({}, { $set: { score: 1 } }),
    findOneAndUpdate: () => Model.findOneAndUpdate({}, { $set: { score: 1 } }),
    findByIdAndUpdate: () => Model.findByIdAndUpdate(someId, { score: 1 }),
    replaceOne: () => Model.replaceOne({}, {}),
    findOneAndReplace: () => Model.findOneAndReplace({}, {}),
    deleteOne: () => Model.deleteOne({}),
    deleteMany: () => Model.deleteMany({}),
    findOneAndDelete: () => Model.findOneAndDelete({}),
    findByIdAndDelete: () => Model.findByIdAndDelete(someId),
    bulkWrite: () => Model.bulkWrite([{ deleteMany: { filter: {} } }]),
  };

  test.each(Object.keys(attempts))('%s is refused', async (op) => {
    await expect(attempts[op]()).rejects.toBeInstanceOf(LockedRecordError);
  });

  test('saving an existing record (an edit) is refused, even with invalid data', async () => {
    const doc = new Model({});
    doc.isNew = false; // pretend it was loaded from the database
    await expect(doc.save()).rejects.toBeInstanceOf(LockedRecordError);
  });

  test('deleting a loaded record is refused', async () => {
    const doc = new Model({});
    doc.isNew = false;
    await expect(doc.deleteOne()).rejects.toBeInstanceOf(LockedRecordError);
  });

  test('the error carries status 403', () => {
    expect(new LockedRecordError(name).status).toBe(403);
  });
});

describe('Rating scores are whole numbers from 1 to 5', () => {
  const base = {
    org: someId, task: someId, project: someId, manager: someId, employee: someId,
  };
  test.each([1, 3, 5])('%d stars is accepted', async (score) => {
    await expect(new ClientRating({ ...base, score }).validate()).resolves.toBeUndefined();
    await expect(new ManagerRating({ ...base, score }).validate()).resolves.toBeUndefined();
  });
  test.each([0, 6, 10, 3.5, -1])('%d is rejected', async (score) => {
    await expect(new ClientRating({ ...base, score }).validate()).rejects.toThrow();
    await expect(new ManagerRating({ ...base, score }).validate()).rejects.toThrow();
  });
});
