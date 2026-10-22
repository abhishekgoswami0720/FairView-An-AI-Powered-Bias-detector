// Reads settings from the .env file and stops the server early if something important is missing.
require('dotenv').config({ quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env (see .env.example)`);
  return value;
}

module.exports = {
  required,
  port: Number(process.env.PORT) || 5000,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
