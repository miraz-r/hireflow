const mongoose = require('mongoose');
const env = require('./env');

let isConnected = false;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
    });
    isConnected = true;
    console.log(`[db] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    isConnected = false;
    console.error(`[db] MongoDB connection failed: ${err.message}`);
    throw err;
  }
};

const isDBConnected = () => isConnected && mongoose.connection.readyState === 1;

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('[db] MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error(`[db] MongoDB error: ${err.message}`);
});

module.exports = { connectDB, isDBConnected };