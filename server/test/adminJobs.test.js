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
const Job = require('../src/models/Job');
const Application = require('../src/models/Application');

// Distinct DB so this file can run concurrently with other test files.
const TEST_DB_NAME = 'hireflow_test_admin_jobs';

let server;
let baseUrl;

const makeUser = async (email, role = 'recruiter') => {
  const passwordHash = await bcrypt.hash('password123', 4);
  return User.create({ email, passwordHash, role });
};

const makeRecruiter = async (email, fullName) => {
  const user = await makeUser(email, 'recruiter');
  await Profile.create({
    userId: user._id,
    role: 'recruiter',
    fullName,
    phone: '+1 555 010 1234',
    jobTitle: 'Talent Acquisition Lead',
  });
  return user;
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

const baseJob = (overrides = {}) => ({
  title: 'Software Engineer',
  company: 'Acme Corp',
  location: 'Remote',
  workType: 'Remote',
  employmentType: 'Full-time',
  experienceLevel: 'Mid-level',
  category: 'Engineering',
  description: 'Build things',
  ...overrides,
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
  await Promise.all([
    User.deleteMany({}),
    Profile.deleteMany({}),
    Job.deleteMany({}),
    Application.deleteMany({}),
  ]);
});

describe('admin jobs: authorization', () => {
  for (const route of ['/api/admin/jobs', '/api/admin/jobs/000000000000000000000000']) {
    it(`requires a token for GET ${route}`, async () => {
      const res = await request('GET', route);
      assert.equal(res.status, 401);
    });
  }

  it('requires a token for PATCH /api/admin/jobs/:id/status', async () => {
    const res = await request('PATCH', '/api/admin/jobs/000000000000000000000000/status', {
      body: { status: 'active' },
    });
    assert.equal(res.status, 401);
  });

  it('rejects non-admin roles', async () => {
    const recruiter = await makeUser('admin-denied@example.com', 'recruiter');
    const token = signTokenFor(recruiter);

    const list = await request('GET', '/api/admin/jobs', { token });
    assert.equal(list.status, 403);

    const detail = await request('GET', '/api/admin/jobs/000000000000000000000000', { token });
    assert.equal(detail.status, 403);

    const patch = await request(
      'PATCH',
      '/api/admin/jobs/000000000000000000000000/status',
      { token, body: { status: 'active' } }
    );
    assert.equal(patch.status, 403);
  });
});

describe('admin jobs: list', () => {
  it('returns a paginated, recruiter-enriched shape', async () => {
    const admin = await makeUser('admin-list@example.com', 'admin');
    const recruiter = await makeRecruiter('owner-list@example.com', 'Jane Doe');
    const job = await Job.create({ ...baseJob(), postedBy: recruiter._id });
    const app = await Application.create({ jobId: job._id, userId: admin._id });

    const res = await request('GET', '/api/admin/jobs', { token: signTokenFor(admin) });

    assert.equal(res.status, 200);
    assert.equal(res.body.page, 1);
    assert.equal(res.body.limit, 10);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.totalPages, 1);
    assert.equal(res.body.jobs.length, 1);

    const item = res.body.jobs[0];
    assert.equal(item.id, String(job._id));
    assert.equal(item.title, job.title);
    assert.equal(item.status, 'active');
    assert.equal(item.applications, 1);
    assert.equal(item.recruiter.name, 'Jane Doe');
    assert.equal(item.recruiter.jobTitle, 'Talent Acquisition Lead');
    assert.equal(item.recruiter.email, 'owner-list@example.com');
    await Application.deleteMany({ _id: app._id });
  });

  it('reports legacy jobs without a status field as active', async () => {
    const admin = await makeUser('admin-legacy@example.com', 'admin');
    const legacy = await Job.create(baseJob({ status: undefined }));
    await Job.updateOne({ _id: legacy._id }, { $unset: { status: 1 } });

    const res = await request('GET', '/api/admin/jobs', { token: signTokenFor(admin) });

    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.jobs[0].status, 'active');
  });

  it('paginates with page/limit and totalPages', async () => {
    const admin = await makeUser('admin-pager@example.com', 'admin');
    const promises = [];
    for (let i = 0; i < 3; i += 1) {
      promises.push(Job.create(baseJob({ title: `Job Number ${i}` })));
    }
    await Promise.all(promises);

    const res = await request('GET', '/api/admin/jobs?limit=2&page=2', {
      token: signTokenFor(admin),
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.total, 3);
    assert.equal(res.body.totalPages, 2);
    assert.equal(res.body.page, 2);
    assert.equal(res.body.jobs.length, 1);
  });

  it('searches across title, company, and recruiter name', async () => {
    const admin = await makeUser('admin-search@example.com', 'admin');
    const recruiter = await makeRecruiter('search-owner@example.com', 'Zelda Vance');
    await Job.create(baseJob({ title: 'Frontend Engineer', company: 'LexCorp' }));
    await Job.create(baseJob({ title: 'Backend Engineer', company: 'Acme Corp' }));
    await Job.create(baseJob({ title: 'DevOps', company: 'Other Inc', postedBy: recruiter._id }));

    const byTitle = await request('GET', `/api/admin/jobs?q=${encodeURIComponent('Frontend Engineer')}`, { token: signTokenFor(admin) });
    assert.equal(byTitle.body.total, 1);
    assert.equal(byTitle.body.jobs[0].company, 'LexCorp');

    const byCompany = await request('GET', `/api/admin/jobs?q=${encodeURIComponent('LexCorp')}`, { token: signTokenFor(admin) });
    assert.equal(byCompany.body.total, 1);

    const byRecruiter = await request('GET', `/api/admin/jobs?q=${encodeURIComponent('Zelda')}`, { token: signTokenFor(admin) });
    assert.equal(byRecruiter.body.total, 1);
    assert.equal(byRecruiter.body.jobs[0].title, 'DevOps');
  });

  it('filters by status without leaking legacy actives', async () => {
    const admin = await makeUser('admin-status@example.com', 'admin');
    const legacy = await Job.create(baseJob({ status: undefined }));
    await Job.updateOne({ _id: legacy._id }, { $unset: { status: 1 } });
    await Job.create(baseJob({ title: 'Pending Role', status: 'pending' }));
    await Job.create(baseJob({ title: 'Closed Role', status: 'closed' }));
    await Job.create(baseJob({ title: 'Draft Role', status: 'draft' }));
    await Job.create(baseJob({ title: 'Explicit Active', status: 'active' }));

    const all = await request('GET', '/api/admin/jobs', { token: signTokenFor(admin) });
    assert.equal(all.body.total, 5);

    const pending = await request('GET', '/api/admin/jobs?status=pending', { token: signTokenFor(admin) });
    assert.equal(pending.body.total, 1);
    assert.equal(pending.body.jobs[0].title, 'Pending Role');

    const draft = await request('GET', '/api/admin/jobs?status=draft', { token: signTokenFor(admin) });
    assert.equal(draft.body.total, 1);

    const active = await request('GET', '/api/admin/jobs?status=active', { token: signTokenFor(admin) });
    assert.equal(active.body.total, 2); // the legacy no-status job + the explicit active
  });

  it('filters by employmentType', async () => {
    const admin = await makeUser('admin-emp@example.com', 'admin');
    await Job.create(baseJob());
    await Job.create(baseJob({ title: 'Intern Gig', employmentType: 'Internship' }));

    const res = await request('GET', '/api/admin/jobs?employmentType=Internship', {
      token: signTokenFor(admin),
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.jobs[0].employmentType, 'Internship');
  });

  it('filters by posted window using createdAt', async () => {
    const admin = await makeUser('admin-days@example.com', 'admin');
    const old = await Job.create(baseJob({ title: 'Old Role' }));
    // Backdate via the native collection: mongoose timestamps on update would
    // otherwise keep createdAt pinned to the write time.
    await Job.collection.updateOne(
      { _id: old._id },
      { $set: { createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) } }
    );
    await Job.create(baseJob({ title: 'Fresh Role' }));

    const last7 = await request('GET', '/api/admin/jobs?postedDays=7', { token: signTokenFor(admin) });
    assert.equal(last7.body.total, 1);
    assert.equal(last7.body.jobs[0].title, 'Fresh Role');

    const last30 = await request('GET', '/api/admin/jobs?postedDays=30', { token: signTokenFor(admin) });
    assert.equal(last30.body.total, 1);

    const last90 = await request('GET', '/api/admin/jobs?postedDays=90', { token: signTokenFor(admin) });
    assert.equal(last90.body.total, 2);
  });
});

describe('admin jobs: detail', () => {
  it('returns the enriched job', async () => {
    const admin = await makeUser('admin-detail@example.com', 'admin');
    const recruiter = await makeRecruiter('detail-owner@example.com', 'Priya Sharma');
    const job = await Job.create({
      ...baseJob({ title: 'Frontend Engineer', status: 'pending' }),
      postedBy: recruiter._id,
    });
    await Application.create({ jobId: job._id, userId: admin._id });

    const res = await request('GET', `/api/admin/jobs/${job._id}`, {
      token: signTokenFor(admin),
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.job.title, 'Frontend Engineer');
    assert.equal(res.body.job.status, 'pending');
    assert.equal(res.body.job.applications, 1);
    assert.equal(res.body.job.recruiter.name, 'Priya Sharma');
  });

  it('404s for missing and 400s for malformed ids', async () => {
    const admin = await makeUser('admin-detail-miss@example.com', 'admin');
    const token = signTokenFor(admin);

    const missing = await request('GET', `/api/admin/jobs/${new mongoose.Types.ObjectId()}`, { token });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error, 'Job not found');

    const malformed = await request('GET', '/api/admin/jobs/not-an-id', { token });
    assert.equal(malformed.status, 400);
  });
});

describe('admin jobs: moderation', () => {
  it('approves a pending job into active', async () => {
    const admin = await makeUser('admin-mod@example.com', 'admin');
    const job = await Job.create(baseJob({ title: 'Pending Role', status: 'pending' }));

    const res = await request('PATCH', `/api/admin/jobs/${job._id}/status`, {
      token: signTokenFor(admin),
      body: { status: 'active' },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.job.status, 'active');
    assert.equal(res.body.job.closedAt, null);
  });

  it('closes a job (sets closedAt) and reopens it (clears closedAt)', async () => {
    const admin = await makeUser('admin-mod2@example.com', 'admin');
    const job = await Job.create(baseJob({ title: 'Closing Role' }));

    const closed = await request('PATCH', `/api/admin/jobs/${job._id}/status`, {
      token: signTokenFor(admin),
      body: { status: 'closed' },
    });
    assert.equal(closed.status, 200);
    assert.equal(closed.body.job.status, 'closed');
    assert.ok(closed.body.job.closedAt);

    const reopened = await request('PATCH', `/api/admin/jobs/${job._id}/status`, {
      token: signTokenFor(admin),
      body: { status: 'active' },
    });
    assert.equal(reopened.status, 200);
    assert.equal(reopened.body.job.status, 'active');
    assert.equal(reopened.body.job.closedAt, null);
  });

  it('rejects an invalid status', async () => {
    const admin = await makeUser('admin-mod3@example.com', 'admin');
    const job = await Job.create(baseJob());

    const res = await request('PATCH', `/api/admin/jobs/${job._id}/status`, {
      token: signTokenFor(admin),
      body: { status: 'exploded' },
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Invalid job status');
  });

  it('404s missing jobs and 400s malformed ids on status update', async () => {
    const admin = await makeUser('admin-mod4@example.com', 'admin');
    const token = signTokenFor(admin);

    const missing = await request(
      'PATCH',
      `/api/admin/jobs/${new mongoose.Types.ObjectId()}/status`,
      { token, body: { status: 'active' } }
    );
    assert.equal(missing.status, 404);

    const malformed = await request('PATCH', '/api/admin/jobs/not-an-id/status', {
      token,
      body: { status: 'active' },
    });
    assert.equal(malformed.status, 400);
  });
});

describe('public job list excludes non-live jobs', () => {
  it('only exposes active and legacy jobs to the public catalogue', async () => {
    await Job.create(baseJob({ title: 'Visible Active' }));
    const legacy = await Job.create(baseJob({ title: 'Visible Legacy' }));
    await Job.updateOne({ _id: legacy._id }, { $unset: { status: 1 } });
    await Job.create(baseJob({ title: 'Hidden Pending', status: 'pending' }));
    await Job.create(baseJob({ title: 'Hidden Draft', status: 'draft' }));
    await Job.create(baseJob({ title: 'Hidden Closed', status: 'closed' }));

    const res = await request('GET', '/api/jobs');

    assert.equal(res.status, 200);
    const titles = res.body.jobs.map((job) => job.title);
    assert.ok(titles.includes('Visible Active'));
    assert.ok(titles.includes('Visible Legacy'));
    assert.ok(!titles.includes('Hidden Pending'));
    assert.ok(!titles.includes('Hidden Draft'));
    assert.ok(!titles.includes('Hidden Closed'));
  });

  it('also hides non-live jobs from the public single-job endpoint', async () => {
    const active = await Job.create(baseJob({ title: 'Visible Single' }));
    const pending = await Job.create(baseJob({ title: 'Hidden Single', status: 'pending' }));

    const ok = await request('GET', `/api/jobs/${active._id}`);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.title, 'Visible Single');

    const hidden = await request('GET', `/api/jobs/${pending._id}`);
    assert.equal(hidden.status, 404);
  });
});