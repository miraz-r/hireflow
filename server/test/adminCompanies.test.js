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
const TEST_DB_NAME = 'hireflow_test_admin_companies';

let server;
let baseUrl;

const makeUser = async (email, role = 'recruiter') => {
  const passwordHash = await bcrypt.hash('password123', 4);
  return User.create({ email, passwordHash, role });
};

// A recruiter-only account that names its employer in `companyName`, which is
// what makes the company exist at all.
const makeRecruiter = async (email, fullName, companyName, extra = {}) => {
  const user = await makeUser(email, 'recruiter');
  await Profile.create({
    userId: user._id,
    role: 'recruiter',
    fullName,
    phone: '+1-555-0100',
    companyName,
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

// Switch the active workspace through the real endpoint. Non-destructive: it
// only changes User.role and ensures a profile row exists for the target
// workspace, so the recruiter profile survives.
const switchWorkspace = async (token, role) => {
  const res = await request('POST', '/api/auth/role', { token, body: { role } });
  assert.equal(res.status, 200, res.raw);
  return res.body;
};

const applyAsJobseeker = async (token, jobId, body = {}) => {
  const res = await request('POST', '/api/applications', {
    token,
    body: { jobId, phone: '+1-555-0199', resumeUrl: '/uploads/resumes/cv.pdf', ...body },
  });
  assert.equal(res.status, 201, res.raw);
  return res.body;
};

const listCompanies = async (token, query = '') => {
  const res = await request('GET', `/api/admin/companies${query}`, { token });
  assert.equal(res.status, 200, res.raw);
  return res.body;
};

const rowsByName = (body) =>
  new Map((body.companies || []).map((c) => [c.name, c]));

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
describe('admin companies list: authentication and authorization', () => {
  it('requires a token', async () => {
    const res = await request('GET', '/api/admin/companies');
    assert.equal(res.status, 401);
  });

  it('rejects non-admin roles', async () => {
    const jobseeker = await makeJobseeker('denied-seeker@example.com', 'Denied Seeker');
    const recruiter = await makeRecruiter('denied-rec@example.com', 'Denied Rec', 'Acme Corp');

    const asJobseeker = await request('GET', '/api/admin/companies', {
      token: signTokenFor(jobseeker),
    });
    assert.equal(asJobseeker.status, 403);

    const asRecruiter = await request('GET', '/api/admin/companies', {
      token: signTokenFor(recruiter),
    });
    assert.equal(asRecruiter.status, 403);
  });

  it('serves an admin token', async () => {
    const admin = await makeUser('admin-ok@example.com', 'admin');
    const res = await request('GET', '/api/admin/companies', { token: signTokenFor(admin) });
    assert.equal(res.status, 200);
  });
});

// ---------------------------------------------------------------------------
describe('admin companies list: query validation', () => {
  const adminToken = async (email) => signTokenFor(await makeUser(email, 'admin'));

  it('rejects a malformed ?page', async () => {
    const token = await adminToken('v-page@example.com');
    const res = await request('GET', '/api/admin/companies?page=abc', { token });
    assert.equal(res.status, 400);
  });

  it('rejects a non-positive ?page', async () => {
    const token = await adminToken('v-page0@example.com');
    const res = await request('GET', '/api/admin/companies?page=0', { token });
    assert.equal(res.status, 400);
  });

  it('rejects an out-of-range ?limit', async () => {
    const token = await adminToken('v-limit@example.com');
    const res = await request('GET', '/api/admin/companies?limit=500', { token });
    assert.equal(res.status, 400);
  });

  it('rejects a malformed ?dateRange', async () => {
    const token = await adminToken('v-range@example.com');
    const res = await request('GET', '/api/admin/companies?dateRange=abc', { token });
    assert.equal(res.status, 400);
  });

  it('rejects an over-long ?q', async () => {
    const token = await adminToken('v-q@example.com');
    const res = await request('GET', `/api/admin/companies?q=${'a'.repeat(201)}`, { token });
    assert.equal(res.status, 400);
  });

  it('ignores a status or industry filter, since neither field exists', async () => {
    const token = await adminToken('v-status@example.com');
    await makeRecruiter('status-filter@example.com', 'R', 'Acme Corp');

    // No company record holds a status or an industry, so these can never
    // filter. They are inert rather than errors: no validator claims them, and
    // this endpoint never reads them, so the response is the unfiltered list.
    // The page does not send them at all.
    const unfiltered = await listCompanies(token);
    const withStatus = await listCompanies(token, '?status=active');
    const withIndustry = await listCompanies(token, '?industry=Tech');

    assert.equal(withStatus.total, unfiltered.total);
    assert.equal(withIndustry.total, unfiltered.total);
    assert.equal(withStatus.total, 1);
  });

  it('treats empty filter values as no filter', async () => {
    const token = await adminToken('v-empty@example.com');
    await makeRecruiter('empty-filter@example.com', 'Empty Filter', 'Acme Corp');
    const res = await request('GET', '/api/admin/companies?dateRange=&q=', { token });
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
  });
});

// ---------------------------------------------------------------------------
describe('admin companies list: derivation from recruiter profiles', () => {
  it('lists a company named by a recruiter profile', async () => {
    const admin = await makeUser('admin-source@example.com', 'admin');
    await makeRecruiter('src-1@example.com', 'Ada Lovelace', 'Acme Corp', {
      jobTitle: 'Talent Lead',
      companyWebsite: 'https://acme.example.com',
    });

    const body = await listCompanies(signTokenFor(admin));

    assert.equal(body.total, 1);
    const row = body.companies[0];
    assert.equal(row.id, 'Acme Corp');
    assert.equal(row.name, 'Acme Corp');
    assert.equal(row.companyWebsite, 'https://acme.example.com');
    assert.equal(row.recruiters, 1);
    assert.equal(row.jobs, 0);
    assert.equal(row.applications, 0);
    assert.ok(row.joinedAt, 'joinedAt must be a real timestamp');
    assert.equal(row.primaryContact.name, 'Ada Lovelace');
    assert.equal(row.primaryContact.jobTitle, 'Talent Lead');
    assert.equal(row.primaryContact.email, 'src-1@example.com');
  });

  it('exposes no status, industry, or fabricated domain', async () => {
    const admin = await makeUser('admin-nofields@example.com', 'admin');
    await makeRecruiter('nofields@example.com', 'No Fields', 'Acme Corp');

    const row = (await listCompanies(signTokenFor(admin))).companies[0];

    assert.equal('status' in row, false);
    assert.equal('industry' in row, false);
    assert.equal('domain' in row, false);
    assert.equal(JSON.stringify(row).includes('suspended'), false);
  });

  it('ignores recruiters who have not named a company', async () => {
    const admin = await makeUser('admin-noname@example.com', 'admin');
    await makeRecruiter('noname@example.com', 'No Company');
    await makeRecruiter('named@example.com', 'Named', 'Acme Corp');

    const body = await listCompanies(signTokenFor(admin));

    assert.equal(body.total, 1);
    assert.equal(body.companies[0].name, 'Acme Corp');
  });

  it('ignores a jobseeker-only account and an admin profile', async () => {
    const admin = await makeUser('admin-onlyrec@example.com', 'admin');
    await makeJobseeker('seeker@example.com', 'Pure Seeker', {
      companyName: 'Should Not Appear',
    }).catch(() => {});
    await Profile.updateOne(
      { fullName: 'Pure Seeker' },
      { $set: { companyName: 'Should Not Appear' } }
    );
    // An admin-workspace profile naming a company is equally not a recruiter.
    await Profile.create({
      userId: admin._id,
      role: 'admin',
      fullName: 'The Admin',
      phone: '+1-555-0100',
    });
    await makeRecruiter('real@example.com', 'Real Recruiter', 'Acme Corp');

    const body = await listCompanies(signTokenFor(admin));

    assert.equal(body.total, 1);
    assert.equal(body.companies[0].name, 'Acme Corp');
    assert.equal(JSON.stringify(body).includes('Should Not Appear'), false);
  });

  it('includes a recruiter whose account is active in the jobseeker workspace', async () => {
    const admin = await makeUser('admin-dual@example.com', 'admin');
    const person = await makeRecruiter('dual@example.com', 'Dual Person', 'Acme Corp');
    // Switching away from the recruiter workspace must not erase the company.
    await switchWorkspace(signTokenFor(person), 'jobseeker');

    const body = await listCompanies(signTokenFor(admin));

    assert.equal(body.total, 1);
    assert.equal(body.companies[0].name, 'Acme Corp');
    assert.equal(body.companies[0].recruiters, 1);
  });

  it('excludes a company whose only recruiter profile is orphaned', async () => {
    const admin = await makeUser('admin-orphan@example.com', 'admin');
    await makeRecruiter('orphan-real@example.com', 'Real Recruiter', 'Real Corp');

    const ghost = await makeUser('orphan-ghost@example.com', 'recruiter');
    await Profile.create({
      userId: ghost._id,
      role: 'recruiter',
      fullName: 'Deleted Account',
      phone: '+1-555-0100',
      companyName: 'Ghost Corp',
    });
    await User.findByIdAndDelete(ghost._id);

    const body = await listCompanies(signTokenFor(admin));

    assert.equal(body.total, 1);
    assert.equal(body.companies[0].name, 'Real Corp');
    assert.equal(JSON.stringify(body).includes('Ghost Corp'), false);
    // The orphan must not inflate any recruiter count either.
    assert.equal(body.companies[0].recruiters, 1);
  });
});

// ---------------------------------------------------------------------------
describe('admin companies list: recruiter counts and primary contact', () => {
  it('counts every recruiter who names the same company', async () => {
    const admin = await makeUser('admin-counts@example.com', 'admin');
    await makeRecruiter('count-1@example.com', 'First Rec', 'Acme Corp');
    await makeRecruiter('count-2@example.com', 'Second Rec', 'Acme Corp');
    await makeRecruiter('count-3@example.com', 'Third Rec', 'Acme Corp');
    await makeRecruiter('count-other@example.com', 'Other Rec', 'Globex');

    const byName = rowsByName(await listCompanies(signTokenFor(admin)));

    assert.equal(byName.get('Acme Corp').recruiters, 3);
    assert.equal(byName.get('Globex').recruiters, 1);
  });

  it('picks the earliest recruiter as the primary contact, deterministically', async () => {
    const admin = await makeUser('admin-contact@example.com', 'admin');
    const later = await makeRecruiter('contact-late@example.com', 'Later Rec', 'Acme Corp');
    const earlier = await makeRecruiter('contact-early@example.com', 'Earlier Rec', 'Acme Corp');

    await backdate(Profile, (await Profile.findOne({ userId: earlier._id, role: 'recruiter' }))._id, 30);

    const row = rowsByName(await listCompanies(signTokenFor(admin))).get('Acme Corp');

    assert.equal(row.primaryContact.id, String(earlier._id));
    assert.equal(row.primaryContact.name, 'Earlier Rec');
    assert.equal(row.primaryContact.email, 'contact-early@example.com');
    assert.ok(row.joinedAt);
    // The later recruiter is still counted even though they are not the contact.
    assert.equal(row.recruiters, 2);
    assert.ok(later._id);
  });

  it('reports a website only when no two recruiters recorded a different one', async () => {
    const admin = await makeUser('admin-web@example.com', 'admin');

    // Agreeing recruiters: one shared website.
    await makeRecruiter('web-a@example.com', 'A Rec', 'Shared Corp', {
      companyWebsite: 'https://shared.example.com',
    });
    await makeRecruiter('web-b@example.com', 'B Rec', 'Shared Corp', {
      companyWebsite: 'https://shared.example.com',
    });
    // Disagreeing recruiters: no single company website exists.
    await makeRecruiter('web-c@example.com', 'C Rec', 'Split Corp', {
      companyWebsite: 'https://one.example.com',
    });
    await makeRecruiter('web-d@example.com', 'D Rec', 'Split Corp', {
      companyWebsite: 'https://two.example.com',
    });
    // One recorded, one blank: a blank is an absence of information, not a
    // conflicting claim, so the single recorded value stands.
    await makeRecruiter('web-e@example.com', 'E Rec', 'Partial Corp', {
      companyWebsite: 'https://partial.example.com',
    });
    await makeRecruiter('web-f@example.com', 'F Rec', 'Partial Corp');
    // Nobody recorded one.
    await makeRecruiter('web-g@example.com', 'G Rec', 'No Site Corp');

    const byName = rowsByName(await listCompanies(signTokenFor(admin)));

    assert.equal(byName.get('Shared Corp').companyWebsite, 'https://shared.example.com');
    assert.equal(byName.get('Split Corp').companyWebsite, '');
    assert.equal(byName.get('Partial Corp').companyWebsite, 'https://partial.example.com');
    assert.equal(byName.get('No Site Corp').companyWebsite, '');
  });
});

// ---------------------------------------------------------------------------
describe('admin companies list: job attribution', () => {
  it('counts a job by the employer the job itself declares', async () => {
    const admin = await makeUser('admin-jobs@example.com', 'admin');
    const owner = await makeRecruiter('jobs-owner@example.com', 'Owner', 'Acme Corp');
    const job = await Job.create({ ...baseJob({ company: 'Acme Corp' }), postedBy: owner._id });

    const row = rowsByName(await listCompanies(signTokenFor(admin))).get('Acme Corp');

    assert.equal(row.jobs, 1);
    assert.equal(row.applications, 0);
    assert.ok(job._id);
  });

  it('does NOT credit a company for a job its recruiter posted for another employer', async () => {
    const admin = await makeUser('admin-attrib@example.com', 'admin');
    // This recruiter works for Acme Corp but posts a listing for Globex. Globex
    // is the job's declared employer, so Acme Corp must not be credited.
    const owner = await makeRecruiter('attrib-owner@example.com', 'Owner', 'Acme Corp');
    await Job.create({ ...baseJob({ company: 'Globex' }), postedBy: owner._id });
    await Job.create({ ...baseJob({ title: 'Second', company: 'Globex' }), postedBy: owner._id });

    const byName = rowsByName(await listCompanies(signTokenFor(admin)));

    assert.equal(byName.get('Acme Corp').jobs, 0, 'the poster is not evidence of the employer');
    assert.equal(byName.get('Acme Corp').applications, 0);
    // No Globex recruiter profile exists, so Globex is not listed at all.
    assert.equal(byName.has('Globex'), false);
  });

  it('keeps company names that differ only by case as separate records', async () => {
    const admin = await makeUser('admin-case@example.com', 'admin');
    await makeRecruiter('case-1@example.com', 'Upper Rec', 'Acme Corp');
    await makeRecruiter('case-2@example.com', 'Lower Rec', 'acme corp');

    // A listing for one spelling must not be credited to the other.
    const upperOwner = await makeRecruiter('case-3@example.com', 'Upper Job Owner', 'Acme Corp');
    await Job.create({ ...baseJob({ company: 'Acme Corp' }), postedBy: upperOwner._id });

    const body = await listCompanies(signTokenFor(admin));

    assert.equal(body.total, 2, 'the two spellings must not be merged');
    const byName = rowsByName(body);
    assert.equal(byName.get('Acme Corp').jobs, 1);
    assert.equal(byName.get('acme corp').jobs, 0);
  });

  it('aggregates applications received on the company\'s own listings', async () => {
    const admin = await makeUser('admin-apps@example.com', 'admin');
    const owner = await makeRecruiter('apps-owner@example.com', 'Owner', 'Acme Corp');
    const otherOwner = await makeRecruiter('apps-other@example.com', 'Other', 'Globex');

    const acmeJob = await Job.create({ ...baseJob({ company: 'Acme Corp' }), postedBy: owner._id });
    await Job.create({ ...baseJob({ company: 'Acme Corp' }), postedBy: owner._id });
    const globexJob = await Job.create({ ...baseJob({ company: 'Globex' }), postedBy: otherOwner._id });

    const seeker1 = await makeJobseeker('apps-s1@example.com', 'Seeker One');
    const seeker2 = await makeJobseeker('apps-s2@example.com', 'Seeker Two');
    await applyAsJobseeker(signTokenFor(seeker1), acmeJob._id, { fullName: 'Seeker One' });
    await applyAsJobseeker(signTokenFor(seeker2), acmeJob._id, { fullName: 'Seeker Two' });
    await applyAsJobseeker(signTokenFor(seeker1), globexJob._id, { fullName: 'Seeker One' });

    const byName = rowsByName(await listCompanies(signTokenFor(admin)));

    assert.equal(byName.get('Acme Corp').jobs, 2);
    assert.equal(byName.get('Acme Corp').applications, 2);
    assert.equal(byName.get('Globex').jobs, 1);
    assert.equal(byName.get('Globex').applications, 1);
  });

  it('reports real zeros for a company with no listings or applications', async () => {
    const admin = await makeUser('admin-zero@example.com', 'admin');
    const idle = await makeRecruiter('zero-idle@example.com', 'Idle Rec', 'Quiet Corp');
    // Another company's activity must not leak onto the idle row.
    const busy = await makeRecruiter('zero-busy@example.com', 'Busy Rec', 'Loud Corp');
    const busyJob = await Job.create({ ...baseJob({ company: 'Loud Corp' }), postedBy: busy._id });
    const seeker = await makeJobseeker('zero-s1@example.com', 'Seeker');
    await applyAsJobseeker(signTokenFor(seeker), busyJob._id, { fullName: 'Seeker' });

    const byName = rowsByName(await listCompanies(signTokenFor(admin)));

    assert.ok(idle._id);
    assert.equal(byName.get('Quiet Corp').jobs, 0);
    assert.equal(byName.get('Quiet Corp').applications, 0);
    assert.equal(byName.get('Loud Corp').jobs, 1);
    assert.equal(byName.get('Loud Corp').applications, 1);
  });

  it('drops a company\'s application count when the applications are removed', async () => {
    const admin = await makeUser('admin-removed@example.com', 'admin');
    const owner = await makeRecruiter('removed-owner@example.com', 'Owner', 'Acme Corp');
    const job = await Job.create({ ...baseJob({ company: 'Acme Corp' }), postedBy: owner._id });
    const seeker = await makeJobseeker('removed-s1@example.com', 'Seeker');
    await applyAsJobseeker(signTokenFor(seeker), job._id, { fullName: 'Seeker' });
    await Application.deleteMany({ userId: seeker._id });

    const row = rowsByName(await listCompanies(signTokenFor(admin))).get('Acme Corp');

    assert.equal(row.jobs, 1, 'the listing still exists');
    assert.equal(row.applications, 0, 'but its applications do not');
  });
});

// ---------------------------------------------------------------------------
describe('admin companies list: search, filters, pagination', () => {
  const seed = async () => {
    const admin = await makeUser('admin-filters@example.com', 'admin');
    await makeRecruiter('filters-1@example.com', 'Ada Lovelace', 'Stark Industries');
    await makeRecruiter('filters-2@example.com', 'Grace Liu', 'Aperture Science');
    return admin;
  };

  it('searches by company name', async () => {
    const admin = await seed();
    const body = await listCompanies(
      signTokenFor(admin),
      `?q=${encodeURIComponent('Aperture')}`
    );
    assert.equal(body.total, 1);
    assert.equal(body.companies[0].name, 'Aperture Science');
  });

  it('searches by recruiter name', async () => {
    const admin = await seed();
    const body = await listCompanies(signTokenFor(admin), `?q=${encodeURIComponent('Ada')}`);
    assert.equal(body.total, 1);
    assert.equal(body.companies[0].name, 'Stark Industries');
  });

  it('searches by recruiter account email', async () => {
    const admin = await seed();
    const body = await listCompanies(
      signTokenFor(admin),
      `?q=${encodeURIComponent('filters-2@example.com')}`
    );
    assert.equal(body.total, 1);
    assert.equal(body.companies[0].name, 'Aperture Science');
  });

  it('returns nothing when the search matches no one', async () => {
    const admin = await seed();
    const body = await listCompanies(signTokenFor(admin), '?q=zzzzz');
    assert.equal(body.total, 0);
    assert.deepEqual(body.companies, []);
  });

  it('does not treat a regex metacharacter as a pattern', async () => {
    const admin = await seed();
    const body = await listCompanies(signTokenFor(admin), `?q=${encodeURIComponent('.*')}`);
    assert.equal(body.total, 0, 'the term must be matched literally');
  });

  it('filters by joined date window', async () => {
    const admin = await makeUser('admin-dates@example.com', 'admin');
    const oldRec = await makeRecruiter('dates-old@example.com', 'Old Rec', 'Old Corp');
    await makeRecruiter('dates-fresh@example.com', 'Fresh Rec', 'Fresh Corp');
    const oldProfile = await Profile.findOne({ userId: oldRec._id, role: 'recruiter' });
    await backdate(Profile, oldProfile._id, 45);

    const last7 = await listCompanies(signTokenFor(admin), '?dateRange=7');
    assert.equal(last7.total, 1);
    assert.equal(last7.companies[0].name, 'Fresh Corp');

    const last90 = await listCompanies(signTokenFor(admin), '?dateRange=90');
    assert.equal(last90.total, 2);
  });

  it('paginates with page/limit and reports real totals', async () => {
    const admin = await makeUser('admin-pager@example.com', 'admin');
    for (let i = 0; i < 5; i += 1) {
      await makeRecruiter(`pager-${i}@example.com`, `Pager ${i}`, `Paging Co ${i}`);
    }

    const page1 = await listCompanies(signTokenFor(admin), '?limit=2&page=1');
    assert.equal(page1.page, 1);
    assert.equal(page1.limit, 2);
    assert.equal(page1.total, 5);
    assert.equal(page1.totalPages, 3);
    assert.equal(page1.companies.length, 2);

    const page3 = await listCompanies(signTokenFor(admin), '?limit=2&page=3');
    assert.equal(page3.page, 3);
    assert.equal(page3.companies.length, 1);
  });

  it('paginates companies, not recruiters', async () => {
    const admin = await makeUser('admin-pagerec@example.com', 'admin');
    // One company with four recruiters must still be a single row on a page.
    await makeRecruiter('pagerec-1@example.com', 'A', 'Shared Co');
    await makeRecruiter('pagerec-2@example.com', 'B', 'Shared Co');
    await makeRecruiter('pagerec-3@example.com', 'C', 'Shared Co');
    await makeRecruiter('pagerec-4@example.com', 'D', 'Shared Co');

    const body = await listCompanies(signTokenFor(admin));

    assert.equal(body.total, 1);
    assert.equal(body.companies.length, 1);
    assert.equal(body.companies[0].recruiters, 4);
  });

  it('combines search and the date filter', async () => {
    const admin = await makeUser('admin-combo@example.com', 'admin');
    const oldRec = await makeRecruiter('combo-old@example.com', 'Match', 'Wanted Corp');
    await makeRecruiter('combo-fresh@example.com', 'Match', 'Other Corp');
    const oldProfile = await Profile.findOne({ userId: oldRec._id, role: 'recruiter' });
    await backdate(Profile, oldProfile._id, 45);

    const body = await listCompanies(signTokenFor(admin), '?q=Match&dateRange=7');

    assert.equal(body.total, 1);
    assert.equal(body.companies[0].name, 'Other Corp');
  });

  it('returns an empty page for a page past the end', async () => {
    const admin = await seed();
    const body = await listCompanies(signTokenFor(admin), '?limit=10&page=9');
    assert.equal(body.status, undefined);
    assert.equal(body.total, 2);
    assert.deepEqual(body.companies, []);
    assert.equal(body.totalPages, 1);
  });
});

// ---------------------------------------------------------------------------
// The workspace has no per-company detail endpoint by design: every value the
// detail panel renders is already on the list row. The invariant that replaces
// the list/detail agreement check is that EVERY row the list returns is backed by
// at least one real recruiter profile on a live account, and that the row's
// reported counts and primary contact agree with the stored documents.
describe('admin companies list: every listed row is backed by real data', () => {
  it('resolves each listed company to real recruiters and stored counts', async () => {
    const admin = await makeUser('admin-resolve@example.com', 'admin');

    const solo = await makeRecruiter('resolve-solo@example.com', 'Solo Rec', 'Solo Corp');
    const pairA = await makeRecruiter('resolve-pa@example.com', 'Pair A', 'Pair Corp');
    await makeRecruiter('resolve-pb@example.com', 'Pair B', 'Pair Corp');
    const silent = await makeRecruiter('resolve-silent@example.com', 'Silent Rec', 'Silent Corp');

    const soloJob = await Job.create({ ...baseJob({ company: 'Solo Corp' }), postedBy: solo._id });
    await Job.create({ ...baseJob({ company: 'Pair Corp' }), postedBy: pairA._id });
    await Job.create({ ...baseJob({ title: 'Second', company: 'Pair Corp' }), postedBy: pairA._id });

    const seeker = await makeJobseeker('resolve-seeker@example.com', 'Seeker');
    await applyAsJobseeker(signTokenFor(seeker), soloJob._id, { fullName: 'Seeker' });

    const body = await listCompanies(signTokenFor(admin));

    assert.equal(body.total, 3);
    assert.deepEqual(
      body.companies.map((c) => c.name).sort(),
      ['Pair Corp', 'Silent Corp', 'Solo Corp']
    );

    for (const row of body.companies) {
      // At least one real recruiter profile, on a live account, claims it.
      const recruiters = await Profile.find({ role: 'recruiter', companyName: row.name }).lean();
      assert.ok(recruiters.length > 0, `${row.name} must be claimed by a recruiter profile`);
      assert.equal(row.recruiters, recruiters.length);
      assert.equal(row.recruiters, await User.countDocuments({
        _id: { $in: recruiters.map((p) => p.userId) },
      }));

      const jobs = await Job.find({ company: row.name }).lean();
      assert.equal(row.jobs, jobs.length);
      assert.equal(
        row.applications,
        await Application.countDocuments({ jobId: { $in: jobs.map((j) => j._id) } })
      );

      // The primary contact is one of this company's own real recruiters.
      assert.ok(recruiters.some((p) => String(p.userId) === String(row.primaryContact.id)));
      assert.ok(row.name && row.id, 'identity fields must never be blank');
    }

    assert.ok(silent._id);
  });

  it('lists a company whose recruiters all left only when a real one remains', async () => {
    const admin = await makeUser('admin-partial@example.com', 'admin');
    const staying = await makeRecruiter('partial-stay@example.com', 'Staying', 'Partial Corp');
    const leaving = await makeRecruiter('partial-leave@example.com', 'Leaving', 'Partial Corp');
    // The leaver's profile is deleted along with the account.
    await User.findByIdAndDelete(leaving._id);
    await Profile.deleteMany({ userId: leaving._id });

    const body = await listCompanies(signTokenFor(admin));

    assert.equal(body.total, 1);
    assert.equal(body.companies[0].name, 'Partial Corp');
    assert.equal(body.companies[0].recruiters, 1);
    assert.equal(body.companies[0].primaryContact.id, String(staying._id));
  });
});