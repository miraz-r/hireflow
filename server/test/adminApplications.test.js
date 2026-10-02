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
const RecruiterActivity = require('../src/models/RecruiterActivity');

// Distinct DB so this file can run concurrently with other test files.
const TEST_DB_NAME = 'hireflow_test_admin_applications';

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

const makeJobseeker = async (email, fullName, extra = {}) => {
  const user = await makeUser(email, 'jobseeker');
  await Profile.create({
    userId: user._id,
    role: 'jobseeker',
    fullName,
    phone: '+1 555 010 9999',
    ...extra,
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

const MISSING_ID = new mongoose.Types.ObjectId();

// Backdate createdAt through the native collection: mongoose timestamps on
// update would otherwise keep createdAt pinned to the write time. The id is
// cast to a real ObjectId first — application ids arrive as strings from a JSON
// response body, and the native driver will not cast a string `_id` itself, so
// an uncast id would silently match nothing.
const backdate = async (model, id, daysAgo) => {
  const _id = id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id);
  const result = await model.collection.updateOne(
    { _id },
    { $set: { createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000) } }
  );
  // Guards against a silently ineffective backdate, which would otherwise make
  // a date-range test pass or fail for the wrong reason.
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
    RecruiterActivity.deleteMany({}),
  ]);
});

// Build an application through the real POST endpoint so the stored document
// matches production shape, then optionally force a status.
const applyAsJobseeker = async (jobseekerToken, jobId, body = {}) => {
  const res = await request('POST', '/api/applications', {
    token: jobseekerToken,
    body: {
      jobId,
      phone: '+1-555-0199',
      resumeUrl: '/uploads/resumes/jane.pdf',
      ...body,
    },
  });
  assert.equal(res.status, 201);
  return res.body;
};

describe('admin applications: authorization', () => {
  const routes = [
    'GET /api/admin/applications',
    'GET /api/admin/applications/000000000000000000000000',
  ];

  for (const route of routes) {
    const [method, path] = route.split(' ');
    it(`requires a token for ${route}`, async () => {
      const res = await request(method, path);
      assert.equal(res.status, 401);
    });
  }

  it('requires a token for PATCH /api/admin/applications/:id/status', async () => {
    const res = await request(
      'PATCH',
      '/api/admin/applications/000000000000000000000000/status',
      { body: { status: 'interview' } }
    );
    assert.equal(res.status, 401);
  });

  it('rejects recruiter and jobseeker roles on every applications route', async () => {
    for (const role of ['recruiter', 'jobseeker']) {
      const user = await makeUser(`admin-denied-${role}@example.com`, role);
      const token = signTokenFor(user);

      const list = await request('GET', '/api/admin/applications', { token });
      assert.equal(list.status, 403, `${role} should not list admin applications`);

      const detail = await request('GET', `/api/admin/applications/${MISSING_ID}`, {
        token,
      });
      assert.equal(detail.status, 403, `${role} should not read admin application detail`);

      const patch = await request(
        'PATCH',
        `/api/admin/applications/${MISSING_ID}/status`,
        { token, body: { status: 'interview' } }
      );
      assert.equal(patch.status, 403, `${role} should not moderate applications`);
    }
  });
});

describe('admin applications: list', () => {
  it('preserves the Overview default contract (newest 8, no filters)', async () => {
    const admin = await makeUser('admin-overview@example.com', 'admin');
    const recruiter = await makeRecruiter('overview-owner@example.com', 'Jane Doe');
    const job = await Job.create({ ...baseJob(), postedBy: recruiter._id });

    // 12 applications, created oldest-to-newest so ordering is meaningful.
    for (let i = 0; i < 12; i += 1) {
      const seeker = await makeJobseeker(`ov-seeker-${i}@example.com`, `Seeker ${i}`);
      await applyAsJobseeker(signTokenFor(seeker), job._id, {
        fullName: `Seeker ${i}`,
        email: seeker.email,
      });
    }

    const res = await request('GET', '/api/admin/applications', {
      token: signTokenFor(admin),
    });

    assert.equal(res.status, 200);
    // Default page/limit are unchanged from the original Overview feed.
    assert.equal(res.body.page, 1);
    assert.equal(res.body.limit, 8);
    assert.equal(res.body.total, 12);
    assert.equal(res.body.totalPages, 2);
    assert.equal(res.body.applications.length, 8);

    // The five Overview fields keep their exact names.
    const [first] = res.body.applications;
    for (const key of ['id', 'applicant', 'jobTitle', 'company', 'status', 'appliedAt']) {
      assert.ok(key in first, `Overview field "${key}" must still be present`);
    }
    assert.equal(first.applicant, 'Seeker 11');
    assert.equal(first.jobTitle, 'Software Engineer');
    assert.equal(first.company, 'Acme Corp');
    assert.equal(first.status, 'applied');
  });

  it('returns applicant, job, and recruiter detail for the table', async () => {
    const admin = await makeUser('admin-shape@example.com', 'admin');
    const recruiter = await makeRecruiter('shape-owner@example.com', 'Zelda Vance');
    const job = await Job.create({
      ...baseJob({ title: 'Frontend Engineer', company: 'LexCorp' }),
      postedBy: recruiter._id,
    });
    const seeker = await makeJobseeker('shape-seeker@example.com', 'Ada Lovelace', {
      location: 'London, UK',
      skills: ['React', 'TypeScript'],
    });

    const created = await applyAsJobseeker(signTokenFor(seeker), job._id, {
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '+44 20 7946 0000',
      linkedin: 'https://linkedin.com/in/ada',
      portfolio: 'https://ada.dev',
    });

    const res = await request('GET', '/api/admin/applications', {
      token: signTokenFor(admin),
    });

    assert.equal(res.status, 200);
    const row = res.body.applications[0];

    assert.equal(row.id, created._id);
    assert.equal(row.applicant, 'Ada Lovelace');
    assert.equal(row.email, 'ada@example.com');
    assert.equal(row.phone, '+44 20 7946 0000');
    assert.equal(row.location, 'London, UK');
    assert.equal(row.linkedin, 'https://linkedin.com/in/ada');
    assert.equal(row.portfolio, 'https://ada.dev');
    assert.equal(row.resumeUrl, '/uploads/resumes/jane.pdf');
    assert.deepEqual(row.skills, ['React', 'TypeScript']);
    assert.equal(row.jobTitle, 'Frontend Engineer');
    assert.equal(row.company, 'LexCorp');
    assert.equal(row.job.id, String(job._id));
    assert.equal(row.recruiter.name, 'Zelda Vance');
    assert.equal(row.recruiter.jobTitle, 'Talent Acquisition Lead');
    assert.equal(row.recruiter.email, 'shape-owner@example.com');
  });

  it('falls back to the account email and profile data for legacy records', async () => {
    const admin = await makeUser('admin-legacy@example.com', 'admin');
    const recruiter = await makeRecruiter('legacy-owner@example.com', 'Grace Liu');
    const job = await Job.create({ ...baseJob(), postedBy: recruiter._id });
    const seeker = await makeJobseeker('legacy-seeker@example.com', 'Alan Turing', {
      phone: '+1-555-0100',
    });

    // A record created before the applicant fields existed.
    const legacy = await Application.create({
      jobId: job._id,
      userId: seeker._id,
      phone: '+1-555-0100',
      resumeUrl: '/uploads/resumes/legacy.pdf',
    });

    const res = await request('GET', '/api/admin/applications', {
      token: signTokenFor(admin),
    });

    assert.equal(res.status, 200);
    const row = res.body.applications[0];
    assert.equal(row.id, String(legacy._id));
    // The Overview field keeps its original fallback chain: name, then email.
    assert.equal(row.applicant, 'legacy-seeker@example.com');
    // The workspace email field resolves the same way.
    assert.equal(row.email, 'legacy-seeker@example.com');
    assert.equal(row.phone, '+1-555-0100');
    assert.equal(row.linkedin, '');
    assert.equal(row.portfolio, '');
  });

  it('reports a null recruiter rather than inventing one for an unowned job', async () => {
    const admin = await makeUser('admin-noowner@example.com', 'admin');
    const job = await Job.create(baseJob());
    const seeker = await makeJobseeker('noowner-seeker@example.com', 'No Owner');
    await applyAsJobseeker(signTokenFor(seeker), job._id);

    const res = await request('GET', '/api/admin/applications', {
      token: signTokenFor(admin),
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.applications[0].recruiter, null);
  });

  it('paginates with page/limit and reports totalPages', async () => {
    const admin = await makeUser('admin-pager@example.com', 'admin');
    const recruiter = await makeRecruiter('pager-owner@example.com', 'Owner');
    const job = await Job.create({ ...baseJob(), postedBy: recruiter._id });

    for (let i = 0; i < 5; i += 1) {
      const seeker = await makeJobseeker(`pager-seeker-${i}@example.com`, `Pager ${i}`);
      await applyAsJobseeker(signTokenFor(seeker), job._id, { fullName: `Pager ${i}` });
    }

    const page1 = await request('GET', '/api/admin/applications?limit=2&page=1', {
      token: signTokenFor(admin),
    });
    assert.equal(page1.body.total, 5);
    assert.equal(page1.body.totalPages, 3);
    assert.equal(page1.body.limit, 2);
    assert.equal(page1.body.applications.length, 2);
    // Newest first.
    assert.equal(page1.body.applications[0].applicant, 'Pager 4');

    const page3 = await request('GET', '/api/admin/applications?limit=2&page=3', {
      token: signTokenFor(admin),
    });
    assert.equal(page3.body.page, 3);
    assert.equal(page3.body.applications.length, 1);
    assert.equal(page3.body.applications[0].applicant, 'Pager 0');
  });

  it('rejects malformed pagination and filter values', async () => {
    const admin = await makeUser('admin-badquery@example.com', 'admin');
    const token = signTokenFor(admin);

    const badPage = await request('GET', '/api/admin/applications?page=abc', { token });
    assert.equal(badPage.status, 400);

    const badLimit = await request('GET', '/api/admin/applications?limit=500', { token });
    assert.equal(badLimit.status, 400);

    const badStatus = await request('GET', '/api/admin/applications?status=exploded', {
      token,
    });
    assert.equal(badStatus.status, 400);
    assert.match(badStatus.body.error, /Status must be one of/);

    const badJob = await request('GET', '/api/admin/applications?job=not-an-id', { token });
    assert.equal(badJob.status, 400);

    const badRecruiter = await request(
      'GET',
      '/api/admin/applications?recruiter=not-an-id',
      { token }
    );
    assert.equal(badRecruiter.status, 400);

    const badRange = await request('GET', '/api/admin/applications?dateRange=abc', { token });
    assert.equal(badRange.status, 400);
  });

  it('treats empty dropdown values as no filter', async () => {
    const admin = await makeUser('admin-empty@example.com', 'admin');
    const recruiter = await makeRecruiter('empty-owner@example.com', 'Owner');
    const job = await Job.create({ ...baseJob(), postedBy: recruiter._id });
    const seeker = await makeJobseeker('empty-seeker@example.com', 'Empty');
    await applyAsJobseeker(signTokenFor(seeker), job._id, { fullName: 'Empty' });

    // The workspace sends '' for an unfiltered dropdown.
    const res = await request(
      'GET',
      '/api/admin/applications?status=&job=&recruiter=&dateRange=&q=',
      { token: signTokenFor(admin) }
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
  });
});

describe('admin applications: filters', () => {
  const seedMixed = async () => {
    const admin = await makeUser('admin-filters@example.com', 'admin');

    const recruiterA = await makeRecruiter('filter-a@example.com', 'Olivia Bennett');
    const recruiterB = await makeRecruiter('filter-b@example.com', 'Marcus Webb');
    // Two jobs for recruiterA so one applicant can hold two applications
    // without tripping the unique {jobId, userId} index.
    const jobA1 = await Job.create({
      ...baseJob({ title: 'Frontend Engineer', company: 'Stark Industries' }),
      postedBy: recruiterA._id,
    });
    const jobA2 = await Job.create({
      ...baseJob({ title: 'UI Engineer', company: 'Stark Industries' }),
      postedBy: recruiterA._id,
    });
    const jobB = await Job.create({
      ...baseJob({ title: 'Backend Engineer', company: 'LexCorp' }),
      postedBy: recruiterB._id,
    });

    const ada = await makeJobseeker('filter-ada@example.com', 'Sarah Johnson', {
      location: 'New York, NY',
    });
    const grace = await makeJobseeker('filter-grace@example.com', 'Grace Liu', {
      location: 'Boston, MA',
    });

    const a1 = await applyAsJobseeker(signTokenFor(ada), jobA1._id, {
      fullName: 'Sarah Johnson',
      email: 'sarah.johnson@email.com',
    });
    const a2 = await applyAsJobseeker(signTokenFor(ada), jobA2._id, {
      fullName: 'Sarah Johnson',
      email: 'sarah.johnson@email.com',
    });
    const b1 = await applyAsJobseeker(signTokenFor(grace), jobB._id, {
      fullName: 'Grace Liu',
      email: 'grace.liu@email.com',
    });

    await Application.updateOne({ _id: a2._id }, { $set: { status: 'interview' } });

    return { admin, recruiterA, recruiterB, jobA1, jobA2, jobB, a1, a2, b1 };
  };

  it('searches applicant name, applicant email, job title, company, and recruiter', async () => {
    const { admin, recruiterB } = await seedMixed();
    const token = signTokenFor(admin);

    const byName = await request(
      'GET',
      `/api/admin/applications?q=${encodeURIComponent('Grace')}`,
      { token }
    );
    assert.equal(byName.body.total, 1);
    assert.equal(byName.body.applications[0].applicant, 'Grace Liu');

    const byEmail = await request(
      'GET',
      `/api/admin/applications?q=${encodeURIComponent('sarah.johnson@email.com')}`,
      { token }
    );
    assert.equal(byEmail.body.total, 2);

    const byJobTitle = await request(
      'GET',
      `/api/admin/applications?q=${encodeURIComponent('Backend')}`,
      { token }
    );
    assert.equal(byJobTitle.body.total, 1);
    assert.equal(byJobTitle.body.applications[0].jobTitle, 'Backend Engineer');

    const byCompany = await request(
      'GET',
      `/api/admin/applications?q=${encodeURIComponent('Stark')}`,
      { token }
    );
    assert.equal(byCompany.body.total, 2);

    // Recruiter name resolves through the jobs that recruiter posted.
    const byRecruiter = await request(
      'GET',
      `/api/admin/applications?q=${encodeURIComponent('Marcus Webb')}`,
      { token }
    );
    assert.equal(byRecruiter.body.total, 1);
    assert.equal(byRecruiter.body.applications[0].company, 'LexCorp');
    assert.equal(recruiterB.role, 'recruiter');
  });

  it('matches a profile name when the application record has no stored name', async () => {
    const admin = await makeUser('admin-profsearch@example.com', 'admin');
    const recruiter = await makeRecruiter('profsearch-owner@example.com', 'Owner');
    const job = await Job.create({ ...baseJob(), postedBy: recruiter._id });
    const seeker = await makeJobseeker('profsearch-seeker@example.com', 'Katherine Johnson');

    // No fullName/email on the document — only the profile knows the name.
    await applyAsJobseeker(signTokenFor(seeker), job._id);

    const res = await request(
      'GET',
      `/api/admin/applications?q=${encodeURIComponent('Katherine')}`,
      { token: signTokenFor(admin) }
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
  });

  it('returns nothing for a search that matches no one', async () => {
    const { admin } = await seedMixed();

    const res = await request(
      'GET',
      `/api/admin/applications?q=${encodeURIComponent('zzzznotfound')}`,
      { token: signTokenFor(admin) }
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 0);
    assert.deepEqual(res.body.applications, []);
  });

  it('filters by canonical application status', async () => {
    const { admin, a1, a2, b1 } = await seedMixed();
    const token = signTokenFor(admin);

    const applied = await request('GET', '/api/admin/applications?status=applied', { token });
    assert.equal(applied.body.total, 2);
    assert.ok(applied.body.applications.every((a) => a.status === 'applied'));

    const interview = await request('GET', '/api/admin/applications?status=interview', {
      token,
    });
    assert.equal(interview.body.total, 1);
    assert.equal(String(interview.body.applications[0].id), String(a2._id));

    // 'all' is the workspace's "All statuses" sentinel and must not filter.
    const all = await request('GET', '/api/admin/applications?status=all', { token });
    assert.equal(all.body.total, 3);

    assert.equal(String(a1._id) !== String(b1._id), true);
  });

  it('filters by job id', async () => {
    const { admin, jobA1, jobA2, jobB } = await seedMixed();
    const token = signTokenFor(admin);

    const byA1 = await request('GET', `/api/admin/applications?job=${jobA1._id}`, { token });
    assert.equal(byA1.body.total, 1);
    assert.equal(byA1.body.applications[0].jobTitle, 'Frontend Engineer');

    const byA2 = await request('GET', `/api/admin/applications?job=${jobA2._id}`, { token });
    assert.equal(byA2.body.total, 1);
    assert.equal(byA2.body.applications[0].status, 'interview');

    const byB = await request('GET', `/api/admin/applications?job=${jobB._id}`, { token });
    assert.equal(byB.body.total, 1);
  });

  it('filters by recruiter, resolving to the jobs that recruiter posted', async () => {
    const { admin, recruiterA, recruiterB } = await seedMixed();
    const token = signTokenFor(admin);

    const byA = await request(
      'GET',
      `/api/admin/applications?recruiter=${recruiterA._id}`,
      { token }
    );
    assert.equal(byA.body.total, 2);
    assert.ok(byA.body.applications.every((a) => a.company === 'Stark Industries'));

    const byB = await request(
      'GET',
      `/api/admin/applications?recruiter=${recruiterB._id}`,
      { token }
    );
    assert.equal(byB.body.total, 1);
  });

  it('returns an empty page for a recruiter who has posted no jobs', async () => {
    const { admin } = await seedMixed();
    const idle = await makeRecruiter('idle-recruiter@example.com', 'Idle Recruiter');

    const res = await request(
      'GET',
      `/api/admin/applications?recruiter=${idle._id}`,
      { token: signTokenFor(admin) }
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 0);
    assert.deepEqual(res.body.applications, []);
  });

  it('filters by date range including today', async () => {
    const admin = await makeUser('admin-dates@example.com', 'admin');
    const recruiter = await makeRecruiter('dates-owner@example.com', 'Owner');
    const job = await Job.create({ ...baseJob(), postedBy: recruiter._id });

    const old = await makeJobseeker('dates-old@example.com', 'Old Applicant');
    const recent = await makeJobseeker('dates-recent@example.com', 'Recent Applicant');

    const oldApp = await applyAsJobseeker(signTokenFor(old), job._id, {
      fullName: 'Old Applicant',
    });
    await backdate(Application, oldApp._id, 45);
    const recentApp = await applyAsJobseeker(signTokenFor(recent), job._id, {
      fullName: 'Recent Applicant',
    });

    const token = signTokenFor(admin);

    const last7 = await request('GET', '/api/admin/applications?dateRange=7', { token });
    assert.equal(last7.body.total, 1);
    assert.equal(last7.body.applications[0].applicant, 'Recent Applicant');

    const last30 = await request('GET', '/api/admin/applications?dateRange=30', { token });
    assert.equal(last30.body.total, 1);

    const last90 = await request('GET', '/api/admin/applications?dateRange=90', { token });
    assert.equal(last90.body.total, 2);

    const today = await request('GET', '/api/admin/applications?dateRange=today', { token });
    assert.equal(today.body.total, 1);
    assert.equal(today.body.applications[0].applicant, 'Recent Applicant');
    assert.ok(recentApp._id);
  });

  it('combines filters', async () => {
    const { admin, jobA1 } = await seedMixed();
    const token = signTokenFor(admin);

    const combined = await request(
      'GET',
      `/api/admin/applications?job=${jobA1._id}&status=applied&dateRange=90&q=${encodeURIComponent('Sarah')}`,
      { token }
    );
    assert.equal(combined.body.total, 1);
    assert.equal(combined.body.applications[0].applicant, 'Sarah Johnson');

    const contradictory = await request(
      'GET',
      `/api/admin/applications?job=${jobA1._id}&status=hired`,
      { token }
    );
    assert.equal(contradictory.body.total, 0);
  });
});

describe('admin applications: detail', () => {
  it('returns the applicant, job, recruiter, status, and application data', async () => {
    const admin = await makeUser('admin-detail@example.com', 'admin');
    const recruiter = await makeRecruiter('detail-owner@example.com', 'Priya Sharma');
    const job = await Job.create({
      ...baseJob({ title: 'Frontend Engineer', company: 'LexCorp' }),
      postedBy: recruiter._id,
    });
    const seeker = await makeJobseeker('detail-seeker@example.com', 'Ada Lovelace', {
      location: 'London, UK',
      headline: 'Senior Frontend Engineer',
      skills: ['React'],
    });

    const created = await applyAsJobseeker(signTokenFor(seeker), job._id, {
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '+44 20 7946 0000',
      coverLetter: 'I am a great fit.',
      linkedin: 'https://linkedin.com/in/ada',
      portfolio: 'https://ada.dev',
    });

    const res = await request('GET', `/api/admin/applications/${created._id}`, {
      token: signTokenFor(admin),
    });

    assert.equal(res.status, 200);
    const app = res.body.application;

    assert.equal(app.id, created._id);
    assert.equal(app.status, 'applied');
    assert.ok(app.appliedAt);
    assert.equal(app.coverLetter, 'I am a great fit.');

    assert.equal(app.applicant.fullName, 'Ada Lovelace');
    assert.equal(app.applicant.email, 'ada@example.com');
    assert.equal(app.applicant.phone, '+44 20 7946 0000');
    assert.equal(app.applicant.location, 'London, UK');
    assert.equal(app.applicant.headline, 'Senior Frontend Engineer');
    assert.equal(app.applicant.resumeUrl, '/uploads/resumes/jane.pdf');
    assert.equal(app.applicant.linkedin, 'https://linkedin.com/in/ada');
    assert.equal(app.applicant.portfolio, 'https://ada.dev');
    assert.deepEqual(app.applicant.skills, ['React']);

    assert.equal(app.job.id, String(job._id));
    assert.equal(app.job.title, 'Frontend Engineer');
    assert.equal(app.job.company, 'LexCorp');
    assert.equal(app.job.employmentType, 'Full-time');

    assert.equal(app.recruiter.name, 'Priya Sharma');
    assert.equal(app.recruiter.email, 'detail-owner@example.com');
  });

  it('is admin-scoped and does not require job ownership', async () => {
    const admin = await makeUser('admin-scope@example.com', 'admin');
    const recruiter = await makeRecruiter('scope-owner@example.com', 'Owner');
    const job = await Job.create({ ...baseJob(), postedBy: recruiter._id });
    const seeker = await makeJobseeker('scope-seeker@example.com', 'Seeker');
    const created = await applyAsJobseeker(signTokenFor(seeker), job._id);

    // The admin posted no jobs, yet can read the detail.
    const res = await request('GET', `/api/admin/applications/${created._id}`, {
      token: signTokenFor(admin),
    });
    assert.equal(res.status, 200);
  });

  it('404s for a missing application and 400s for a malformed id', async () => {
    const admin = await makeUser('admin-detail-miss@example.com', 'admin');
    const token = signTokenFor(admin);

    const missing = await request('GET', `/api/admin/applications/${MISSING_ID}`, {
      token,
    });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error, 'Application not found');

    const malformed = await request('GET', '/api/admin/applications/not-an-id', { token });
    assert.equal(malformed.status, 400);
  });
});

describe('admin applications: status moderation', () => {
  it('updates the status and returns the normalized application', async () => {
    const admin = await makeUser('admin-mod@example.com', 'admin');
    const recruiter = await makeRecruiter('mod-owner@example.com', 'Owner');
    const job = await Job.create({ ...baseJob(), postedBy: recruiter._id });
    const seeker = await makeJobseeker('mod-seeker@example.com', 'Seeker');
    const created = await applyAsJobseeker(signTokenFor(seeker), job._id, {
      fullName: 'Seeker',
    });

    const res = await request(
      'PATCH',
      `/api/admin/applications/${created._id}/status`,
      { token: signTokenFor(admin), body: { status: 'under-review' } }
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.application.status, 'under-review');
    assert.equal(res.body.application.id, created._id);
    assert.equal(res.body.application.applicant, 'Seeker');
    assert.equal(res.body.application.jobTitle, 'Software Engineer');
    assert.equal(res.body.application.recruiter.name, 'Owner');

    // The write is persisted, not just echoed.
    const stored = await Application.findById(created._id).lean();
    assert.equal(stored.status, 'under-review');
  });

  it('accepts every canonical status value', async () => {
    const admin = await makeUser('admin-mod-all@example.com', 'admin');
    const recruiter = await makeRecruiter('modall-owner@example.com', 'Owner');
    const job = await Job.create({ ...baseJob(), postedBy: recruiter._id });
    const seeker = await makeJobseeker('modall-seeker@example.com', 'Seeker');
    const created = await applyAsJobseeker(signTokenFor(seeker), job._id);
    const token = signTokenFor(admin);

    for (const status of [
      'applied',
      'under-review',
      'interview',
      'offer',
      'hired',
      'rejected',
    ]) {
      const res = await request(
        'PATCH',
        `/api/admin/applications/${created._id}/status`,
        { token, body: { status } }
      );
      assert.equal(res.status, 200, `status ${status} should be accepted`);
      assert.equal(res.body.application.status, status);
    }
  });

  it('rejects a status outside the canonical enum', async () => {
    const admin = await makeUser('admin-mod-bad@example.com', 'admin');
    const job = await Job.create(baseJob());
    const seeker = await makeJobseeker('modbad-seeker@example.com', 'Seeker');
    const created = await applyAsJobseeker(signTokenFor(seeker), job._id);

    for (const status of ['shortlisted', 'new', 'reviewing', 'exploded', 'ACTIVE']) {
      const res = await request(
        'PATCH',
        `/api/admin/applications/${created._id}/status`,
        { token: signTokenFor(admin), body: { status } }
      );
      assert.equal(res.status, 400, `status ${status} must be rejected`);
      assert.match(res.body.error, /Status must be one of/);
    }

    // Nothing was written.
    const stored = await Application.findById(created._id).lean();
    assert.equal(stored.status, 'applied');
  });

  it('rejects a missing or empty status', async () => {
    const admin = await makeUser('admin-mod-empty@example.com', 'admin');
    const job = await Job.create(baseJob());
    const seeker = await makeJobseeker('modempty-seeker@example.com', 'Seeker');
    const created = await applyAsJobseeker(signTokenFor(seeker), job._id);
    const token = signTokenFor(admin);

    const noStatus = await request(
      'PATCH',
      `/api/admin/applications/${created._id}/status`,
      { token, body: {} }
    );
    assert.equal(noStatus.status, 400);

    const emptyStatus = await request(
      'PATCH',
      `/api/admin/applications/${created._id}/status`,
      { token, body: { status: '' } }
    );
    assert.equal(emptyStatus.status, 400);
  });

  it('404s a missing application and 400s a malformed id', async () => {
    const admin = await makeUser('admin-mod-miss@example.com', 'admin');
    const token = signTokenFor(admin);

    const missing = await request('PATCH', `/api/admin/applications/${MISSING_ID}/status`, {
      token,
      body: { status: 'interview' },
    });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error, 'Application not found');

    const malformed = await request('PATCH', '/api/admin/applications/not-an-id/status', {
      token,
      body: { status: 'interview' },
    });
    assert.equal(malformed.status, 400);
  });

  it('does not write RecruiterActivity records', async () => {
    const admin = await makeUser('admin-mod-activity@example.com', 'admin');
    const recruiter = await makeRecruiter('modact-owner@example.com', 'Owner');
    const job = await Job.create({ ...baseJob(), postedBy: recruiter._id });
    const seeker = await makeJobseeker('modact-seeker@example.com', 'Seeker');
    const created = await applyAsJobseeker(signTokenFor(seeker), job._id);

    const before = await RecruiterActivity.countDocuments({});
    assert.equal(before, 0);

    const res = await request(
      'PATCH',
      `/api/admin/applications/${created._id}/status`,
      { token: signTokenFor(admin), body: { status: 'interview' } }
    );
    assert.equal(res.status, 200);

    // No activity row, and specifically none attributing the change to the
    // job's real recruiter.
    const after = await RecruiterActivity.countDocuments({});
    assert.equal(after, 0);
    const attributed = await RecruiterActivity.find({ recruiterId: recruiter._id }).lean();
    assert.equal(attributed.length, 0);
  });

  it('leaves an existing recruiter activity history untouched', async () => {
    const admin = await makeUser('admin-mod-preserve@example.com', 'admin');
    const recruiter = await makeRecruiter('modpres-owner@example.com', 'Owner');
    const job = await Job.create({ ...baseJob(), postedBy: recruiter._id });
    const seeker = await makeJobseeker('modpres-seeker@example.com', 'Seeker');
    const created = await applyAsJobseeker(signTokenFor(seeker), job._id);

    // A recruiter moves the application, producing one activity event.
    const recruiterPatch = await request(
      'PATCH',
      `/api/applications/${created._id}/status`,
      { token: signTokenFor(recruiter), body: { status: 'under-review' } }
    );
    assert.equal(recruiterPatch.status, 200);

    const before = await RecruiterActivity.find({ applicationId: created._id })
      .sort({ createdAt: 1 })
      .lean();
    assert.equal(before.length, 1);

    // The admin moderates the same application.
    const adminPatch = await request(
      'PATCH',
      `/api/admin/applications/${created._id}/status`,
      { token: signTokenFor(admin), body: { status: 'offer' } }
    );
    assert.equal(adminPatch.status, 200);
    assert.equal(adminPatch.body.application.status, 'offer');

    // The recruiter's history is neither added to nor rewritten.
    const after = await RecruiterActivity.find({ applicationId: created._id })
      .sort({ createdAt: 1 })
      .lean();
    assert.equal(after.length, 1);
    assert.equal(String(after[0]._id), String(before[0]._id));
    assert.equal(after[0].previousStatus, before[0].previousStatus);
    assert.equal(after[0].newStatus, before[0].newStatus);
  });
});

describe('admin applicant profile', () => {
  it('returns the real jobseeker profile for View Profile', async () => {
    const admin = await makeUser('admin-profile@example.com', 'admin');
    const recruiter = await makeRecruiter('profile-owner@example.com', 'Owner');
    const job = await Job.create({ ...baseJob(), postedBy: recruiter._id });
    const seeker = await makeJobseeker('profile-seeker@example.com', 'Ada Lovelace', {
      location: 'London, UK',
      headline: 'Senior Frontend Engineer',
      bio: 'Builds interfaces.',
    });
    await Profile.updateOne(
      { userId: seeker._id },
      {
        $set: {
          skills: ['React', 'TypeScript'],
          resumeUrl: '/uploads/resumes/ada.pdf',
          resumeName: 'ada.pdf',
          links: [{ label: 'Portfolio', url: 'https://ada.dev' }],
          experience: [
            { company: 'Acme', title: 'Engineer', startDate: new Date('2022-01-01'), current: true },
          ],
          education: [{ school: 'Cambridge', degree: 'BSc', endDate: new Date('2021-06-01') }],
        },
      }
    );

    const created = await applyAsJobseeker(signTokenFor(seeker), job._id, {
      fullName: 'Ada Lovelace',
    });
    assert.equal(created.status, 'applied');

    const res = await request('GET', `/api/admin/jobseekers/${seeker._id}`, {
      token: signTokenFor(admin),
    });

    assert.equal(res.status, 200);
    const js = res.body.jobseeker;
    assert.equal(js.id, String(seeker._id));
    assert.equal(js.email, 'profile-seeker@example.com');
    assert.equal(js.profileExists, true);
    assert.equal(js.fullName, 'Ada Lovelace');
    assert.equal(js.headline, 'Senior Frontend Engineer');
    assert.equal(js.bio, 'Builds interfaces.');
    assert.equal(js.location, 'London, UK');
    assert.deepEqual(js.skills, ['React', 'TypeScript']);
    assert.equal(js.resumeUrl, '/uploads/resumes/ada.pdf');
    assert.equal(js.applications, 1);
    assert.ok(js.joinedAt);
    assert.equal(js.experience.length, 1);
    assert.equal(js.education.length, 1);
    assert.equal(js.links.length, 1);
  });

  it('refuses non-admins and unauthenticated callers', async () => {
    const recruiter = await makeRecruiter('profile-denied@example.com', 'Denied');
    const seeker = await makeJobseeker('profile-target@example.com', 'Target');

    const anon = await request('GET', `/api/admin/jobseekers/${seeker._id}`);
    assert.equal(anon.status, 401);

    const asRecruiter = await request('GET', `/api/admin/jobseekers/${seeker._id}`, {
      token: signTokenFor(recruiter),
    });
    assert.equal(asRecruiter.status, 403);
  });

  it('404s an unknown user and 400s a malformed id', async () => {
    const admin = await makeUser('admin-profile-miss@example.com', 'admin');
    const token = signTokenFor(admin);

    const missing = await request('GET', `/api/admin/jobseekers/${MISSING_ID}`, { token });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error, 'Jobseeker not found');

    const malformed = await request('GET', '/api/admin/jobseekers/not-an-id', { token });
    assert.equal(malformed.status, 400);
  });

  // Registration creates the User while the Profile is filled in later, so many
  // applicants who have applied have no profile row at all.
  it('404s a jobseeker account that has no Profile row, and does not list it either', async () => {
    // An account whose User.role is 'jobseeker' but which never got a Profile
    // (registration creates both together and rolls the User back on failure,
    // so this is an edge case). It is not a jobseeker workspace record, so the
    // detail endpoint 404s and the Jobseekers workspace does not list it —
    // list and detail must agree.
    const admin = await makeUser('admin-noprofile@example.com', 'admin');
    const recruiter = await makeRecruiter('noprofile-owner@example.com', 'Owner');
    const job = await Job.create({ ...baseJob(), postedBy: recruiter._id });
    const seeker = await makeUser('noprofile-seeker@example.com', 'jobseeker');
    await applyAsJobseeker(signTokenFor(seeker), job._id, { fullName: 'No Profile Yet' });

    const res = await request('GET', `/api/admin/jobseekers/${seeker._id}`, {
      token: signTokenFor(admin),
    });
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Jobseeker not found');

    // And it is absent from the workspace list, so no listed row can 404.
    const list = await request('GET', '/api/admin/jobseekers', {
      token: signTokenFor(admin),
    });
    assert.equal(list.status, 200);
    assert.equal(
      list.body.jobseekers.some((j) => String(j.id) === String(seeker._id)),
      false
    );
  });

  // An admin account can never hold an application (applying is jobseeker-only),
  // so it is never an applicant and must stay unreadable here.
  it('does not expose an admin account through this route', async () => {
    const admin = await makeUser('admin-profile-self@example.com', 'admin');
    const token = signTokenFor(admin);

    const own = await request('GET', `/api/admin/jobseekers/${admin._id}`, { token });
    assert.equal(own.status, 404);
    assert.equal(own.body.error, 'Jobseeker not found');
  });
});

// ---------------------------------------------------------------------------
// The real-account scenario, end to end.
//
// Reproduces a person who registers as a jobseeker, fills in a profile, applies
// to jobs, then opens the recruiter workspace. Their jobseeker profile must
// survive untouched, and an admin inspecting them must still see it.
//
// This is the behaviour the old destructive toggle broke: it rewrote the single
// Profile's role and `$unset` headline/bio/skills/education/experience/links,
// permanently deleting the applicant profile on first switch.
// ---------------------------------------------------------------------------
describe('admin applicant profile: account opened the recruiter workspace', () => {
  it('still returns the intact jobseeker profile while recruiter is active', async () => {
    const admin = await makeUser('admin-switched@example.com', 'admin');
    const owner = await makeRecruiter('switched-owner@example.com', 'Owner');
    const job = await Job.create({ ...baseJob(), postedBy: owner._id });

    // 1. Registers as a jobseeker with a full applicant profile.
    const passwordHash = await bcrypt.hash('password123', 4);
    const person = await User.create({
      email: 'switched-seeker@example.com',
      passwordHash,
      role: 'jobseeker',
    });
    await Profile.create({
      userId: person._id,
      role: 'jobseeker',
      fullName: 'Real Account',
      phone: '+1 555 010 4321',
      headline: 'Backend Engineer',
      skills: ['Node.js'],
      location: 'Remote',
    });

    // 2. Applies while still a jobseeker.
    const created = await applyAsJobseeker(signTokenFor(person), job._id, {
      fullName: 'Real Account',
      email: 'switched-seeker@example.com',
    });
    assert.equal(created.status, 'applied');

    // 3. Opens the recruiter workspace through the real endpoint.
    const switched = await request('POST', '/api/auth/role', {
      token: signTokenFor(person),
      body: { role: 'recruiter' },
    });
    assert.equal(switched.status, 200);
    assert.equal(switched.body.user.role, 'recruiter');

    // 4. An admin inspecting the applicant sees the jobseeker profile intact,
    //    even though the active workspace is recruiter.
    const res = await request('GET', `/api/admin/jobseekers/${person._id}`, {
      token: signTokenFor(admin),
    });

    assert.equal(res.status, 200);
    const js = res.body.jobseeker;
    assert.equal(js.id, String(person._id));
    assert.equal(js.email, 'switched-seeker@example.com');
    // The active workspace is reported truthfully...
    assert.equal(js.activeWorkspace, 'recruiter');
    assert.equal(js.isActiveJobseeker, false);
    assert.deepEqual(js.availableWorkspaces.sort(), ['jobseeker', 'recruiter']);
    // ...but the jobseeker profile is neither hidden nor destroyed.
    assert.equal(js.profileExists, true);
    assert.equal(js.headline, 'Backend Engineer');
    assert.deepEqual(js.skills, ['Node.js']);
    assert.equal(js.fullName, 'Real Account');
    assert.equal(js.phone, '+1 555 010 4321');
    assert.equal(js.location, 'Remote');
    assert.equal(js.applications, 1);

    // 5. Switching back restores access and still shows the same profile.
    const back = await request('POST', '/api/auth/role', {
      token: switched.body.token,
      body: { role: 'jobseeker' },
    });
    assert.equal(back.status, 200);
    assert.equal(back.body.user.role, 'jobseeker');
    assert.equal(back.body.user.workspaces.includes('recruiter'), true);

    const after = await request('GET', `/api/admin/jobseekers/${person._id}`, {
      token: signTokenFor(admin),
    });
    assert.equal(after.body.jobseeker.headline, 'Backend Engineer');
    assert.deepEqual(after.body.jobseeker.skills, ['Node.js']);
  });

  it('never exposes recruiter-only profile fields for a dual-workspace account', async () => {
    const admin = await makeUser('admin-switched-fields@example.com', 'admin');
    const passwordHash = await bcrypt.hash('password123', 4);
    const person = await User.create({
      email: 'switched-fields@example.com',
      passwordHash,
      role: 'jobseeker',
    });
    await Profile.create({
      userId: person._id,
      role: 'jobseeker',
      fullName: 'Field Check',
      phone: '+1 555 010 1111',
      headline: 'Data Analyst',
    });
    const owner = await makeRecruiter('switched-fields-owner@example.com', 'Owner');
    const job = await Job.create({ ...baseJob(), postedBy: owner._id });
    await applyAsJobseeker(signTokenFor(person), job._id, { fullName: 'Field Check' });

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
    const serialized = JSON.stringify(res.body);
    assert.equal(res.body.jobseeker.companyName, undefined);
    assert.equal(res.body.jobseeker.jobTitle, undefined);
    assert.equal(serialized.includes('Secret Corp'), false);
    assert.equal(serialized.includes('Head Hunter'), false);
    // The jobseeker side is what this endpoint reports on.
    assert.equal(res.body.jobseeker.headline, 'Data Analyst');
    assert.equal(res.body.jobseeker.activeWorkspace, 'recruiter');
  });

  it('still 404s a recruiter account that has never applied', async () => {
    const admin = await makeUser('admin-pure-rec@example.com', 'admin');
    const recruiter = await makeRecruiter('pure-rec@example.com', 'Pure Recruiter');

    const res = await request('GET', `/api/admin/jobseekers/${recruiter._id}`, {
      token: signTokenFor(admin),
    });
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Jobseeker not found');
  });
});

describe('recruiter application behavior is unchanged', () => {
  it('still enforces job ownership on the recruiter status endpoint', async () => {
    const owner = await makeRecruiter('owner@example.com', 'Owner');
    const intruder = await makeRecruiter('intruder@example.com', 'Intruder');
    const job = await Job.create({ ...baseJob(), postedBy: owner._id });
    const seeker = await makeJobseeker('seeker@example.com', 'Seeker');
    const created = await applyAsJobseeker(signTokenFor(seeker), job._id);

    const forbidden = await request(
      'PATCH',
      `/api/applications/${created._id}/status`,
      { token: signTokenFor(intruder), body: { status: 'interview' } }
    );
    assert.equal(forbidden.status, 403);

    const stored = await Application.findById(created._id).lean();
    assert.equal(stored.status, 'applied');
  });

  it('still records recruiter activity and rejects a non-canonical status', async () => {
    const owner = await makeRecruiter('rec-owner@example.com', 'Owner');
    const job = await Job.create({ ...baseJob(), postedBy: owner._id });
    const seeker = await makeJobseeker('rec-seeker@example.com', 'Seeker');
    const created = await applyAsJobseeker(signTokenFor(seeker), job._id);
    const token = signTokenFor(owner);

    const ok = await request('PATCH', `/api/applications/${created._id}/status`, {
      token,
      body: { status: 'under-review' },
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.status, 'under-review');

    const events = await RecruiterActivity.find({ applicationId: created._id }).lean();
    assert.equal(events.length, 1);
    assert.equal(events[0].previousStatus, 'applied');
    assert.equal(events[0].newStatus, 'under-review');
    assert.equal(String(events[0].recruiterId), String(owner._id));

    // The recruiter endpoint enforces the same canonical enum.
    const bad = await request('PATCH', `/api/applications/${created._id}/status`, {
      token,
      body: { status: 'shortlisted' },
    });
    assert.equal(bad.status, 400);
  });

  it('still lets a recruiter read their own application detail but not another', async () => {
    const owner = await makeRecruiter('detailrec-owner@example.com', 'Owner');
    const intruder = await makeRecruiter('detailrec-intruder@example.com', 'Intruder');
    const job = await Job.create({ ...baseJob(), postedBy: owner._id });
    const seeker = await makeJobseeker('detailrec-seeker@example.com', 'Seeker');
    const created = await applyAsJobseeker(signTokenFor(seeker), job._id);

    const allowed = await request('GET', `/api/applications/${created._id}`, {
      token: signTokenFor(owner),
    });
    assert.equal(allowed.status, 200);

    const forbidden = await request('GET', `/api/applications/${created._id}`, {
      token: signTokenFor(intruder),
    });
    assert.equal(forbidden.status, 403);
  });

  it('does not let a recruiter reach the admin applications routes', async () => {
    const recruiter = await makeRecruiter('reach@example.com', 'Reach');
    const job = await Job.create({ ...baseJob(), postedBy: recruiter._id });
    const seeker = await makeJobseeker('reach-seeker@example.com', 'Seeker');
    const created = await applyAsJobseeker(signTokenFor(seeker), job._id);
    const token = signTokenFor(recruiter);

    assert.equal((await request('GET', '/api/admin/applications', { token })).status, 403);
    assert.equal(
      (await request('GET', `/api/admin/applications/${created._id}`, { token })).status,
      403
    );
    assert.equal(
      (
        await request('PATCH', `/api/admin/applications/${created._id}/status`, {
          token,
          body: { status: 'interview' },
        })
      ).status,
      403
    );
  });
});
