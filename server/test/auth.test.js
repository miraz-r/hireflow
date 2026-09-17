const { before, after, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const dns = require('node:dns');

// Node's DNS settings are overridden in config/db.js for Atlas SRV discovery;
// mirror that here so this harness works before config/db is required.
dns.setServers(['1.1.1.1', '1.0.0.1']);

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const env = require('../src/config/env');
const app = require('../src/app');
const User = require('../src/models/User');
const Profile = require('../src/models/Profile');

// Distinct DB so this file can run concurrently with other test files.
const TEST_DB_NAME = 'hireflow_test_auth';

let server;
let baseUrl;

const makeUser = async (email, role = 'jobseeker') => {
  const passwordHash = await bcrypt.hash('password123', 4);
  return User.create({ email, passwordHash, role });
};

const makeProfile = (user, role) =>
  Profile.create({
    userId: user._id,
    role,
    fullName: 'Test User',
    phone: '+1-555-0100',
    location: 'Remote',
  });

const signTokenFor = (user) =>
  jwt.sign({ id: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: '1h',
  });

const request = async (method, route, { token, body } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON body
  }
  return { status: res.status, body: data, raw: text };
};

before(async () => {
  await mongoose.connect(process.env.TEST_MONGODB_URI || env.mongoUri, {
    dbName: TEST_DB_NAME,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  await mongoose.connection.dropDatabase();

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.disconnect().catch(() => {});
  if (server) await new Promise((resolve) => server.close(resolve));
});

beforeEach(async () => {
  await User.deleteMany({});
  await Profile.deleteMany({});
});

describe('POST /api/auth/role (toggleRole)', () => {
  it('toggles jobseeker -> recruiter and issues a token with the new role', async () => {
    const user = await makeUser('toggle-js@example.com', 'jobseeker');
    await makeProfile(user, 'jobseeker');

    const res = await request('POST', '/api/auth/role', {
      token: signTokenFor(user),
      body: { role: 'recruiter' },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'recruiter');

    const decoded = jwt.verify(res.body.token, env.jwtSecret);
    assert.equal(decoded.role, 'recruiter');
    assert.equal(decoded.id, res.body.user.id);

    const reloadedUser = await User.findById(user._id);
    assert.equal(reloadedUser.role, 'recruiter');
    const reloadedProfile = await Profile.findOne({ userId: user._id });
    assert.equal(reloadedProfile.role, 'recruiter');
  });

  it('toggles recruiter -> jobseeker and clears recruiter-only profile fields', async () => {
    const user = await makeUser('toggle-rec@example.com', 'recruiter');
    await makeProfile(user, 'recruiter');
    await Profile.updateOne(
      { userId: user._id },
      { $set: { companyName: 'Acme Corp', jobTitle: 'CTO' } }
    );

    const res = await request('POST', '/api/auth/role', {
      token: signTokenFor(user),
      body: { role: 'jobseeker' },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'jobseeker');

    const decoded = jwt.verify(res.body.token, env.jwtSecret);
    assert.equal(decoded.role, 'jobseeker');

    const reloadedProfile = await Profile.findOne({ userId: user._id }).lean();
    assert.equal(reloadedProfile.role, 'jobseeker');
    // Lean (no schema default rehydration) proves the recruiter-only fields
    // were genuinely $unset from the stored document.
    assert.equal('companyName' in reloadedProfile, false);
    assert.equal('jobTitle' in reloadedProfile, false);
  });

  it('persists role on the User and Profile WITHOUT the async profile update', async () => {
    // Regression guard for the fire-and-forget Profile.updateOne bug: the
    // User and Profile must BOTH reflect the new role before the response.
    const user = await makeUser('toggle-sync@example.com', 'jobseeker');
    await makeProfile(user, 'jobseeker');

    const res = await request('POST', '/api/auth/role', {
      token: signTokenFor(user),
      body: { role: 'recruiter' },
    });
    assert.equal(res.status, 200);

    const userAfter = await User.findById(user._id);
    const profileAfter = await Profile.findOne({ userId: user._id });
    assert.equal(userAfter.role, 'recruiter');
    assert.equal(profileAfter.role, 'recruiter');
  });

  it('requires authentication', async () => {
    const res = await request('POST', '/api/auth/role', {
      body: { role: 'recruiter' },
    });
    assert.equal(res.status, 401);
  });

  it('rejects an invalid role value', async () => {
    const user = await makeUser('toggle-bad-role@example.com', 'jobseeker');
    const res = await request('POST', '/api/auth/role', {
      token: signTokenFor(user),
      body: { role: 'admin' },
    });
    assert.equal(res.status, 400);
  });

  it('rejects a deleted user as unauthenticated', async () => {
    // The DB-backed authenticate middleware now blocks deleted users at the
    // auth boundary, so a stale token never reaches toggleRole.
    const ghost = await makeUser('toggle-ghost@example.com', 'jobseeker');
    await User.findByIdAndDelete(ghost._id);
    const res = await request('POST', '/api/auth/role', {
      token: signTokenFor(ghost),
      body: { role: 'recruiter' },
    });
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Authentication required' });
  });
});

describe('toggleRole failure handling', () => {
  it('does not send a success response when the Profile update fails', async () => {
    const user = await makeUser('toggle-fail@example.com', 'jobseeker');
    await makeProfile(user, 'jobseeker');
    const token = signTokenFor(user);

    const originalUpdateOne = Profile.updateOne;
    Profile.updateOne = () => Promise.reject(new Error('simulated profile failure'));

    const logs = [];
    const originalError = console.error;
    const originalLog = console.log;
    console.error = (...args) => logs.push(args.join(' '));
    console.log = (...args) => logs.push(args.join(' '));

    try {
      const res = await request('POST', '/api/auth/role', {
        token,
        body: { role: 'recruiter' },
      });

      assert.equal(res.status, 500);
      assert.equal(res.body.error, 'Internal Server Error');
      assert.equal(res.body.token, undefined);
      assert.equal(res.body.user, undefined);

      // The failure must not have produced a second write after a response.
      assert.ok(
        !logs.join('\n').match(/ERR_HTTP_HEADERS_SENT|headers already sent|Cannot set headers/i),
        'double-response error was logged: ' + logs.join('\n')
      );

      // No silent drift: the User was rolled back to its original role.
      const reloadedUser = await User.findById(user._id);
      assert.equal(reloadedUser.role, 'jobseeker');
      const reloadedProfile = await Profile.findOne({ userId: user._id });
      assert.equal(reloadedProfile.role, 'jobseeker');
    } finally {
      Profile.updateOne = originalUpdateOne;
      console.error = originalError;
      console.log = originalLog;
    }
  });

  it('leaves User and Profile roles consistent after a failed toggle', async () => {
    const user = await makeUser('toggle-drift@example.com', 'recruiter');
    await makeProfile(user, 'recruiter');

    const originalUpdateOne = Profile.updateOne;
    Profile.updateOne = () => Promise.reject(new Error('simulated profile failure'));

    try {
      const res = await request('POST', '/api/auth/role', {
        token: signTokenFor(user),
        body: { role: 'jobseeker' },
      });
      assert.equal(res.status, 500);

      const [reloadedUser, reloadedProfile] = await Promise.all([
        User.findById(user._id),
        Profile.findOne({ userId: user._id }),
      ]);
      // Both must agree on the original role — the failed toggle changed
      // neither persistently.
      assert.equal(reloadedUser.role, 'recruiter');
      assert.equal(reloadedProfile.role, 'recruiter');
      assert.equal(reloadedUser.role, reloadedProfile.role);
    } finally {
      Profile.updateOne = originalUpdateOne;
    }
  });
});