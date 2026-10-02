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
const SavedJob = require('../src/models/SavedJob');

// Distinct DB so this file can run concurrently with other test files.
const TEST_DB_NAME = 'hireflow_test_admin_jobseekers';

let server;
let baseUrl;

const makeUser = async (email, role = 'jobseeker') => {
  const passwordHash = await bcrypt.hash('password123', 4);
  return User.create({ email, passwordHash, role });
};

const makeJobseeker = async (email, fullName, extra = {}) => {
  const user = await makeUser(email, 'jobseeker');
  await Profile.create({
    userId: user._id,
    role: 'jobseeker',
    fullName,
    phone: '+1-555-0100',
    ...extra,
  });
  return user;
};

const makeRecruiter = async (email, fullName) => {
  const user = await makeUser(email, 'recruiter');
  await Profile.create({
    userId: user._id,
    role: 'recruiter',
    fullName,
    phone: '+1-555-0100',
  });
  return user;
};

const signTokenFor = (user) =>
  jwt.sign({ id: user.id, role: user.role }, env.jwtSecret, { expiresIn: '1h' });

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
  status: 'active',
  ...overrides,
});

const MISSING_ID = new mongoose.Types.ObjectId();

const backdate = async (model, id, daysAgo) => {
  const _id = id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id);
  const result = await model.collection.updateOne(
    { _id },
    { $set: { createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000) } }
  );
  assert.equal(result.matchedCount, 1, `backdate should have matched 1 document for ${id}`);
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
  await Promise.all([
    User.deleteMany({}),
    Profile.deleteMany({}),
    Job.deleteMany({}),
    Application.deleteMany({}),
    SavedJob.deleteMany({}),
  ]);
});

// Apply through the real POST endpoint so the stored document matches production.
const applyAsJobseeker = async (token, jobId, body = {}) => {
  const res = await request('POST', '/api/applications', {
    token,
    body: { jobId, phone: '+1-555-0199', resumeUrl: '/uploads/resumes/cv.pdf', ...body },
  });
  assert.equal(res.status, 201, res.raw);
  return res.body;
};

// ---------------------------------------------------------------------------
describe('admin jobseekers list: authorization', () => {
  it('requires a token', async () => {
    const res = await request('GET', '/api/admin/jobseekers');
    assert.equal(res.status, 401);
  });

  it('rejects non-admin roles', async () => {
    const jobseeker = await makeJobseeker('js-denied@example.com', 'Denied');
    const recruiter = await makeRecruiter('rec-denied@example.com', 'Denied Rec');

    const asJobseeker = await request('GET', '/api/admin/jobseekers', {
      token: signTokenFor(jobseeker),
    });
    assert.equal(asJobseeker.status, 403);

    const asRecruiter = await request('GET', '/api/admin/jobseekers', {
      token: signTokenFor(recruiter),
    });
    assert.equal(asRecruiter.status, 403);
  });

  it('rejects a malformed ?page', async () => {
    const admin = await makeUser('admin-badpage@example.com', 'admin');
    const res = await request('GET', '/api/admin/jobseekers?page=abc', {
      token: signTokenFor(admin),
    });
    assert.equal(res.status, 400);
  });

  it('rejects an out-of-range ?limit', async () => {
    const admin = await makeUser('admin-badlimit@example.com', 'admin');
    const res = await request('GET', '/api/admin/jobseekers?limit=500', {
      token: signTokenFor(admin),
    });
    assert.equal(res.status, 400);
  });

  it('rejects a malformed ?dateRange', async () => {
    const admin = await makeUser('admin-badrange@example.com', 'admin');
    const res = await request('GET', '/api/admin/jobseekers?dateRange=abc', {
      token: signTokenFor(admin),
    });
    assert.equal(res.status, 400);
  });
});

// ---------------------------------------------------------------------------
describe('admin jobseekers list: sourcing', () => {
  it('lists only accounts holding a jobseeker profile', async () => {
    const admin = await makeUser('admin-source@example.com', 'admin');
    await makeJobseeker('listed@example.com', 'Listed Seeker', { location: 'Remote' });
    await makeRecruiter('notlisted@example.com', 'Not A Jobseeker');

    const res = await request('GET', '/api/admin/jobseekers', {
      token: signTokenFor(admin),
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.jobseekers[0].name, 'Listed Seeker');
    assert.equal(res.body.jobseekers[0].email, 'listed@example.com');
    assert.equal(res.body.jobseekers[0].location, 'Remote');
  });

  it('exposes no status field, because User has none', async () => {
    const admin = await makeUser('admin-nostatus@example.com', 'admin');
    await makeJobseeker('nostatus@example.com', 'No Status');

    const res = await request('GET', '/api/admin/jobseekers', {
      token: signTokenFor(admin),
    });

    assert.equal(res.status, 200);
    assert.equal('status' in res.body.jobseekers[0], false);
    assert.equal(JSON.stringify(res.body).includes('suspended'), false);
  });

  it('includes a jobseeker whose account is currently active in the recruiter workspace', async () => {
    const admin = await makeUser('admin-dual@example.com', 'admin');
    const person = await makeJobseeker('dual@example.com', 'Dual Person', {
      location: 'Remote',
      headline: 'Backend Engineer',
    });

    // Open the recruiter workspace through the real endpoint, which keeps the
    // jobseeker profile and only changes the active workspace.
    const switched = await request('POST', '/api/auth/role', {
      token: signTokenFor(person),
      body: { role: 'recruiter' },
    });
    assert.equal(switched.status, 200, switched.raw);

    const res = await request('GET', '/api/admin/jobseekers', {
      token: signTokenFor(admin),
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1, 'the jobseeker profile must still be listed');
    const row = res.body.jobseekers[0];
    assert.equal(row.id, String(person._id));
    assert.equal(row.name, 'Dual Person');
    assert.equal(row.headline, 'Backend Engineer');
    // The account is hiring right now, and the endpoint says so truthfully.
    assert.equal(row.activeWorkspace, 'recruiter');
  });

  it('reports the account active workspace as jobseeker when that is current', async () => {
    const admin = await makeUser('admin-ws-js@example.com', 'admin');
    await makeJobseeker('wsjs@example.com', 'Active Seeker');

    const res = await request('GET', '/api/admin/jobseekers', {
      token: signTokenFor(admin),
    });
    assert.equal(res.body.jobseekers[0].activeWorkspace, 'jobseeker');
  });
});

// ---------------------------------------------------------------------------
describe('admin jobseekers list: counts', () => {
  it('aggregates real application and saved-job counts per account', async () => {
    const admin = await makeUser('admin-counts@example.com', 'admin');
    const owner = await makeRecruiter('counts-owner@example.com', 'Owner');
    const job1 = await Job.create({ ...baseJob(), postedBy: owner._id });
    const job2 = await Job.create({ ...baseJob({ title: 'Another Role' }), postedBy: owner._id });

    const ada = await makeJobseeker('counts-ada@example.com', 'Ada');
    const grace = await makeJobseeker('counts-grace@example.com', 'Grace');

    await applyAsJobseeker(signTokenFor(ada), job1._id, { fullName: 'Ada' });
    await applyAsJobseeker(signTokenFor(ada), job2._id, { fullName: 'Ada' });
    await applyAsJobseeker(signTokenFor(grace), job1._id, { fullName: 'Grace' });
    await SavedJob.create({ userId: ada._id, jobId: job1._id });
    await SavedJob.create({ userId: ada._id, jobId: job2._id });

    const res = await request('GET', '/api/admin/jobseekers', {
      token: signTokenFor(admin),
    });

    assert.equal(res.status, 200);
    const byId = new Map(res.body.jobseekers.map((j) => [String(j.id), j]));
    assert.equal(byId.get(String(ada._id)).applications, 2);
    assert.equal(byId.get(String(ada._id)).savedJobs, 2);
    assert.equal(byId.get(String(grace._id)).applications, 1);
    assert.equal(byId.get(String(grace._id)).savedJobs, 0);
  });
});

// ---------------------------------------------------------------------------
describe('admin jobseekers list: search, filters, pagination', () => {
  const seed = async () => {
    const admin = await makeUser('admin-filters@example.com', 'admin');
    const owner = await makeRecruiter('filters-owner@example.com', 'Owner');
    const job = await Job.create({ ...baseJob(), postedBy: owner._id });

    const ada = await makeJobseeker('filters-ada@example.com', 'Ada Lovelace', {
      location: 'New York, NY',
      headline: 'Frontend Engineer',
    });
    const grace = await makeJobseeker('filters-grace@example.com', 'Grace Liu', {
      location: 'Boston, MA',
      headline: 'Backend Engineer',
    });

    await applyAsJobseeker(signTokenFor(ada), job._id, { fullName: 'Ada Lovelace' });
    return { admin, ada, grace, job };
  };

  it('searches by profile name', async () => {
    const { admin } = await seed();
    const res = await request('GET', `/api/admin/jobseekers?q=${encodeURIComponent('Grace')}`, {
      token: signTokenFor(admin),
    });
    assert.equal(res.body.total, 1);
    assert.equal(res.body.jobseekers[0].name, 'Grace Liu');
  });

  it('searches by account email', async () => {
    const { admin } = await seed();
    const res = await request(
      'GET',
      `/api/admin/jobseekers?q=${encodeURIComponent('filters-ada@example.com')}`,
      { token: signTokenFor(admin) }
    );
    assert.equal(res.body.total, 1);
    assert.equal(res.body.jobseekers[0].name, 'Ada Lovelace');
  });

  it('returns nothing when the search matches no one', async () => {
    const { admin } = await seed();
    const res = await request('GET', `/api/admin/jobseekers?q=${encodeURIComponent('zzzz')}`, {
      token: signTokenFor(admin),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 0);
    assert.deepEqual(res.body.jobseekers, []);
  });

  it('filters by location', async () => {
    const { admin } = await seed();
    const res = await request(
      'GET',
      `/api/admin/jobseekers?location=${encodeURIComponent('Boston, MA')}`,
      { token: signTokenFor(admin) }
    );
    assert.equal(res.body.total, 1);
    assert.equal(res.body.jobseekers[0].location, 'Boston, MA');
  });

  it('filters by joined date window', async () => {
    const admin = await makeUser('admin-dates@example.com', 'admin');
    const old = await makeJobseeker('dates-old@example.com', 'Old Signup');
    const fresh = await makeJobseeker('dates-fresh@example.com', 'Fresh Signup');
    const oldProfile = await Profile.findOne({ userId: old._id, role: 'jobseeker' });
    await backdate(Profile, oldProfile._id, 45);

    const last7 = await request('GET', '/api/admin/jobseekers?dateRange=7', {
      token: signTokenFor(admin),
    });
    assert.equal(last7.body.total, 1);
    assert.equal(last7.body.jobseekers[0].name, 'Fresh Signup');

    const last90 = await request('GET', '/api/admin/jobseekers?dateRange=90', {
      token: signTokenFor(admin),
    });
    assert.equal(last90.body.total, 2);
    assert.ok(fresh._id);
  });

  it('paginates with page/limit and reports real totals', async () => {
    const admin = await makeUser('admin-pager@example.com', 'admin');
    for (let i = 0; i < 5; i += 1) {
      await makeJobseeker(`pager-${i}@example.com`, `Pager ${i}`);
    }

    const page1 = await request('GET', '/api/admin/jobseekers?limit=2&page=1', {
      token: signTokenFor(admin),
    });
    assert.equal(page1.body.page, 1);
    assert.equal(page1.body.limit, 2);
    assert.equal(page1.body.total, 5);
    assert.equal(page1.body.totalPages, 3);
    assert.equal(page1.body.jobseekers.length, 2);

    const page3 = await request('GET', '/api/admin/jobseekers?limit=2&page=3', {
      token: signTokenFor(admin),
    });
    assert.equal(page3.body.page, 3);
    assert.equal(page3.body.jobseekers.length, 1);
  });

  it('combines search and filters', async () => {
    const { admin } = await seed();
    const match = await request(
      'GET',
      `/api/admin/jobseekers?q=${encodeURIComponent('Ada')}&location=${encodeURIComponent('New York, NY')}`,
      { token: signTokenFor(admin) }
    );
    assert.equal(match.body.total, 1);
    assert.equal(match.body.jobseekers[0].name, 'Ada Lovelace');

    const contradiction = await request(
      'GET',
      `/api/admin/jobseekers?q=${encodeURIComponent('Ada')}&location=${encodeURIComponent('Boston, MA')}`,
      { token: signTokenFor(admin) }
    );
    assert.equal(contradiction.body.total, 0);
  });

  it('treats an empty filter value as no filter', async () => {
    const { admin } = await seed();
    const res = await request('GET', '/api/admin/jobseekers?location=&dateRange=&q=', {
      token: signTokenFor(admin),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 2);
  });
});

// ---------------------------------------------------------------------------
// Regression for the reported failure.
//
// The Jobseekers workspace lists every account holding a jobseeker profile,
// but the detail endpoint used to require at least one application. Selecting a
// listed row with no applications therefore answered 404 "Jobseeker not found"
// for an account that plainly existed — 20 of the 28 listed rows in the
// development database.
//
// Both endpoints must agree on what a jobseeker is: an account holding a
// jobseeker profile, regardless of how many applications it has.
describe('admin jobseeker detail: listed accounts always resolve', () => {
  it('loads a listed jobseeker who has never applied', async () => {
    const admin = await makeUser('admin-neverapplied@example.com', 'admin');
    // No applications and no saved jobs at all.
    const person = await makeJobseeker('neverapplied@example.com', 'Probe', {
      location: '',
      headline: '',
    });

    // The row appears in the workspace list...
    const list = await request('GET', '/api/admin/jobseekers', {
      token: signTokenFor(admin),
    });
    assert.equal(list.status, 200);
    assert.equal(list.body.total, 1);
    assert.equal(list.body.jobseekers[0].id, String(person._id));
    assert.equal(list.body.jobseekers[0].applications, 0);

    // ...so selecting it must load, not 404.
    const res = await request('GET', `/api/admin/jobseekers/${person._id}`, {
      token: signTokenFor(admin),
    });

    assert.equal(res.status, 200);
    const js = res.body.jobseeker;
    assert.equal(js.id, String(person._id));
    assert.equal(js.fullName, 'Probe');
    assert.equal(js.profileExists, true);
    // Real zeros and a real empty list, never padded values.
    assert.equal(js.applications, 0);
    assert.equal(js.savedJobs, 0);
    assert.deepEqual(js.recentApplications, []);
  });

  it('resolves every account the list returns', async () => {
    const admin = await makeUser('admin-allresolve@example.com', 'admin');
    const owner = await makeRecruiter('allresolve-owner@example.com', 'Owner');
    const job = await Job.create({ ...baseJob(), postedBy: owner._id });

    // A mix: with applications, with saved jobs only, and with neither.
    const applied = await makeJobseeker('resolve-applied@example.com', 'Applied One');
    const saver = await makeJobseeker('resolve-saver@example.com', 'Saved Only');
    const neither = await makeJobseeker('resolve-neither@example.com', 'Neither');

    await applyAsJobseeker(signTokenFor(applied), job._id, { fullName: 'Applied One' });
    await SavedJob.create({ userId: saver._id, jobId: job._id });

    const list = await request('GET', '/api/admin/jobseekers', { token: signTokenFor(admin) });
    assert.equal(list.body.total, 3);

    for (const row of list.body.jobseekers) {
      const detail = await request('GET', `/api/admin/jobseekers/${row.id}`, {
        token: signTokenFor(admin),
      });
      assert.equal(
        detail.status,
        200,
        `listed account ${row.email} must resolve, got ${detail.status}`
      );
    }
  });

  it('still 404s an account that holds no jobseeker profile', async () => {
    const admin = await makeUser('admin-still404@example.com', 'admin');

    // A recruiter-only account: no jobseeker profile, so never a jobseeker.
    const recruiter = await makeRecruiter('still404-rec@example.com', 'Pure Recruiter');
    // An admin account likewise.
    const otherAdmin = await makeUser('still404-admin@example.com', 'admin');
    await Profile.create({
      userId: otherAdmin._id,
      role: 'admin',
      fullName: 'The Admin',
      phone: '+1-555-0100',
    });

    for (const account of [recruiter, otherAdmin]) {
      const res = await request('GET', `/api/admin/jobseekers/${account._id}`, {
        token: signTokenFor(admin),
      });
      assert.equal(res.status, 404, `${account.email} must stay a 404`);
      assert.equal(res.body.error, 'Jobseeker not found');
    }
  });

  it('omits a jobseeker profile whose account no longer exists', async () => {
    const admin = await makeUser('admin-orphan@example.com', 'admin');

    // A real jobseeker, who must still be listed.
    const real = await makeJobseeker('orphan-real@example.com', 'Real Seeker');

    // An orphaned profile: the account was deleted but the profile was left
    // behind. It is not an account, so listing it would produce a row the
    // detail endpoint can never load.
    const ghost = await makeUser('orphan-ghost@example.com', 'jobseeker');
    await Profile.create({
      userId: ghost._id,
      role: 'jobseeker',
      fullName: 'Deleted Account',
      phone: '+1-555-0100',
    });
    await User.findByIdAndDelete(ghost._id);

    const res = await request('GET', '/api/admin/jobseekers', {
      token: signTokenFor(admin),
    });

    assert.equal(res.status, 200);
    // Only the real account is listed, and the totals reflect that.
    assert.equal(res.body.total, 1);
    assert.equal(res.body.jobseekers.length, 1);
    assert.equal(res.body.jobseekers[0].id, String(real._id));
    assert.equal(
      res.body.jobseekers.some((j) => j.name === 'Deleted Account'),
      false
    );
    assert.equal(res.body.jobseekers.some((j) => j.email === ''), false);

    // And the detail endpoint agrees: the orphan has no account to load.
    const orphanId = (await Profile.findOne({ fullName: 'Deleted Account' })).userId;
    const detail = await request('GET', `/api/admin/jobseekers/${orphanId}`, {
      token: signTokenFor(admin),
    });
    assert.equal(detail.status, 404);
  });

  it('404s an unknown id and 400s a malformed id', async () => {
    const admin = await makeUser('admin-badid@example.com', 'admin');
    const token = signTokenFor(admin);

    const missing = await request('GET', `/api/admin/jobseekers/${MISSING_ID}`, { token });
    assert.equal(missing.status, 404);

    const malformed = await request('GET', '/api/admin/jobseekers/not-an-id', { token });
    assert.equal(malformed.status, 400);
  });
});

describe('admin jobseeker detail: recent applications', () => {
  it('returns the real recent applications with canonical statuses', async () => {
    const admin = await makeUser('admin-recent@example.com', 'admin');
    const owner = await makeRecruiter('recent-owner@example.com', 'Owner');
    const jobA = await Job.create({ ...baseJob({ title: 'Frontend Engineer', company: 'LexCorp' }), postedBy: owner._id });
    const jobB = await Job.create({ ...baseJob({ title: 'Backend Engineer', company: 'OmniCorp' }), postedBy: owner._id });

    const person = await makeJobseeker('recent-seeker@example.com', 'Recent Seeker');
    const appA = await applyAsJobseeker(signTokenFor(person), jobA._id, { fullName: 'Recent Seeker' });
    await applyAsJobseeker(signTokenFor(person), jobB._id, { fullName: 'Recent Seeker' });
    await Application.updateOne({ _id: appA._id }, { $set: { status: 'under-review' } });

    const res = await request('GET', `/api/admin/jobseekers/${person._id}`, {
      token: signTokenFor(admin),
    });

    assert.equal(res.status, 200);
    const js = res.body.jobseeker;
    assert.ok(Array.isArray(js.recentApplications));
    assert.equal(js.recentApplications.length, 2);
    // Newest first.
    assert.equal(js.recentApplications[0].job, 'Backend Engineer');
    assert.equal(js.recentApplications[0].status, 'applied');
    assert.equal(js.recentApplications[1].job, 'Frontend Engineer');
    // Canonical backend statuses only — no invented vocabulary.
    assert.ok(['applied', 'under-review', 'interview', 'offer', 'hired', 'rejected']
      .includes(js.recentApplications[1].status));
    assert.equal(js.recentApplications[1].company, 'LexCorp');
  });

  it('returns a real empty recent list, not fabricated rows, for an applicant whose applications were removed', async () => {
    const admin = await makeUser('admin-norecent@example.com', 'admin');
    const person = await makeJobseeker('norecent@example.com', 'No Applications');

    const owner = await makeRecruiter('norecent-owner@example.com', 'Owner');
    const job = await Job.create({ ...baseJob(), postedBy: owner._id });
    await applyAsJobseeker(signTokenFor(person), job._id, { fullName: 'No Applications' });
    await Application.deleteMany({ userId: person._id });

    const res = await request('GET', `/api/admin/jobseekers/${person._id}`, {
      token: signTokenFor(admin),
    });

    // The profile still resolves, and the recent list is genuinely empty.
    assert.equal(res.status, 200);
    assert.equal(res.body.jobseeker.applications, 0);
    assert.deepEqual(res.body.jobseeker.recentApplications, []);
  });

  it('does not expose recruiter-only fields for a dual-workspace account', async () => {
    const admin = await makeUser('admin-leak@example.com', 'admin');
    const owner = await makeRecruiter('leak-owner@example.com', 'Owner');
    const job = await Job.create({ ...baseJob(), postedBy: owner._id });

    const person = await makeJobseeker('leak-seeker@example.com', 'Leak Check');
    await applyAsJobseeker(signTokenFor(person), job._id, { fullName: 'Leak Check' });

    // Open the recruiter workspace and fill in recruiter-only fields.
    await request('POST', '/api/auth/role', {
      token: signTokenFor(person),
      body: { role: 'recruiter' },
    });
    await Profile.updateOne(
      { userId: person._id, role: 'recruiter' },
      { $set: { jobTitle: 'Head Hunter', companyName: 'Secret Corp' } }
    );

    const res = await request('GET', `/api/admin/jobseekers/${person._id}`, {
      token: signTokenFor(admin),
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.jobseeker.companyName, undefined);
    assert.equal(res.body.jobseeker.jobTitle, undefined);
    assert.equal(JSON.stringify(res.body).includes('Secret Corp'), false);
    assert.equal(JSON.stringify(res.body).includes('Head Hunter'), false);
  });
});