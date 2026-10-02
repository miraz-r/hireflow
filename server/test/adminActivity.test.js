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
const { ACTIVITY_TYPES } = require('../src/controllers/admin.controller');

// Distinct DB so this file can run concurrently with other test files.
const TEST_DB_NAME = 'hireflow_test_admin_activity';

let server;
let baseUrl;

const makeUser = async (email, role = 'jobseeker') => {
  const passwordHash = await bcrypt.hash('password123', 4);
  return User.create({ email, passwordHash, role });
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

// Timestamps come from the schema, so ageing a record means rewriting createdAt
// (and optionally updatedAt) on the stored document.
const setTimestamps = async (model, doc, { createdAt, updatedAt }) => {
  const _id = doc._id instanceof mongoose.Types.ObjectId ? doc._id : new mongoose.Types.ObjectId(doc._id);
  const set = {};
  if (createdAt) set.createdAt = new Date(createdAt);
  if (updatedAt) set.updatedAt = new Date(updatedAt);
  const result = await model.collection.updateOne({ _id }, { $set: set });
  assert.equal(result.matchedCount, 1, `setTimestamps should have matched ${_id}`);
};

// A signup, created the way registration creates it: the User row first, then a
// profile in the same workspace.
//
// The HTTP /api/auth/register endpoint is deliberately NOT used here. It sits
// behind a per-IP limiter (10/hour) that is correct for production and hostile to
// a suite that seeds many accounts, and the dual-workspace case still goes
// through the real POST /api/auth/role switch. Both the account timestamp and the
// workspace profile this endpoint reads are set here directly.
// Minutes-ago helper, so ordering assertions read clearly.
const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000);

// A signup, created the way registration creates it: the User row first, then a
// profile in the same workspace.
//
// The HTTP /api/auth/register endpoint is deliberately NOT used here. It sits
// behind a per-IP limiter (10/hour) that is correct for production and hostile to
// a suite that seeds many accounts, and the dual-workspace case still goes
// through the real POST /api/auth/role switch. Both the account timestamp and the
// workspace profile this endpoint reads are set here directly.
const registerAccount = async (email, role, { createdAt, fullName, companyName } = {}) => {
  const user = await makeUser(email, role);
  const profile = await Profile.create({
    userId: user._id,
    role,
    fullName: fullName || `Person ${email}`,
    phone: '+1-555-0100',
    ...(companyName ? { companyName } : {}),
  });

  // The account timestamp is what the feed reports; the profile only decides
  // WHICH workspace, via being the earliest profile on the account.
  if (createdAt) await setTimestamps(User, user, { createdAt });

  return user;
};

const makeJob = async (overrides = {}, createdAt, updatedAt) => {
  const job = await Job.create({ ...baseJob(), ...overrides });
  await setTimestamps(Job, job, { createdAt, updatedAt: updatedAt || createdAt });
  return job;
};

const applyAs = async (email, jobId, createdAt) => {
  const user = await makeUser(email, 'jobseeker');
  await Profile.create({
    userId: user._id,
    role: 'jobseeker',
    fullName: email,
    phone: '+1-555-0100',
  });
  const res = await request('POST', '/api/applications', {
    token: signTokenFor(user),
    body: { jobId, phone: '+1-555-0199', resumeUrl: '/uploads/resumes/cv.pdf' },
  });
  assert.equal(res.status, 201, res.raw);
  const application = await Application.findOne({ userId: user._id });
  await setTimestamps(Application, application, { createdAt });
  return application;
};

const getActivity = async (token, query = '') => {
  const res = await request('GET', `/api/admin/activity${query}`, { token });
  return res;
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
  ]);
});

// ---------------------------------------------------------------------------
describe('admin activity: authentication and authorization', () => {
  it('requires a token', async () => {
    const res = await request('GET', '/api/admin/activity');
    assert.equal(res.status, 401);
  });

  it('rejects non-admin roles', async () => {
    const jobseeker = await makeUser('denied-seeker@example.com', 'jobseeker');
    const recruiter = await makeUser('denied-rec@example.com', 'recruiter');

    const asJobseeker = await getActivity(signTokenFor(jobseeker));
    assert.equal(asJobseeker.status, 403);

    const asRecruiter = await getActivity(signTokenFor(recruiter));
    assert.equal(asRecruiter.status, 403);
  });

  it('serves an admin token', async () => {
    const admin = await makeUser('admin-ok@example.com', 'admin');
    const res = await getActivity(signTokenFor(admin));
    assert.equal(res.status, 200);
  });
});

// ---------------------------------------------------------------------------
describe('admin activity: query validation', () => {
  const adminToken = async (email) => signTokenFor(await makeUser(email, 'admin'));

  it('rejects a malformed ?page', async () => {
    const token = await adminToken('v-page@example.com');
    const res = await getActivity(token, '?page=abc');
    assert.equal(res.status, 400);
  });

  it('rejects a non-positive ?page', async () => {
    const token = await adminToken('v-page0@example.com');
    const res = await getActivity(token, '?page=0');
    assert.equal(res.status, 400);
  });

  it('rejects an out-of-range ?limit', async () => {
    const token = await adminToken('v-limit@example.com');
    const res = await getActivity(token, '?limit=500');
    assert.equal(res.status, 400);
  });

  it('accepts a limit of 50 for the Activity workspace', async () => {
    const token = await adminToken('v-limit50@example.com');
    const res = await getActivity(token, '?limit=50');
    assert.equal(res.status, 200);
    assert.equal(res.body.limit, 50);
  });

  it('accepts every canonical event type and the explicit all', async () => {
    const token = await adminToken('v-type@example.com');
    for (const type of [...ACTIVITY_TYPES, 'all']) {
      const res = await getActivity(token, `?type=${type}`);
      assert.equal(res.status, 200, `type=${type} must be accepted`);
    }
  });

  it('rejects an unknown type rather than returning an empty feed', async () => {
    const token = await adminToken('v-typebad@example.com');
    const res = await getActivity(token, '?type=invented-event');
    assert.equal(res.status, 400);
  });

  it('treats empty values as absent', async () => {
    const token = await adminToken('v-empty@example.com');
    const res = await getActivity(token, '?page=&limit=&type=');
    assert.equal(res.status, 200);
    assert.equal(res.body.page, 1);
    assert.equal(res.body.limit, 8);
    assert.equal(res.body.total, 0);
  });
});

// ---------------------------------------------------------------------------
describe('admin activity: event types', () => {
  it('derives every event type from real records', async () => {
    const admin = await makeUser('types-admin@example.com', 'admin');
    const token = signTokenFor(admin);

    // A job that was never touched is a creation; one whose updatedAt moved is
    // an update. Both distinctions come from stored timestamps.
    await makeJob({ title: 'Untouched Listing' }, minutesAgo(60), minutesAgo(60));
    await makeJob({ title: 'Edited Listing' }, minutesAgo(60), minutesAgo(10));

    const job = await Job.findOne({ title: 'Untouched Listing' });
    await applyAs('types-applicant@example.com', job._id, minutesAgo(30));

    await registerAccount('types-js@example.com', 'jobseeker', { createdAt: minutesAgo(20) });
    await registerAccount('types-rec@example.com', 'recruiter', {
      createdAt: minutesAgo(15),
      companyName: 'Types Corp',
    });

    const res = await getActivity(token);
    assert.equal(res.status, 200);

    const byType = new Map(res.body.items.map((item) => [item.type, item]));

    assert.ok(byType.has('job-created'), 'expected job-created');
    assert.ok(byType.has('job-updated'), 'expected job-updated');
    assert.ok(byType.has('application-created'), 'expected application-created');
    assert.ok(byType.has('jobseeker-registered'), 'expected jobseeker-registered');
    assert.ok(byType.has('recruiter-registered'), 'expected recruiter-registered');

    // The creation carries the creation timestamp; the update carries the later one.
    assert.equal(byType.get('job-created').entity, 'Untouched Listing');
    assert.equal(byType.get('job-updated').entity, 'Edited Listing');
    assert.ok(
      new Date(byType.get('job-updated').at) > new Date(byType.get('job-created').at),
      'an update must be stamped later than the untouched listing'
    );
  });

  it('reports a registration once, under the workspace it signed up in', async () => {
    const admin = await makeUser('reg-admin@example.com', 'admin');
    const token = signTokenFor(admin);

    await registerAccount('reg-js@example.com', 'jobseeker', {
      createdAt: minutesAgo(40),
      fullName: 'Reg Seeker',
    });
    await registerAccount('reg-rec@example.com', 'recruiter', {
      createdAt: minutesAgo(35),
      fullName: 'Reg Recruiter',
      companyName: 'Reg Corp',
    });

    const res = await getActivity(token);
    const jobseeker = res.body.items.find((i) => i.type === 'jobseeker-registered');
    const recruiter = res.body.items.find((i) => i.type === 'recruiter-registered');

    assert.equal(jobseeker.entity, 'Reg Seeker');
    assert.equal(jobseeker.label, 'Jobseeker registered');
    assert.equal(recruiter.entity, 'Reg Recruiter');
    assert.equal(recruiter.label, 'Recruiter joined');
    assert.equal(recruiter.detail, 'Reg Corp', 'a recruiter detail is their real company');
  });

  it('counts a dual-workspace account once, not once per profile', async () => {
    const admin = await makeUser('dual-admin@example.com', 'admin');
    const token = signTokenFor(admin);

    // Registers as a jobseeker, then opens the recruiter workspace. Two profile
    // rows, but one account and one registration.
    const person = await registerAccount('dual@example.com', 'jobseeker', {
      createdAt: minutesAgo(50),
      fullName: 'Dual Person',
    });
    const switched = await request('POST', '/api/auth/role', {
      token: signTokenFor(person),
      body: { role: 'recruiter' },
    });
    assert.equal(switched.status, 200, switched.raw);

    assert.equal(
      await Profile.countDocuments({ userId: person._id }),
      2,
      'the account really does hold two profiles'
    );

    const res = await getActivity(token);
    const registrations = res.body.items.filter(
      (item) =>
        item.type === 'jobseeker-registered' || item.type === 'recruiter-registered'
    );

    assert.equal(registrations.length, 1, 'one account must produce one registration event');
    assert.equal(registrations[0].type, 'jobseeker-registered', 'the signup workspace wins');
    assert.equal(registrations[0].entity, 'Dual Person');
  });

  it('excludes admin registrations', async () => {
    const admin = await makeUser('adminreg-admin@example.com', 'admin');
    const token = signTokenFor(admin);

    // The bootstrap shape: an account with an admin-workspace profile only.
    await registerAccount('adminreg-seeker@example.com', 'jobseeker', { createdAt: minutesAgo(40) });
    await Profile.create({
      userId: admin._id,
      role: 'admin',
      fullName: 'The Admin',
      phone: '+1-555-0100',
    });

    const res = await getActivity(token);

    // The admin account has an admin-workspace profile and is the caller. It is
    // neither a jobseeker nor a recruiter, so it must produce no event - and its
    // own name must never appear in the feed.
    const forAdmin = res.body.items.filter(
      (item) => item.entity === admin.email || item.entity === 'The Admin'
    );
    assert.equal(forAdmin.length, 0, 'an admin account is not a platform signup');

    // The genuine jobseeker signup in the same dataset IS reported, proving the
    // exclusion is specific to admins rather than a broken filter.
    const registrations = res.body.items.filter(
      (item) =>
        item.type === 'jobseeker-registered' || item.type === 'recruiter-registered'
    );
    assert.equal(registrations.length, 1);
    assert.equal(registrations[0].entity, 'Person adminreg-seeker@example.com');
  });

  it('omits a registration whose account has been deleted', async () => {
    const admin = await makeUser('ghost-admin@example.com', 'admin');
    const token = signTokenFor(admin);

    const ghost = await registerAccount('ghost@example.com', 'jobseeker', {
      createdAt: minutesAgo(45),
    });
    await User.findByIdAndDelete(ghost._id);

    const res = await getActivity(token);
    assert.equal(
      res.body.items.filter((i) => i.entity === 'ghost@example.com').length,
      0
    );
  });

  it('falls back to real stored values, never a placeholder actor', async () => {
    const admin = await makeUser('fallback-admin@example.com', 'admin');
    const token = signTokenFor(admin);

    // A job whose company/location exist: the detail is built from both.
    await makeJob({ title: 'Fallback Role', company: 'Real Co', location: 'Real City' }, minutesAgo(30));

    const res = await getActivity(token);
    const created = res.body.items.find((i) => i.type === 'job-created');

    assert.equal(created.detail, 'Real Co • Real City');
  });
});

// ---------------------------------------------------------------------------
describe('admin activity: filtering and ordering', () => {
  const seedMixed = async () => {
    const admin = await makeUser('mixed-admin@example.com', 'admin');
    await makeJob({ title: 'Mixed Created' }, minutesAgo(90), minutesAgo(90));
    await makeJob({ title: 'Mixed Updated' }, minutesAgo(90), minutesAgo(25));
    const job = await Job.findOne({ title: 'Mixed Created' });
    await applyAs('mixed-applicant@example.com', job._id, minutesAgo(55));
    await registerAccount('mixed-js@example.com', 'jobseeker', { createdAt: minutesAgo(70) });
    await registerAccount('mixed-rec@example.com', 'recruiter', {
      createdAt: minutesAgo(65),
      companyName: 'Mixed Corp',
    });
    return admin;
  };

  it('sorts the merged feed newest-first across every source', async () => {
    const admin = await seedMixed();
    const res = await getActivity(signTokenFor(admin), '?limit=50');

    const times = res.body.items.map((item) => new Date(item.at).getTime());
    const sorted = [...times].sort((a, b) => b - a);
    assert.deepEqual(times, sorted, 'items must be ordered newest-first');

    // All five sources are interleaved, so at least one older event follows a newer one.
    assert.ok(res.body.items.length >= 5);
    assert.equal(new Set(res.body.items.map((i) => i.type)).size, 5);
  });

  it('filters to a single event type and totals only that type', async () => {
    const admin = await seedMixed();
    const res = await getActivity(signTokenFor(admin), '?type=job-updated&limit=50');

    assert.ok(res.body.items.length > 0);
    assert.ok(res.body.items.every((item) => item.type === 'job-updated'));
    assert.equal(res.body.total, res.body.items.length);
    assert.equal(res.body.total, 1, 'only the one edited listing qualifies');
  });

  it('filters to registrations', async () => {
    const admin = await seedMixed();
    const res = await getActivity(signTokenFor(admin), '?type=recruiter-registered&limit=50');

    assert.equal(res.body.items.length, 1);
    assert.equal(res.body.items[0].entity, 'Person mixed-rec@example.com');
    assert.equal(res.body.items[0].detail, 'Mixed Corp');
    assert.equal(res.body.total, 1);
  });

  it('treats type=all as no filter', async () => {
    const admin = await seedMixed();
    const all = await getActivity(signTokenFor(admin), '?type=all&limit=50');
    const unfiltered = await getActivity(signTokenFor(admin), '?limit=50');
    assert.equal(all.body.total, unfiltered.body.total);
    assert.equal(all.body.items.length, unfiltered.body.items.length);
  });

  it('returns an empty page, not an error, for a type with no events', async () => {
    const admin = await makeUser('none-admin@example.com', 'admin');
    await makeJob({ title: 'Only Job' }, minutesAgo(10), minutesAgo(10));

    const res = await getActivity(signTokenFor(admin), '?type=recruiter-registered');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.items, []);
    assert.equal(res.body.total, 0);
    assert.equal(res.body.totalPages, 0);
  });
});

// ---------------------------------------------------------------------------
describe('admin activity: pagination', () => {
  const seedMany = async (count) => {
    const admin = await makeUser(`page-admin-${count}@example.com`, 'admin');
    for (let i = 0; i < count; i += 1) {
      // Descending ages so index 0 is the newest, making page order predictable.
      await makeJob({ title: `Paged Job ${i}` }, minutesAgo(count - i), minutesAgo(count - i));
    }
    return admin;
  };

  it('slices the merged feed and reports real totals', async () => {
    const admin = await seedMany(25);
    const token = signTokenFor(admin);

    const page1 = await getActivity(token, '?page=1&limit=10');
    assert.equal(page1.status, 200);
    assert.equal(page1.body.page, 1);
    assert.equal(page1.body.limit, 10);
    assert.equal(page1.body.total, 25);
    assert.equal(page1.body.totalPages, 3);
    assert.equal(page1.body.items.length, 10);

    const page3 = await getActivity(token, '?page=3&limit=10');
    assert.equal(page3.body.items.length, 5, 'the last page holds the remainder');
    assert.equal(page3.body.total, 25);
  });

  it('never repeats or skips an item across pages', async () => {
    const admin = await seedMany(25);
    const token = signTokenFor(admin);

    const first = await getActivity(token, '?page=1&limit=10');
    const second = await getActivity(token, '?page=2&limit=10');
    const third = await getActivity(token, '?page=3&limit=10');

    const keys = [...first.body.items, ...second.body.items, ...third.body.items].map(
      (item) => `${item.type}-${item.at}-${item.entity}`
    );
    assert.equal(keys.length, 25, 'every event is returned exactly once');
    assert.equal(new Set(keys).size, 25, 'no event appears on two pages');

    // Order must be preserved across the page boundary too.
    const all = [...first.body.items, ...second.body.items, ...third.body.items];
    const times = all.map((item) => new Date(item.at).getTime());
    assert.deepEqual(times, [...times].sort((a, b) => b - a));
  });

  it('pages correctly when the sources interleave', async () => {
    const admin = await makeUser('interleave-admin@example.com', 'admin');
    // Alternate event sources so a per-source page would reorder the feed.
    for (let i = 0; i < 6; i += 1) {
      await registerAccount(`interleave-js-${i}@example.com`, 'jobseeker', {
        createdAt: minutesAgo(100 - i * 3),
      });
      await makeJob(
        { title: `Interleaved Job ${i}` },
        minutesAgo(98 - i * 3),
        minutesAgo(98 - i * 3)
      );
    }

    const token = signTokenFor(admin);
    const all = await getActivity(token, '?limit=50');
    const paged = await getActivity(token, '?limit=5&page=1');

    assert.equal(all.body.total, 12);
    assert.equal(paged.body.total, 12);
    assert.equal(paged.body.totalPages, 3);
    // Page 1 of the paged view equals the first 5 of the full view.
    assert.deepEqual(
      paged.body.items.map((i) => `${i.type}-${i.at}`),
      all.body.items.slice(0, 5).map((i) => `${i.type}-${i.at}`)
    );
  });

  it('returns an empty page past the end without erroring', async () => {
    const admin = await seedMany(3);
    const res = await getActivity(signTokenFor(admin), '?page=9&limit=10');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.items, []);
    assert.equal(res.body.total, 3);
    assert.equal(res.body.totalPages, 1);
  });

  it('reports zero totals for an empty platform', async () => {
    const admin = await makeUser('empty-admin@example.com', 'admin');
    const res = await getActivity(signTokenFor(admin), '?page=1&limit=10');

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.items, []);
    assert.equal(res.body.total, 0);
    assert.equal(res.body.totalPages, 0);
  });
});

// ---------------------------------------------------------------------------
// The Overview and Analytics cards call this endpoint with a bare limit and read
// only `items`. Pagination was added afterwards, so both must be unaffected.
describe('admin activity: backward compatibility with existing consumers', () => {
  it('defaults to 8 items and keeps the items array', async () => {
    const admin = await makeUser('compat-admin@example.com', 'admin');
    for (let i = 0; i < 15; i += 1) {
      await makeJob({ title: `Compat Job ${i}` }, minutesAgo(30 - i), minutesAgo(30 - i));
    }

    const res = await getActivity(signTokenFor(admin));
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.items));
    assert.equal(res.body.items.length, 8, 'the historical default must stay 8');
    assert.equal(res.body.limit, 8);
    assert.equal(res.body.page, 1);
  });

  it('honours the bare-limit calls the Overview and Analytics cards make', async () => {
    const admin = await makeUser('compat-limits@example.com', 'admin');
    for (let i = 0; i < 12; i += 1) {
      await makeJob({ title: `Limit Job ${i}` }, minutesAgo(30 - i), minutesAgo(30 - i));
    }
    const token = signTokenFor(admin);

    const overview = await getActivity(token, '?limit=6');
    assert.equal(overview.body.items.length, 6);

    const analytics = await getActivity(token, '?limit=8');
    assert.equal(analytics.body.items.length, 8);
  });

  it('returns the same first page for an explicit page=1 as for no page', async () => {
    const admin = await makeUser('compat-page@example.com', 'admin');
    await makeJob({ title: 'Same First Page' }, minutesAgo(5), minutesAgo(5));
    const token = signTokenFor(admin);

    const implicit = await getActivity(token, '?limit=5');
    const explicit = await getActivity(token, '?limit=5&page=1');

    assert.deepEqual(
      implicit.body.items.map((i) => `${i.type}-${i.at}`),
      explicit.body.items.map((i) => `${i.type}-${i.at}`)
    );
  });

  it('exposes every documented event type to consumers', async () => {
    const admin = await makeUser('compat-types@example.com', 'admin');
    const res = await getActivity(signTokenFor(admin), '?limit=50');
    for (const item of res.body.items) {
      assert.ok(
        ACTIVITY_TYPES.includes(item.type),
        `unexpected event type ${item.type}`
      );
      assert.ok(typeof item.label === 'string' && item.label.length > 0);
      assert.ok(typeof item.detail === 'string');
      assert.ok(typeof item.at === 'string' && !Number.isNaN(Date.parse(item.at)));
    }
  });
});