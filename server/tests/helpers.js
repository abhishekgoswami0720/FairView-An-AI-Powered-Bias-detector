const jwt = require('jsonwebtoken');

// Fixed fake ids (24 hex characters, like real MongoDB ids).
const ids = {
  client: '64a000000000000000000001',
  otherClient: '64a000000000000000000002',
  manager: '64a000000000000000000003',
  otherManager: '64a000000000000000000004',
  priya: '64a000000000000000000005',
  aman: '64a000000000000000000006',
  hr: '64a000000000000000000007',
  project: '64b000000000000000000001',
  task: '64c000000000000000000001',
  rating: '64d000000000000000000001',
};

// Makes a login token for a fake user, like the real login route would.
function tokenFor(userId, role) {
  return `Bearer ${jwt.sign({ sub: userId, role }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
}

// A fake project object with a save() we can check.
function fakeProject(overrides = {}) {
  return {
    _id: ids.project,
    client: ids.client,
    manager: ids.manager,
    status: 'open',
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

module.exports = { ids, tokenFor, fakeProject };
