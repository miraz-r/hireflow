const { before, after, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const dns = require('node:dns');

dns.setServers(['1.1.1.1', '1.0.0.1']);

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const env = require('../src/config/env');
const app = require('../src/app');
const User = require('../src/models/User');
const Profile = require('../src/models/Profile');
const Job = require('../src/models/Job');
const Application = require('../src/models/Application');

const TEST_DB_NAME = 'hireflow_test_admin_search';

let server;
let baseUrl;

const makeUser = async (email, role = 'jobseeker') => {
  const passwordHash = await bcrypt.hash('password123', 4);
  return User.create({ email, passwordHash, role });
};

const signTokenFor = (user) =>
  jwt.sign({ id: user.id, role: user.role }, env.jwtSecret, { expiresIn: '1h' });

const get = async (route, { token } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${route}`, { headers });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* ignore */ }
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
      baseUrl = `http://127.0.0.1:${server.address().port}`;
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
  await Promise.all([
    User.deleteMany({}),
    Profile.deleteMany({}),
    Job.deleteMany({}),
    Application.deleteMany({}),
  ]);
});

const seed = async () => {
  const admin = await makeUser('admin@example.com', 'admin');
  const recruiter = await makeUser('priya@example.com', 'recruiter');
  const jobseeker = await makeUser('alice@example.com', 'jobseeker');

  await Profile.create({ userId: recruiter._id, role: 'recruiter', fullName: 'Priya Sharma', phone: '+15550100', location: 'NYC', companyName: 'Aperture Science', jobTitle: 'Recruiter' });
  await Profile.create({ userId: jobseeker._id, role: 'jobseeker', fullName: 'Alice Walker', phone: '+15550101', location: 'NYC' });

  const job = await Job.create({
    title: 'Data Analyst',
    company: 'Aperture Science',
    location: 'Remote',
    workType: 'Remote',
    employmentType: 'Full-time',
    experienceLevel: 'Mid-level',
    category: 'Data',
    description: 'Analyze things',
    postedBy: recruiter._id,
  });

  await Application.create({
    jobId: job._id,
    userId: jobseeker._id,
    fullName: 'Alice Walker',
    email: 'alice@example.com',
  });

  return { admin, recruiter, jobseeker, job };
};

describe('GET /api/admin/search', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await get('/api/admin/search?q=aperture');
    assert.equal(res.status, 401);
  });

  it('rejects non-admin roles', async () => {
    const recruiter = await makeUser('rec@example.com', 'recruiter');
    const res = await get('/api/admin/search?q=aperture', { token: signTokenFor(recruiter) });
    assert.equal(res.status, 403);
  });

  it('returns matching entities grouped by type, without sensitive fields', async () => {
    const { admin } = await seed();
    const res = await get('/api/admin/search?q=alice', { token: signTokenFor(admin) });
    assert.equal(res.status, 200);
    assert.equal(res.body.jobseekers.length, 1);
    assert.equal(res.body.jobseekers[0].label, 'Alice Walker');
    assert.equal(res.body.applications.length, 1);
    assert.equal(res.body.applications[0].label, 'Alice Walker');
    assert.ok(!res.raw.includes('passwordHash'));

    const res2 = await get('/api/admin/search?q=aperture', { token: signTokenFor(admin) });
    assert.equal(res2.status, 200);
    assert.equal(res2.body.jobs.length, 1);
    assert.equal(res2.body.jobs[0].label, 'Data Analyst');
    assert.equal(res2.body.companies.length, 1);
    assert.equal(res2.body.companies[0].label, 'Aperture Science');

    const res3 = await get('/api/admin/search?q=priya', { token: signTokenFor(admin) });
    assert.equal(res3.body.recruiters.length, 1);
    assert.equal(res3.body.recruiters[0].label, 'Priya Sharma');

    const res4 = await get('/api/admin/search?q=alice', { token: signTokenFor(admin) });
    const app = res4.body.applications.find((a) => a.label === 'Alice Walker');
    assert.ok(app, 'application matching applicant name should appear');
    assert.equal(app.sublabel, 'for Data Analyst');
  });

  it('returns empty groups for a query with no matches', async () => {
    const { admin } = await seed();
    const res = await get('/api/admin/search?q=zzzznotfound', { token: signTokenFor(admin) });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.jobseekers, []);
    assert.deepEqual(res.body.jobs, []);
  });

  it('treats an empty or whitespace query as a safe no-op', async () => {
    const { admin } = await seed();
    const res = await get('/api/admin/search?q=%20%20', { token: signTokenFor(admin) });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.jobs, []);
  });

  it('validates minimum query length', async () => {
    const { admin } = await seed();
    const res = await get('/api/admin/search?q=x', { token: signTokenFor(admin) });
    assert.equal(res.status, 400);
    assert.ok(/at least 2 characters/.test(res.body.error));
  });

  it('rejects over-long queries', async () => {
    const { admin } = await seed();
    const res = await get(`/api/admin/search?q=${'a'.repeat(81)}`, { token: signTokenFor(admin) });
    assert.equal(res.status, 400);
  });

  it('is case-insensitive', async () => {
    const { admin } = await seed();
    const res = await get('/api/admin/search?q=ALICE', { token: signTokenFor(admin) });
    assert.equal(res.status, 200);
    assert.equal(res.body.jobseekers.length, 1);
  });

  it('treats regex metacharacters literally', async () => {
    const { admin } = await seed();
    const res = await get('/api/admin/search?q=%28%5E%7C%29', { token: signTokenFor(admin) });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.jobs, []);
  });

  it('caps each entity group at the per-type limit', async () => {
    const { admin, recruiter } = await seed();
    await Promise.all(
      Array.from({ length: 7 }, (_, i) =>
        Job.create({
          title: `Aperture Opening ${i}`,
          company: 'Aperture Science',
          location: 'Remote',
          workType: 'Remote',
          employmentType: 'Full-time',
          experienceLevel: 'Mid-level',
          category: 'Engineering',
          description: 'x',
          postedBy: recruiter._id,
        })
      )
    );
    const res = await get('/api/admin/search?q=aperture', { token: signTokenFor(admin) });
    assert.equal(res.status, 200);
    assert.equal(res.body.jobs.length, 5);
  });
});
