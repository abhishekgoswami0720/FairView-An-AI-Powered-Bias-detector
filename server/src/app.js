// Builds the Express app (without starting it), so tests can use it directly.
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { corsOrigins, trustProxy, devOutbox } = require('./config/env');
const errorHandler = require('./middleware/errorHandler');

const app = express();

if (trustProxy) app.set('trust proxy', trustProxy);
app.use(helmet());
app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/orgs', require('./routes/orgs'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/ratings', require('./routes/ratings'));
app.use('/api/gap-cards', require('./routes/gapCards'));
app.use('/api/insights', require('./routes/insights'));
if (devOutbox) app.use('/api/dev', require('./routes/dev'));

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
app.use(errorHandler);

module.exports = app;
