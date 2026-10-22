// Builds the Express app (without starting it), so tests can use it directly.
const express = require('express');
const cors = require('cors');
const { corsOrigin } = require('./config/env');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/assessments', require('./routes/assessments'));
app.use('/api/ratings', require('./routes/ratings'));

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
app.use(errorHandler);

module.exports = app;
