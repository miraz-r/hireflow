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
const EmailChange = require('../src/models/EmailChange');
const emailService = require('../src/services/email.service');
const { createRateLimiter } = require('../src/middleware/rateLimit');

// Distinct DB so this file can run concurrently with other test files.
const TEST_DB_NAME = 'hireflow_test_rate_limit';

let server;
let baseUrl;

// Stub the email service so no real emails are sent during tests.
emailService.sendEmailChangeVerification = async () => {};
emailService.sendEmailChangedNotification = async () => {};

const makeUser = async (email, role = 'jobseeker') => {
  const passwordHash = await bcrypt.hash('password123', 4);
  return User.create({ email, passwordHash, role });
};

const makeProfile = (user, role = user.role) =>
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
  return { status: res.status, body: data, headers: res.headers };
};

const makeResponse = () => ({
  statusCode: 200,
  headers: {},
  data: null,
  set(field, value) {
    this.headers[field.toLowerCase()] = String(value);
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.data = payload;
    return this;
  },
});

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
  await EmailChange.deleteMany({});
});

describe('createRateLimiter middleware (unit)', () => {
  it('allows up to max requests, then rejects with 429 and a Retry-After header', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 3 });

    let nextCalls = 0;
    const next = () => {
      nextCalls += 1;
    };

    const res = makeResponse();
    for (let i = 0; i < 3; i += 1) {
      limiter({ ip: '10.0.0.1' }, res, next);
    }
    assert.equal(nextCalls, 3);
    assert.equal(res.statusCode, 200);

    limiter({ ip: '10.0.0.1' }, res, next);
    assert.equal(nextCalls, 3);
    assert.equal(res.statusCode, 429);
    assert.deepEqual(res.data, {
      error: 'Too many requests, please try again later',
    });
    const retryAfter = Number(res.headers['retry-after']);
    assert.ok(Number.isInteger(retryAfter) && retryAfter >= 1);
  });

  it('opens a new window after windowMs elapses', async () => {
    const limiter = createRateLimiter({ windowMs: 80, max: 1 });

    let nextCalls = 0;
    const next = () => {
      nextCalls += 1;
    };

    limiter({ ip: '10.0.0.2' }, makeResponse(), next);
    assert.equal(nextCalls, 1);

    const res2 = makeResponse();
    limiter({ ip: '10.0.0.2' }, res2, next);
    assert.equal(res2.statusCode, 429);

    // Short wait (<200ms) — never the production 15/60-minute window.
    await new Promise((resolve) => setTimeout(resolve, 150));

    const res3 = makeResponse();
    limiter({ ip: '10.0.0.2' }, res3, next);
    assert.equal(nextCalls, 2);
    assert.equal(res3.statusCode, 200);
  });

  it('tracks identities separately', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 1 });

    let nextCalls = 0;
    const next = () => {
      nextCalls += 1;
    };

    limiter({ ip: '10.0.0.3' }, makeResponse(), next);
    limiter({ ip: '10.0.0.4' }, makeResponse(), next);
    assert.equal(nextCalls, 2);

    limiter({ ip: '10.0.0.3' }, makeResponse(), next);
    assert.equal(nextCalls, 2);
  });
});

describe('GET, DELETE /api/email-change unaffected by rate limiting', () => {
  it('status and cancel still work normally', async () => {
    const user = await makeUser('rl-unchanged@example.com');
    const token = signTokenFor(user);

    const status = await request('GET', '/api/email-change', { token });
    assert.equal(status.status, 200);
    assert.deepEqual(status.body, { pending: false });

    const cancel = await request('DELETE', '/api/email-change', { token });
    assert.equal(cancel.status, 404);
  });
});

describe('POST /api/auth/role unaffected by rate limiting', () => {
  it('role switch still works and the new token authenticates', async () => {
    const user = await makeUser('rl-role@example.com', 'jobseeker');
    await makeProfile(user, 'jobseeker');

    const toggle = await request('POST', '/api/auth/role', {
      token: signTokenFor(user),
      body: { role: 'recruiter' },
    });
    assert.equal(toggle.status, 200);
    assert.equal(toggle.body.user.role, 'recruiter');

    const me = await request('GET', '/api/auth/me', {
      token: toggle.body.token,
    });
    assert.equal(me.status, 200);
    assert.equal(me.body.role, 'recruiter');
  });
});

describe('POST /api/auth/login rate limit (20 / 15 min / IP)', () => {
  it('normal login works before the threshold, then repeated attempts hit 429', async () => {
    await makeUser('rl-login@example.com');

    const good = await request('POST', '/api/auth/login', {
      body: { email: 'rl-login@example.com', password: 'password123' },
    });
    assert.equal(good.status, 200);
    assert.ok(good.body.token);

    let last;
    for (let i = 0; i < 20; i += 1) {
      last = await request('POST', '/api/auth/login', { body: {} });
      if (last.status !== 400 && last.status !== 429) {
        throw new Error(`unexpected login status ${last.status}`);
      }
    }

    assert.equal(last.status, 429);
    assert.deepEqual(last.body, {
      error: 'Too many requests, please try again later',
    });
    const retryAfter = Number(last.headers.get('retry-after'));
    assert.ok(Number.isInteger(retryAfter) && retryAfter >= 1);
  });
});

describe('POST /api/auth/register rate limit (10 / 60 min / IP)', () => {
  it('registration remains functional, then repeated attempts hit 429', async () => {
    const good = await request('POST', '/api/auth/register', {
      body: {
        email: 'rl-register@example.com',
        password: 'password123',
        fullName: 'RL Register',
phone: '+8801712345678',
      },
    });
    assert.equal(good.status, 201);
    assert.equal(good.body.user.role, 'jobseeker');

    let last;
    for (let i = 0; i < 10; i += 1) {
      last = await request('POST', '/api/auth/register', { body: {} });
      if (last.status !== 400 && last.status !== 429) {
        throw new Error(`unexpected register status ${last.status}`);
      }
    }

    assert.equal(last.status, 429);
    assert.deepEqual(last.body, {
      error: 'Too many requests, please try again later',
    });
    assert.ok(last.headers.get('retry-after'));
  });
});

describe('POST /api/email-change rate limit (5 / 60 min / user)', () => {
  it('allows 5 initiations, then returns 429 for the same user', async () => {
    const user = await makeUser('rl-init@example.com');
    const token = signTokenFor(user);

    for (let i = 0; i < 5; i += 1) {
      const res = await request('POST', '/api/email-change', {
        token,
        body: { newEmail: `rl-init-new-${i}@example.com` },
      });
      assert.equal(res.status, 201);
    }

    const blocked = await request('POST', '/api/email-change', {
      token,
      body: { newEmail: 'rl-init-blocked@example.com' },
    });
    assert.equal(blocked.status, 429);
    assert.deepEqual(blocked.body, {
      error: 'Too many requests, please try again later',
    });
  });

  it('a different user has its own budget', async () => {
    const other = await makeUser('rl-init-other@example.com');
    const token = signTokenFor(other);

    const res = await request('POST', '/api/email-change', {
      token,
      body: { newEmail: 'rl-init-other-new@example.com' },
    });
    assert.equal(res.status, 201);
  });
});

describe('POST /api/email-change/resend rate limit (5 / 60 min / user)', () => {
  it('allows 5 resends, then returns 429 for the same user', async () => {
    const user = await makeUser('rl-resend@example.com');
    const token = signTokenFor(user);

    const init = await request('POST', '/api/email-change', {
      token,
      body: { newEmail: 'rl-resend-new@example.com' },
    });
    assert.equal(init.status, 201);

    for (let i = 0; i < 5; i += 1) {
      const res = await request('POST', '/api/email-change/resend', { token });
      assert.equal(res.status, 200);
    }

    const blocked = await request('POST', '/api/email-change/resend', { token });
    assert.equal(blocked.status, 429);
    assert.deepEqual(blocked.body, {
      error: 'Too many requests, please try again later',
    });
    assert.ok(blocked.headers.get('retry-after'));
  });
});

describe('POST /api/email-change/verify-email rate limit (10 / 15 min / user)', () => {
  it('allows 10 verification attempts, then returns 429 for the same user', async () => {
    const user = await makeUser('rl-verify@example.com');
    const token = signTokenFor(user);

    const init = await request('POST', '/api/email-change', {
      token,
      body: { newEmail: 'rl-verify-new@example.com' },
    });
    assert.equal(init.status, 201);

    for (let i = 0; i < 10; i += 1) {
      const res = await request('POST', '/api/email-change/verify-email', {
        token,
        body: { token: `garbage-${i}` },
      });
      assert.equal(res.status, 400);
    }

    const blocked = await request('POST', '/api/email-change/verify-email', {
      token,
      body: { token: 'garbage-blocked' },
    });
    assert.equal(blocked.status, 429);
    assert.deepEqual(blocked.body, {
      error: 'Too many requests, please try again later',
    });
    assert.ok(blocked.headers.get('retry-after'));
  });
});