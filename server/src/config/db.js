// Node's default DNS resolver may be misconfigured on some Windows/machine setups
// (pointing to 127.0.0.1 instead of actual upstream DNS), breaking SRV record
// resolution for mongodb+srv:// connections. Set the correct servers before any
// MongoDB driver code runs so SRV discovery succeeds.
const dns = require('dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);

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