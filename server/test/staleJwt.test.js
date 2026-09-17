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
const TEST_DB_NAME = 'hireflow_test_stale_jwt';

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

describe('database-backed authenticate middleware', () => {
  it('A: lets a valid token through for an existing user with a matching role', async () => {
    const user = await makeUser('valid-token@example.com', 'jobseeker');

    const res = await request('GET', '/api/auth/me', {
      token: signTokenFor(user),
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.id, user.id);
    assert.equal(res.body.role, 'jobseeker');
  });

  it('A2: a recruiter token works on a recruiter-protected route', async () => {
    const user = await makeUser('valid-recruiter@example.com', 'recruiter');

    const res = await request('GET', '/api/applications/mine', {
      token: signTokenFor(user),
    });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { applications: [] });
  });

  it('B: rejects a token whose user has been deleted', async () => {
    const user = await makeUser('deleted-user@example.com', 'jobseeker');
    const token = signTokenFor(user);

    await User.findByIdAndDelete(user._id);

    const res = await request('GET', '/api/auth/me', { token });

    assert.equal(res.status, 401);
    // Identical to any other auth failure — does not reveal the user existed.
    assert.deepEqual(res.body, { error: 'Authentication required' });
  });

  it('C: rejects a jobseeker token after the persisted role becomes recruiter', async () => {
    const user = await makeUser('stale-to-recruiter@example.com', 'jobseeker');
    const token = signTokenFor(user);

    await User.updateOne({ _id: user._id }, { $set: { role: 'recruiter' } });

    const res = await request('GET', '/api/auth/me', { token });

    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Authentication required' });
  });

  it('D: rejects a recruiter token after the persisted role becomes jobseeker', async () => {
    const user = await makeUser('stale-to-jobseeker@example.com', 'recruiter');
    const token = signTokenFor(user);

    await User.updateOne({ _id: user._id }, { $set: { role: 'jobseeker' } });

    // Recruiter-protected endpoint: the stale token must be rejected at the
    // authenticate layer, never reaching authorize.
    const res = await request('GET', '/api/applications/mine', { token });

    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Authentication required' });
  });

  it('E: toggleRole still issues a working token and invalidates the old role token', async () => {
    const user = await makeUser('toggle-compat@example.com', 'jobseeker');
    await makeProfile(user, 'jobseeker');

    const originalToken = signTokenFor(user);

    const toggle = await request('POST', '/api/auth/role', {
      token: originalToken,
      body: { role: 'recruiter' },
    });
    assert.equal(toggle.status, 200);
    assert.equal(toggle.body.user.role, 'recruiter');

    // The freshly issued token reflects the new role and is accepted.
    const me = await request('GET', '/api/auth/me', {
      token: toggle.body.token,
    });
    assert.equal(me.status, 200);
    assert.equal(me.body.role, 'recruiter');

    const mine = await request('GET', '/api/applications/mine', {
      token: toggle.body.token,
    });
    assert.equal(mine.status, 200);

    // The pre-switch jobseeker token is now a stale-role token and is rejected.
    const stale = await request('GET', '/api/auth/me', {
      token: originalToken,
    });
    assert.equal(stale.status, 401);
  });

  it('rejects a request with no token', async () => {
    const res = await request('GET', '/api/auth/me');
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Authentication required' });
  });

  it('rejects a malformed token', async () => {
    const res = await request('GET', '/api/auth/me', { token: 'not-a-jwt' });
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Authentication required' });
  });

  it('rejects a token signed with the wrong secret', async () => {
    const user = await makeUser('wrong-secret@example.com');
    const token = jwt.sign({ id: user.id, role: user.role }, 'not-the-secret');

    const res = await request('GET', '/api/auth/me', { token });

    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Authentication required' });
  });

  it('rejects an expired token', async () => {
    const user = await makeUser('expired-token@example.com');
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      env.jwtSecret
    );

    const res = await request('GET', '/api/auth/me', { token });

    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Authentication required' });
  });
});