/**
 * HireFlow — Admin bootstrapper.
 *
 * Creates the first admin user. Credentials come from the environment, never
 * from source code:
 *   ADMIN_BOOTSTRAP_EMAIL
 *   ADMIN_BOOTSTRAP_PASSWORD
 *   ADMIN_BOOTSTRAP_FULL_NAME
 *   ADMIN_BOOTSTRAP_PHONE
 *
 * Idempotent: no-op if a user with the given email already exists, so it's
 * safe to rerun. Refuses to run in production unless
 * ADMIN_BOOTSTRAP_ALLOW_PRODUCTION=true.
 *
 * Usage:
 *   node src/seed/admin.seed.js
 */
require('dotenv').config();
const dns = require('dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const env = require('../config/env');
const User = require('../models/User');
const Profile = require('../models/Profile');

const readBootstrapVars = () => {
  const required = [
    ['ADMIN_BOOTSTRAP_EMAIL', env.adminBootstrapEmail],
    ['ADMIN_BOOTSTRAP_PASSWORD', env.adminBootstrapPassword],
    ['ADMIN_BOOTSTRAP_FULL_NAME', env.adminBootstrapFullName],
    ['ADMIN_BOOTSTRAP_PHONE', env.adminBootstrapPhone],
  ];
  const missing = required.filter(([, value]) => !value || value.trim() === '');
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.map(([name]) => name).join(', ')}`
    );
  }
  return {
    email: env.adminBootstrapEmail.trim(),
    password: env.adminBootstrapPassword,
    fullName: env.adminBootstrapFullName.trim(),
    phone: env.adminBootstrapPhone.trim(),
  };
};

(async () => {
  try {
    if (env.nodeEnv === 'production' && !env.adminBootstrapAllowProduction) {
      throw new Error('Refusing to bootstrap an admin in production. Set ADMIN_BOOTSTRAP_ALLOW_PRODUCTION=true to override.');
    }

    const { email, password, fullName, phone } = readBootstrapVars();

    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });
    console.log(`[admin:seed] Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);

    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`[admin:seed] User with email "${email}" already exists. Skipped.`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
    const user = await User.create({ email, passwordHash, role: 'admin' });

    try {
      await Profile.create({
        userId: user._id,
        role: user.role,
        fullName,
        phone,
      });
    } catch (profileErr) {
      // Roll back the User so bootstrap does not leave an orphan.
      await User.findByIdAndDelete(user._id).catch(() => {});
      throw profileErr;
    }

    console.log(`[admin:seed] Created admin user: ${user.email}`);
  } catch (err) {
    console.error(`[admin:seed] Failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit(process.exitCode || 0);
  }
})();