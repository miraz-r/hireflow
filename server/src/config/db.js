// Node's default DNS resolver may be misconfigured on some Windows/machine
// setups (pointing to 127.0.0.1 instead of actual upstream DNS), breaking SRV
// record resolution for mongodb+srv:// connections. This override is OFF by
// default: deployments running healthy DNS should not need it. Set
// DNS_SERVERS (comma-separated, e.g. "1.1.1.1,1.0.0.1") to opt in.
const dns = require('dns');
if (process.env.DNS_SERVERS && process.env.DNS_SERVERS.trim()) {
  const servers = process.env.DNS_SERVERS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (servers.length > 0) {
    console.log(`[db] Using custom DNS servers: ${servers.join(', ')}`);
    dns.setServers(servers);
  }
}

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