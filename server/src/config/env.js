require('dotenv').config();

const required = (key) => {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const optional = (key, fallback) => process.env[key] ?? fallback;

module.exports = {
  port: parseInt(optional('PORT', '5000'), 10),
  nodeEnv: optional('NODE_ENV', 'development'),
  clientOrigin: optional('CLIENT_ORIGIN', 'http://localhost:5173'),
  mongoUri: required('MONGODB_URI'),
};