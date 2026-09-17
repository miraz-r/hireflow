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
const Job = require('../src/models/Job');

// Distinct DB so this file can run concurrently with other test files.
const TEST_DB_NAME = 'hireflow_test_jobs';

let server;
let baseUrl;

const makeUser = async (email, role = 'recruiter') => {
  const passwordHash = await bcrypt.hash('password123', 4);
  return User.create({ email, passwordHash, role });
};

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

const validJob = {
  title: 'Software Engineer',
  company: 'Acme Corp',
  location: 'Remote',
  workType: 'Remote',
  employmentType: 'Full-time',
  experienceLevel: 'Mid-level',
  category: 'Engineering',
  description: 'Build things',
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
  await Job.deleteMany({});
});

describe('recruiter publishes a job', () => {
  it('creates a job owned by the authenticated recruiter', async () => {
    const recruiter = await makeUser('owner-create@example.com');
    const res = await request('POST', '/api/jobs', {
      token: signTokenFor(recruiter),
      body: validJob,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.title, validJob.title);
    assert.equal(String(res.body.postedBy), String(recruiter._id));
  });

  it('requires recruiter role to create', async () => {
    const jobseeker = await makeUser('no-create-js@example.com', 'jobseeker');
    const res = await request('POST', '/api/jobs', {
      token: signTokenFor(jobseeker),
      body: validJob,
    });

    assert.equal(res.status, 403);
  });
});

describe('IDOR guard: update own job only', () => {
  it('owner can update their own job', async () => {
    const owner = await makeUser('owner-update@example.com');
    const created = await request('POST', '/api/jobs', {
      token: signTokenFor(owner),
      body: validJob,
    });
    const id = created.body._id;

    const res = await request('PUT', `/api/jobs/${id}`, {
      token: signTokenFor(owner),
      body: { title: 'Senior Software Engineer' },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.title, 'Senior Software Engineer');
    assert.equal(String(res.body.postedBy), String(owner._id));

    const reloaded = await Job.findById(id);
    assert.equal(reloaded.title, 'Senior Software Engineer');
  });

  it('non-owner recruiter cannot update another recruiter job', async () => {
    const owner = await makeUser('owner-victim-update@example.com');
    const attacker = await makeUser('attacker-update@example.com');
    const created = await request('POST', '/api/jobs', {
      token: signTokenFor(owner),
      body: validJob,
    });
    const id = created.body._id;

    const res = await request('PUT', `/api/jobs/${id}`, {
      token: signTokenFor(attacker),
      body: { title: 'Hijacked Title' },
    });

    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Job not found');

    // The target job must remain untouched.
    const reloaded = await Job.findById(id);
    assert.ok(reloaded);
    assert.equal(reloaded.title, validJob.title);
    assert.equal(String(reloaded.postedBy), String(owner._id));
  });

  it('non-owner cannot update a seeded job not owned by them', async () => {
    const owner = await makeUser('seed-owner@example.com');
    const attacker = await makeUser('seed-attacker@example.com');
    // Simulate a seeded job whose postedBy resolves to the legitimate owner.
    const seeded = await Job.create({ ...validJob, postedBy: owner._id });

    const res = await request('PUT', `/api/jobs/${seeded._id}`, {
      token: signTokenFor(attacker),
      body: { title: 'Hijacked Seeded' },
    });

    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Job not found');

    const reloaded = await Job.findById(seeded._id);
    assert.ok(reloaded);
    assert.equal(reloaded.title, validJob.title);
    assert.equal(String(reloaded.postedBy), String(owner._id));
  });

  it('legitimate owner can update a seeded job posted by them', async () => {
    const owner = await makeUser('seed-owner-legit@example.com');
    const seeded = await Job.create({ ...validJob, postedBy: owner._id });

    const res = await request('PUT', `/api/jobs/${seeded._id}`, {
      token: signTokenFor(owner),
      body: { title: 'Legit Updated Seeded' },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.title, 'Legit Updated Seeded');
    assert.equal(String(res.body.postedBy), String(owner._id));
  });

  it('non-owner update of a missing job returns the same 404', async () => {
    const recruiter = await makeUser('missing-update@example.com');
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request('PUT', `/api/jobs/${fakeId}`, {
      token: signTokenFor(recruiter),
      body: { title: 'Nope' },
    });

    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Job not found');
  });
});

describe('IDOR guard: delete own job only', () => {
  it('owner can delete their own job', async () => {
    const owner = await makeUser('owner-delete@example.com');
    const created = await request('POST', '/api/jobs', {
      token: signTokenFor(owner),
      body: validJob,
    });
    const id = created.body._id;

    const res = await request('DELETE', `/api/jobs/${id}`, {
      token: signTokenFor(owner),
    });

    assert.equal(res.status, 204);
    assert.equal(await Job.findById(id), null);
  });

  it('non-owner recruiter cannot delete another recruiter job', async () => {
    const owner = await makeUser('owner-victim-delete@example.com');
    const attacker = await makeUser('attacker-delete@example.com');
    const created = await request('POST', '/api/jobs', {
      token: signTokenFor(owner),
      body: validJob,
    });
    const id = created.body._id;

    const res = await request('DELETE', `/api/jobs/${id}`, {
      token: signTokenFor(attacker),
    });

    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Job not found');

    // The target job must survive the attempt.
    const reloaded = await Job.findById(id);
    assert.ok(reloaded);
    assert.equal(reloaded.title, validJob.title);
    assert.equal(String(reloaded.postedBy), String(owner._id));
  });

  it('non-owner cannot delete a seeded job not owned by them', async () => {
    const owner = await makeUser('seed-delete-owner@example.com');
    const attacker = await makeUser('seed-delete-attacker@example.com');
    const seeded = await Job.create({ ...validJob, postedBy: owner._id });

    const res = await request('DELETE', `/api/jobs/${seeded._id}`, {
      token: signTokenFor(attacker),
    });

    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Job not found');

    const reloaded = await Job.findById(seeded._id);
    assert.ok(reloaded);
    assert.equal(reloaded.title, validJob.title);
    assert.equal(String(reloaded.postedBy), String(owner._id));
  });

  it('legitimate owner can delete a seeded job posted by them', async () => {
    const owner = await makeUser('seed-delete-legit@example.com');
    const seeded = await Job.create({ ...validJob, postedBy: owner._id });

    const res = await request('DELETE', `/api/jobs/${seeded._id}`, {
      token: signTokenFor(owner),
    });

    assert.equal(res.status, 204);
    assert.equal(await Job.findById(seeded._id), null);
  });
});