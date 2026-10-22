// Compares two ids safely (database ids are objects, token ids are text).
function sameId(a, b) {
  return a != null && b != null && String(a) === String(b);
}

module.exports = sameId;
