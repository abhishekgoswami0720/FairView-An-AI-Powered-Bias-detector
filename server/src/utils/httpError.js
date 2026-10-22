// A small helper so route code can say: throw httpError(404, 'Project not found')
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = httpError;
