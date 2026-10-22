// lockRecord: a Mongoose plugin that makes a collection "write once".
// A record can be CREATED, but never changed or deleted afterwards.
// We use it for client ratings, manager ratings and the audit log.

// Every Mongoose operation that could change or delete existing records.
const BLOCKED_QUERY_OPS = [
  'updateOne', 'updateMany', 'replaceOne',
  'findOneAndUpdate', 'findOneAndReplace', 'findOneAndDelete',
  'deleteOne', 'deleteMany',
];

class LockedRecordError extends Error {
  constructor(modelName) {
    super(`${modelName} records are locked and cannot be changed or deleted.`);
    this.name = 'LockedRecordError';
    this.status = 403;
  }
}

function lockRecord(schema, { modelName }) {
  // 1. Block update/delete queries before they ever reach the database.
  schema.pre(BLOCKED_QUERY_OPS, async function () {
    throw new LockedRecordError(modelName);
  });

  // 2. Block bulk writes (many operations sent at once).
  schema.pre('bulkWrite', async function () {
    throw new LockedRecordError(modelName);
  });

  // 3. Block saving a record that already exists (that would be an edit).
  //    We check at 'validate' too, because Mongoose validates BEFORE 'save' hooks run;
  //    this makes the lock the first thing that refuses an edit.
  const refuseEdits = async function () {
    if (!this.isNew) throw new LockedRecordError(modelName);
  };
  schema.pre('validate', refuseEdits);
  schema.pre('save', refuseEdits);
}

module.exports = { lockRecord, LockedRecordError, BLOCKED_QUERY_OPS };
