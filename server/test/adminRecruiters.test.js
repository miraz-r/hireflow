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
const TEST_DB_NAME = 'hireflow_test_admin_recruiters';

let server;
let baseUrl;

const makeUser = async (email, role = 'recruiter') => {
  const passwordHash = await bcrypt.hash('password123', 4);
  return User.create({ email, passwordHash, role });
};

// A recruiter-only account: created through the recruiter workspace, so it holds
// exactly one profile.
const makeRecruiter = async (email, fullName, extra = {}) => {
  const user = await makeUser(email, 'recruiter');
  await Profile.create({
    userId: user._id,
    role: 'recruiter',
    fullName,
    phone: '+1-555-0100',
    ...extra,
  });
  return user;
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

const backdate = async (model, id, daysAgo) => {
  const _id = id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id);
  const result = await model.collection.updateOne(
    { _id },
    { $set: { createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000) } }
  );
  assert.equal(result.matchedCount, 1, `backdate should have matched 1 document for ${id}`);
};

// Apply through the real POST endpoint so the stored document matches production.
const applyAsJobseeker = async (token, jobId, body = {}) => {
  const res = await request('POST', '/api/applications', {
    token,
    body: { jobId, phone: '+1-555-0199', resumeUrl: '/uploads/resumes/cv.pdf', ...body },
  });
  assert.equal(res.status, 201, res.raw);
  return res.body;
};

// Switch the active workspace through the real endpoint. This is non-
// destructive: it only changes User.role and ensures a profile row exists for the
// target workspace, so the other workspace's profile survives.
const switchWorkspace = async (token, role) => {
  const res = await request('POST', '/api/auth/role', { token, body: { role } });
  assert.equal(res.status, 200, res.raw);
  return res.body;
};

const listRecruiters = async (token, query = '') => {
  const res = await request('GET', `/api/admin/recruiters${query}`, { token });
  assert.equal(res.status, 200, res.raw);
  return res.body;
};

const rowsById = (body) =>
  new Map((body.recruiters || []).map((r) => [String(r.id), r]));

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

// ---------------------------------------------------------------------------
describe('admin recruiters list: authentication and authorization', () => {
  it('requires a token', async () => {
    const res = await request('GET', '/api/admin/recruiters');
    assert.equal(res.status, 401);
  });

  it('rejects non-admin roles', async () => {
    const jobseeker = await makeJobseeker('denied-seeker@example.com', 'Denied Seeker');
    const recruiter = await makeRecruiter('denied-rec@example.com', 'Denied Rec');

    const asJobseeker = await request('GET', '/api/admin/recruiters', {
      token: signTokenFor(jobseeker),
    });
    assert.equal(asJobseeker.status, 403);

    const asRecruiter = await request('GET', '/api/admin/recruiters', {
      token: signTokenFor(recruiter),
    });
    assert.equal(asRecruiter.status, 403);
  });

  it('serves an admin token', async () => {
    const admin = await makeUser('admin-ok@example.com', 'admin');
    const res = await request('GET', '/api/admin/recruiters', {
      token: signTokenFor(admin),
    });
    assert.equal(res.status, 200);
  });
});

// ---------------------------------------------------------------------------
describe('admin recruiters list: query validation', () => {
  const adminToken = async (email) => signTokenFor(await makeUser(email, 'admin'));

  it('rejects a malformed ?page', async () => {
    const token = await adminToken('v-page@example.com');
    const res = await request('GET', '/api/admin/recruiters?page=abc', { token });
    assert.equal(res.status, 400);
  });

  it('rejects a non-positive ?page', async () => {
    const token = await adminToken('v-page0@example.com');
    const res = await request('GET', '/api/admin/recruiters?page=0', { token });
    assert.equal(res.status, 400);
  });

  it('rejects an out-of-range ?limit', async () => {
    const token = await adminToken('v-limit@example.com');
    const res = await request('GET', '/api/admin/recruiters?limit=500', { token });
    assert.equal(res.status, 400);
  });

  it('rejects a malformed ?dateRange', async () => {
    const token = await adminToken('v-range@example.com');
    const res = await request('GET', '/api/admin/recruiters?dateRange=abc', { token });
    assert.equal(res.status, 400);
  });

  it('rejects an over-long ?company', async () => {
    const token = await adminToken('v-company@example.com');
    const res = await request(
      'GET',
      `/api/admin/recruiters?company=${'a'.repeat(201)}`,
      { token }
    );
    assert.equal(res.status, 400);
  });

  it('rejects an over-long ?q', async () => {
    const token = await adminToken('v-q@example.com');
    const res = await request('GET', `/api/admin/recruiters?q=${'a'.repeat(201)}`, { token });
    assert.equal(res.status, 400);
  });

  it('treats empty filter values as no filter', async () => {
    const token = await adminToken('v-empty@example.com');
    await makeRecruiter('empty-filter@example.com', 'Empty Filter');
    const res = await request('GET', '/api/admin/recruiters?company=&dateRange=&q=', { token });
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
  });
});

// ---------------------------------------------------------------------------
describe('admin recruiters list: sourcing', () => {
  it('lists only accounts holding a recruiter profile', async () => {
    const admin = await makeUser('admin-source@example.com', 'admin');
    await makeRecruiter('listed@example.com', 'Listed Recruiter', {
      companyName: 'Acme Corp',
      location: 'Remote',
    });

    const body = await listRecruiters(signTokenFor(admin));

    assert.equal(body.total, 1);
    const row = body.recruiters[0];
    assert.equal(row.name, 'Listed Recruiter');
    assert.equal(row.email, 'listed@example.com');
    assert.equal(row.company, 'Acme Corp');
    assert.equal(row.location, 'Remote');
  });

  it('exposes no status field, because User has none', async () => {
    const admin = await makeUser('admin-nostatus@example.com', 'admin');
    await makeRecruiter('nostatus@example.com', 'No Status');

    const body = await listRecruiters(signTokenFor(admin));

    assert.equal('status' in body.recruiters[0], false);
    assert.equal(JSON.stringify(body).includes('suspended'), false);
  });

  it('returns real profile fields, including the company website', async () => {
    const admin = await makeUser('admin-fields@example.com', 'admin');
    await makeRecruiter('fields@example.com', 'Field Recruiter', {
      jobTitle: 'Head Hunter',
      companyName: 'Globex',
      companyWebsite: 'https://globex.example.com',
      phone: '+1-555-0142',
    });

    const row = (await listRecruiters(signTokenFor(admin))).recruiters[0];

    assert.equal(row.jobTitle, 'Head Hunter');
    assert.equal(row.company, 'Globex');
    assert.equal(row.companyWebsite, 'https://globex.example.com');
    assert.equal(row.phone, '+1-555-0142');
  });

  it('excludes an account holding only a jobseeker profile', async () => {
    const admin = await makeUser('admin-noseeker@example.com', 'admin');
    await makeJobseeker('pure-seeker@example.com', 'Pure Seeker');

    const body = await listRecruiters(signTokenFor(admin));

    assert.equal(body.total, 0);
    assert.deepEqual(body.recruiters, []);
  });

  it('excludes an admin account, which holds an admin profile', async () => {
    const admin = await makeUser('admin-mixed@example.com', 'admin');
    // The bootstrapper gives the admin an admin-workspace profile. That is not
    // a recruiter workspace, so the account must not be listed.
    await Profile.create({
      userId: admin._id,
      role: 'admin',
      fullName: 'The Admin',
      phone: '+1-555-0100',
    });
    await makeRecruiter('real-rec@example.com', 'Real Recruiter');

    const body = await listRecruiters(signTokenFor(admin));

    assert.equal(body.total, 1);
    assert.equal(body.recruiters[0].name, 'Real Recruiter');
  });
});

// ---------------------------------------------------------------------------
describe('admin recruiters list: dual-workspace accounts', () => {
  it('includes a recruiter whose account is active in the recruiter workspace', async () => {
    const admin = await makeUser('admin-dual-1@example.com', 'admin');
    const person = await makeJobseeker('dual-1@example.com', 'Dual One');
    await switchWorkspace(signTokenFor(person), 'recruiter');
    await Profile.updateOne(
      { userId: person._id, role: 'recruiter' },
      { $set: { companyName: 'Stark Industries' } }
    );

    const body = await listRecruiters(signTokenFor(admin));

    assert.equal(body.total, 1);
    const row = body.recruiters[0];
    assert.equal(row.id, String(person._id));
    assert.equal(row.name, 'Dual One');
    assert.equal(row.company, 'Stark Industries');
    assert.equal(row.activeWorkspace, 'recruiter');
  });

  it('still includes a recruiter whose account is active in the jobseeker workspace', async () => {
    const admin = await makeUser('admin-dual-2@example.com', 'admin');
    // Registered as a recruiter, then switched back to the jobseeker workspace.
    // The recruiter profile survives the switch, so they are still a recruiter.
    const person = await makeRecruiter('dual-2@example.com', 'Dual Two', {
      companyName: 'Aperture Science',
    });
    await switchWorkspace(signTokenFor(person), 'jobseeker');

    const body = await listRecruiters(signTokenFor(admin));

    assert.equal(body.total, 1, 'the recruiter profile must still be listed');
    const row = body.recruiters[0];
    assert.equal(row.id, String(person._id));
    assert.equal(row.company, 'Aperture Science');
    // Truthfully reported, and not used as the sourcing rule.
    assert.equal(row.activeWorkspace, 'jobseeker');
  });

  it('counts only jobs posted by the listed recruiter, across both workspaces', async () => {
    const admin = await makeUser('admin-dual-3@example.com', 'admin');
    const person = await makeRecruiter('dual-3@example.com', 'Dual Three');
    await Job.create({ ...baseJob(), postedBy: person._id });

    const row = (await listRecruiters(signTokenFor(admin))).recruiters[0];
    assert.equal(row.jobs, 1);
  });
});

// ---------------------------------------------------------------------------
describe('admin recruiters list: orphan exclusion', () => {
  it('omits a recruiter profile whose account no longer exists', async () => {
    const admin = await makeUser('admin-orphan@example.com', 'admin');
    const real = await makeRecruiter('orphan-real@example.com', 'Real Recruiter');

    const ghost = await makeUser('orphan-ghost@example.com', 'recruiter');
    await Profile.create({
      userId: ghost._id,
      role: 'recruiter',
      fullName: 'Deleted Account',
      phone: '+1-555-0100',
      companyName: 'Ghost Corp',
    });
    await User.findByIdAndDelete(ghost._id);

    const body = await listRecruiters(signTokenFor(admin));

    assert.equal(body.total, 1);
    assert.equal(body.recruiters.length, 1);
    assert.equal(body.recruiters[0].id, String(real._id));
    assert.equal(JSON.stringify(body).includes('Deleted Account'), false);
    assert.equal(JSON.stringify(body).includes('Ghost Corp'), false);
    // A row must never be returned with a blank identity.
    assert.equal(body.recruiters.some((r) => r.email === ''), false);
  });
});

// ---------------------------------------------------------------------------
describe('admin recruiters list: job and application counts', () => {
  it('aggregates real counts and attributes them to the right recruiter', async () => {
    const admin = await makeUser('admin-counts@example.com', 'admin');

    const ada = await makeRecruiter('counts-ada@example.com', 'Ada');
    const grace = await makeRecruiter('counts-grace@example.com', 'Grace');

    const adaJob1 = await Job.create({ ...baseJob({ title: 'Frontend' }), postedBy: ada._id });
    const adaJob2 = await Job.create({ ...baseJob({ title: 'Backend' }), postedBy: ada._id });
    const graceJob = await Job.create({ ...baseJob({ title: 'Design' }), postedBy: grace._id });

    const seeker1 = await makeJobseeker('counts-s1@example.com', 'Seeker One');
    const seeker2 = await makeJobseeker('counts-s2@example.com', 'Seeker Two');

    await applyAsJobseeker(signTokenFor(seeker1), adaJob1._id, { fullName: 'Seeker One' });
    await applyAsJobseeker(signTokenFor(seeker1), adaJob2._id, { fullName: 'Seeker One' });
    await applyAsJobseeker(signTokenFor(seeker2), adaJob1._id, { fullName: 'Seeker Two' });
    await applyAsJobseeker(signTokenFor(seeker2), graceJob._id, { fullName: 'Seeker Two' });

    const byId = rowsById(await listRecruiters(signTokenFor(admin)));

    assert.equal(byId.get(String(ada._id)).jobs, 2);
    // Attribution: adaJob1 received two applications (seekerOne + seekerTwo)
    // and adaJob2 one (seekerOne), so all three belong to Ada.
    assert.equal(byId.get(String(ada._id)).applications, 3);
    // Grace's own job received only seekerTwo's, so none of Ada's applications
    // leak onto Grace's row.
    assert.equal(byId.get(String(grace._id)).jobs, 1);
    assert.equal(byId.get(String(grace._id)).applications, 1);
  });

  it('reports real zeros for a recruiter with no jobs or applications', async () => {
    const admin = await makeUser('admin-zero@example.com', 'admin');
    const idle = await makeRecruiter('zero@example.com', 'Idle Recruiter');
    // Another recruiter's activity must not leak onto this row.
    const busy = await makeRecruiter('busy@example.com', 'Busy Recruiter');
    const busyJob = await Job.create({ ...baseJob(), postedBy: busy._id });
    const seeker = await makeJobseeker('zero-s1@example.com', 'Seeker');
    await applyAsJobseeker(signTokenFor(seeker), busyJob._id, { fullName: 'Seeker' });

    const body = await listRecruiters(signTokenFor(admin));
    const byId = rowsById(body);

    // Still listed: having no activity is a fact to report, not a reason to hide.
    assert.equal(body.total, 2);
    assert.equal(byId.get(String(idle._id)).jobs, 0);
    assert.equal(byId.get(String(idle._id)).applications, 0);
    assert.equal(byId.get(String(busy._id)).jobs, 1);
    assert.equal(byId.get(String(busy._id)).applications, 1);
  });

  it('drops application counts to zero when the applications are removed', async () => {
    const admin = await makeUser('admin-removed@example.com', 'admin');
    const owner = await makeRecruiter('removed-owner@example.com', 'Owner');
    const job = await Job.create({ ...baseJob(), postedBy: owner._id });
    const seeker = await makeJobseeker('removed-s1@example.com', 'Seeker');
    await applyAsJobseeker(signTokenFor(seeker), job._id, { fullName: 'Seeker' });
    await Application.deleteMany({ userId: seeker._id });

    const row = (await listRecruiters(signTokenFor(admin))).recruiters[0];

    assert.equal(row.jobs, 1, 'the job still exists');
    assert.equal(row.applications, 0, 'but its applications do not');
  });
});

// ---------------------------------------------------------------------------
describe('admin recruiters list: search and filters', () => {
  const seed = async () => {
    const admin = await makeUser('admin-filters@example.com', 'admin');
    await makeRecruiter('filters-ada@example.com', 'Ada Lovelace', {
      jobTitle: 'Frontend Engineer',
      companyName: 'Stark Industries',
      location: 'New York, NY',
    });
    await makeRecruiter('filters-grace@example.com', 'Grace Liu', {
      jobTitle: 'Backend Engineer',
      companyName: 'Aperture Science',
      location: 'Boston, MA',
    });
    return admin;
  };

  it('searches by recruiter name', async () => {
    const admin = await seed();
    const body = await listRecruiters(
      signTokenFor(admin),
      `?q=${encodeURIComponent('Grace')}`
    );
    assert.equal(body.total, 1);
    assert.equal(body.recruiters[0].name, 'Grace Liu');
  });

  it('searches by account email', async () => {
    const admin = await seed();
    const body = await listRecruiters(
      signTokenFor(admin),
      `?q=${encodeURIComponent('filters-ada@example.com')}`
    );
    assert.equal(body.total, 1);
    assert.equal(body.recruiters[0].name, 'Ada Lovelace');
  });

  it('searches by company name', async () => {
    const admin = await seed();
    const body = await listRecruiters(
      signTokenFor(admin),
      `?q=${encodeURIComponent('Aperture')}`
    );
    assert.equal(body.total, 1);
    assert.equal(body.recruiters[0].name, 'Grace Liu');
  });

  it('searches by job title', async () => {
    const admin = await seed();
    const body = await listRecruiters(
      signTokenFor(admin),
      `?q=${encodeURIComponent('Frontend Engineer')}`
    );
    assert.equal(body.total, 1);
    assert.equal(body.recruiters[0].name, 'Ada Lovelace');
  });

  it('returns nothing when the search matches no one', async () => {
    const admin = await seed();
    const body = await listRecruiters(
      signTokenFor(admin),
      `?q=${encodeURIComponent('zzzz')}`
    );
    assert.equal(body.total, 0);
    assert.deepEqual(body.recruiters, []);
  });

  it('does not treat a regex metacharacter as a pattern', async () => {
    const admin = await seed();
    const body = await listRecruiters(
      signTokenFor(admin),
      `?q=${encodeURIComponent('.*')}`
    );
    assert.equal(body.total, 0, 'the term must be matched literally');
  });

  it('filters by company', async () => {
    const admin = await seed();
    const body = await listRecruiters(
      signTokenFor(admin),
      `?company=${encodeURIComponent('Stark Industries')}`
    );
    assert.equal(body.total, 1);
    assert.equal(body.recruiters[0].company, 'Stark Industries');
  });

  it('returns an empty page for a company nobody has', async () => {
    const admin = await seed();
    const body = await listRecruiters(
      signTokenFor(admin),
      `?company=${encodeURIComponent('Nowhere Ltd')}`
    );
    assert.equal(body.total, 0);
  });

  it('filters by joined date window', async () => {
    const admin = await makeUser('admin-dates@example.com', 'admin');
    const oldRec = await makeRecruiter('dates-old@example.com', 'Old Signup');
    await makeRecruiter('dates-fresh@example.com', 'Fresh Signup');
    const oldProfile = await Profile.findOne({ userId: oldRec._id, role: 'recruiter' });
    await backdate(Profile, oldProfile._id, 45);

    const last7 = await listRecruiters(signTokenFor(admin), '?dateRange=7');
    assert.equal(last7.total, 1);
    assert.equal(last7.recruiters[0].name, 'Fresh Signup');

    const last90 = await listRecruiters(signTokenFor(admin), '?dateRange=90');
    assert.equal(last90.total, 2);
  });

  it('paginates with page/limit and reports real totals', async () => {
    const admin = await makeUser('admin-pager@example.com', 'admin');
    for (let i = 0; i < 5; i += 1) {
      await makeRecruiter(`pager-${i}@example.com`, `Pager ${i}`);
    }

    const page1 = await listRecruiters(signTokenFor(admin), '?limit=2&page=1');
    assert.equal(page1.page, 1);
    assert.equal(page1.limit, 2);
    assert.equal(page1.total, 5);
    assert.equal(page1.totalPages, 3);
    assert.equal(page1.recruiters.length, 2);

    const page3 = await listRecruiters(signTokenFor(admin), '?limit=2&page=3');
    assert.equal(page3.page, 3);
    assert.equal(page3.recruiters.length, 1);
  });

  it('combines search and filters', async () => {
    const admin = await seed();
    const match = await listRecruiters(
      signTokenFor(admin),
      `?q=${encodeURIComponent('Ada')}&company=${encodeURIComponent('Stark Industries')}`
    );
    assert.equal(match.total, 1);
    assert.equal(match.recruiters[0].name, 'Ada Lovelace');

    const contradiction = await listRecruiters(
      signTokenFor(admin),
      `?q=${encodeURIComponent('Ada')}&company=${encodeURIComponent('Aperture Science')}`
    );
    assert.equal(contradiction.total, 0);
  });
});

// ---------------------------------------------------------------------------
// The workspace has no per-recruiter detail endpoint by design: every value the
// detail panel renders is already on the list row. The invariant that replaces
// the list/detail agreement check is therefore that EVERY row the list returns
// is backed by a live account holding a real recruiter profile, and that the
// row's identity fields agree with the stored documents — no row can be
// rendered that the workspace cannot fully account for.
describe('admin recruiters list: every listed row is backed by a real account', () => {
  it('resolves each listed row to a live account with a recruiter profile', async () => {
    const admin = await makeUser('admin-resolve@example.com', 'admin');

    // A mix that must all survive: recruiter-only, dual-workspace in both
    // directions, an idle recruiter with no jobs, and an orphan.
    const only = await makeRecruiter('resolve-only@example.com', 'Only Recruiter');
    const hiring = await makeRecruiter('resolve-hiring@example.com', 'Hiring Recruiter');
    const dualRecruiter = await makeJobseeker('resolve-dualr@example.com', 'Dual Recruiter');
    await switchWorkspace(signTokenFor(dualRecruiter), 'recruiter');
    const dualJobseeker = await makeRecruiter('resolve-dualj@example.com', 'Dual Jobseeker');
    await switchWorkspace(signTokenFor(dualJobseeker), 'jobseeker');
    const idle = await makeRecruiter('resolve-idle@example.com', 'Idle Recruiter');

    const job = await Job.create({ ...baseJob(), postedBy: hiring._id });
    const seeker = await makeJobseeker('resolve-seeker@example.com', 'Seeker');
    await applyAsJobseeker(signTokenFor(seeker), job._id, { fullName: 'Seeker' });

    // Must never be listed: no account behind it.
    const ghost = await makeUser('resolve-ghost@example.com', 'recruiter');
    await Profile.create({
      userId: ghost._id,
      role: 'recruiter',
      fullName: 'Ghost Recruiter',
      phone: '+1-555-0100',
    });
    await User.findByIdAndDelete(ghost._id);

    // Must never be listed: no recruiter workspace at all.
    await makeJobseeker('resolve-pureseeker@example.com', 'Pure Seeker');

    const body = await listRecruiters(signTokenFor(admin));

    assert.equal(body.total, 5);
    assert.deepEqual(
      body.recruiters.map((r) => r.name).sort(),
      ['Dual Jobseeker', 'Dual Recruiter', 'Hiring Recruiter', 'Idle Recruiter', 'Only Recruiter']
    );

    for (const row of body.recruiters) {
      const account = await User.findById(row.id).lean();
      const profile = await Profile.findOne({ userId: row.id, role: 'recruiter' }).lean();

      assert.ok(account, `listed row ${row.name} must have a live account`);
      assert.ok(profile, `listed row ${row.name} must have a recruiter profile`);
      assert.equal(row.email, account.email);
      assert.equal(row.name, profile.fullName);
      assert.equal(row.company, profile.companyName || '');
      assert.equal(row.activeWorkspace, account.role);
      assert.ok(row.id && row.name && row.email, 'identity fields must never be blank');
    }

    // The two that must not be listed are still absent.
    const names = body.recruiters.map((r) => r.name);
    assert.equal(names.includes('Ghost Recruiter'), false);
    assert.equal(names.includes('Pure Seeker'), false);
    assert.equal(names.includes(String(only._id)), false);
  });

  it('keeps counts consistent between the list and the stored data', async () => {
    const admin = await makeUser('admin-consistent@example.com', 'admin');
    const owner = await makeRecruiter('consistent-owner@example.com', 'Owner');
    const other = await makeRecruiter('consistent-other@example.com', 'Other');

    const jobA = await Job.create({ ...baseJob(), postedBy: owner._id });
    await Job.create({ ...baseJob(), postedBy: other._id });
    const seeker = await makeJobseeker('consistent-seeker@example.com', 'Seeker');
    await applyAsJobseeker(signTokenFor(seeker), jobA._id, { fullName: 'Seeker' });

    const row = (await listRecruiters(signTokenFor(admin))).recruiters.find(
      (r) => r.id === String(owner._id)
    );

    assert.equal(row.jobs, await Job.countDocuments({ postedBy: owner._id }));
    assert.equal(
      row.applications,
      await Application.countDocuments({ jobId: jobA._id })
    );
  });
});