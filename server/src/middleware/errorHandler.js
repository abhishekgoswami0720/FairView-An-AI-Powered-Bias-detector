// One place that turns every error into a clear JSON reply.
// (Express 5 automatically sends errors from async route code here.)
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: messages.join(' ') });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: `Invalid ${err.path}.` });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'This already exists.' });
  }
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'Something went wrong on the server.' });
}

module.exports = errorHandler;
