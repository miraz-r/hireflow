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
const { APPLICATION_STATUSES } = require('../src/utils/applicationStatus');

// Distinct DB so this file can run concurrently with other test files.
const TEST_DB_NAME = 'hireflow_test_admin_analytics';

let server;
let baseUrl;

const DAY_MS = 24 * 60 * 60 * 1000;

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

// Rewrite `createdAt` on a stored document so records land in a chosen period.
// Timestamps are set by the schema, so this is the only way to age a real record.
const setCreatedAt = async (model, doc, isoDate) => {
  const _id = doc._id instanceof mongoose.Types.ObjectId ? doc._id : new mongoose.Types.ObjectId(doc._id);
  const result = await model.collection.updateOne(
    { _id },
    { $set: { createdAt: new Date(isoDate) } }
  );
  assert.equal(result.matchedCount, 1, `setCreatedAt should have matched ${_id}`);
};

const utcDayStart = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const isoDay = (date) => date.toISOString().slice(0, 10);

// A UTC midnight `daysAgo` days before today, with an hour so it always lands
// inside that calendar day rather than on a boundary.
const daysAgoAt = (daysAgo, hour = 12) => {
  const day = new Date(utcDayStart(new Date()).getTime() - daysAgo * DAY_MS);
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour));
};

const makeJob = async (overrides = {}, createdAt) => {
  const job = await Job.create({ ...baseJob(), ...overrides });
  if (createdAt) await setCreatedAt(Job, job, createdAt);
  return job;
};

const makeProfile = async (email, role, createdAt, extra = {}) => {
  const user = await makeUser(email, role);
  const profile = await Profile.create({
    userId: user._id,
    role,
    fullName: `${role} ${email}`,
    phone: '+1-555-0100',
    ...extra,
  });
  if (createdAt) await setCreatedAt(Profile, profile, createdAt);
  return profile;
};

const applyAs = async (email, jobId, createdAt, body = {}) => {
  const user = await makeUser(email, 'jobseeker');
  await Profile.create({
    userId: user._id,
    role: 'jobseeker',
    fullName: email,
    phone: '+1-555-0100',
  });
  const res = await request('POST', '/api/applications', {
    token: signTokenFor(user),
    body: {
      jobId,
      phone: '+1-555-0199',
      resumeUrl: '/uploads/resumes/cv.pdf',
      fullName: email,
      ...body,
    },
  });
  assert.equal(res.status, 201, res.raw);
  const application = await Application.findOne({ userId: user._id });
  if (createdAt) await setCreatedAt(Application, application, createdAt);
  return application;
};

const getAnalytics = async (token, range) => {
  const query = range === undefined ? '' : `?range=${range}`;
  const res = await request('GET', `/api/admin/analytics${query}`, { token });
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
describe('admin analytics: authentication and authorization', () => {
  it('requires a token', async () => {
    const res = await request('GET', '/api/admin/analytics');
    assert.equal(res.status, 401);
  });

  it('rejects non-admin roles', async () => {
    const jobseeker = await makeUser('denied-seeker@example.com', 'jobseeker');
    const recruiter = await makeUser('denied-rec@example.com', 'recruiter');

    const asJobseeker = await request('GET', '/api/admin/analytics', {
      token: signTokenFor(jobseeker),
    });
    assert.equal(asJobseeker.status, 403);

    const asRecruiter = await request('GET', '/api/admin/analytics', {
      token: signTokenFor(recruiter),
    });
    assert.equal(asRecruiter.status, 403);
  });

  it('serves an admin token', async () => {
    const admin = await makeUser('admin-ok@example.com', 'admin');
    const res = await getAnalytics(signTokenFor(admin));
    assert.equal(res.status, 200);
  });
});

// ---------------------------------------------------------------------------
describe('admin analytics: range validation', () => {
  const adminToken = async (email) => signTokenFor(await makeUser(email, 'admin'));

  it('accepts every supported range', async () => {
    const token = await adminToken('range-ok@example.com');
    for (const range of ['7', '30', '90', 'year']) {
      const res = await getAnalytics(token, range);
      assert.equal(res.status, 200, `range=${range} must be accepted`);
    }
  });

  it('defaults to 30 days when no range is given', async () => {
    const token = await adminToken('range-default@example.com');
    const res = await getAnalytics(token);
    assert.equal(res.status, 200);
    assert.equal(res.body.range, '30');
  });

  it('treats an empty range as absent', async () => {
    const token = await adminToken('range-empty@example.com');
    const res = await request('GET', '/api/admin/analytics?range=', { token });
    assert.equal(res.status, 200);
    assert.equal(res.body.range, '30');
  });

  it('rejects an unsupported range rather than silently defaulting', async () => {
    const token = await adminToken('range-bad@example.com');
    const res = await getAnalytics(token, '365');
    assert.equal(res.status, 400);

    const word = await getAnalytics(token, 'last-month');
    assert.equal(word.status, 400);
  });
});

// ---------------------------------------------------------------------------
describe('admin analytics: date windows', () => {
  it('covers exactly N calendar days ending today for a day range', async () => {
    const admin = await makeUser('win-days@example.com', 'admin');
    for (const [range, expected] of [['7', 7], ['30', 30], ['90', 90]]) {
      const res = await getAnalytics(signTokenFor(admin), range);
      assert.equal(res.status, 200);
      assert.equal(res.body.trend.length, expected, `range=${range} trend length`);
    }
  });

  it('anchors the window to the current date, not a fixed one', async () => {
    const admin = await makeUser('win-anchor@example.com', 'admin');
    const res = await getAnalytics(signTokenFor(admin), '7');
    const last = res.body.trend[res.body.trend.length - 1].date;
    assert.equal(last, isoDay(new Date()), 'the window must end today');
    assert.equal(res.body.window.end.slice(0, 10), isoDay(new Date()));
  });

  it('reads year as year-to-date, ending today', async () => {
    const admin = await makeUser('win-year@example.com', 'admin');
    const res = await getAnalytics(signTokenFor(admin), 'year');
    assert.equal(res.status, 200);

    const first = res.body.trend[0].date;
    const thisYear = String(new Date().getUTCFullYear());
    assert.ok(first.startsWith(`${thisYear}-01-01`), `year must start Jan 1, got ${first}`);
    assert.equal(res.body.trend[res.body.trend.length - 1].date, isoDay(new Date()));

    // One point per elapsed day of the year so far.
    const elapsedDays = Math.floor(
      (utcDayStart(new Date()).getTime() - Date.UTC(new Date().getUTCFullYear(), 0, 1)) / DAY_MS
    ) + 1;
    assert.equal(res.body.trend.length, elapsedDays);
  });

  it('places the comparison window immediately before, spanning equal duration', async () => {
    const admin = await makeUser('win-prev@example.com', 'admin');
    const res = await getAnalytics(signTokenFor(admin), '30');

    const windowMs = new Date(res.body.window.end).getTime() - new Date(res.body.window.start).getTime();
    const previousMs =
      new Date(res.body.previousWindow.end).getTime() - new Date(res.body.previousWindow.start).getTime();
    assert.equal(previousMs, windowMs, 'comparison window must be the same length');

    // Immediately preceding: it ends one millisecond before the window opens.
    const gap =
      new Date(res.body.window.start).getTime() -
      new Date(res.body.previousWindow.end).getTime();
    assert.equal(gap, 1, 'the comparison window must end where the window begins');
  });

  it('includes every day of the window and excludes the day before it', async () => {
    const admin = await makeUser('win-edge@example.com', 'admin');
    const token = signTokenFor(admin);

    // A 7-day window covers today back to six days ago, inclusive.
    await makeJob({ title: 'Today' }, daysAgoAt(0));
    await makeJob({ title: 'Six days ago' }, daysAgoAt(6));
    await makeJob({ title: 'Seven days ago' }, daysAgoAt(7));

    const seven = await getAnalytics(token, '7');
    assert.equal(seven.body.jobs, 2, 'today and six days ago are inside the window');

    const thirty = await getAnalytics(token, '30');
    assert.equal(thirty.body.jobs, 3, 'a wider window picks up the seventh day');
  });
});

// ---------------------------------------------------------------------------
describe('admin analytics: aggregation', () => {
  it('counts jobs and applications created in the window', async () => {
    const admin = await makeUser('agg-counts@example.com', 'admin');
    const token = signTokenFor(admin);

    await makeJob({ title: 'In window' }, daysAgoAt(1));
    await makeJob({ title: 'Also in window' }, daysAgoAt(2));
    await makeJob({ title: 'Too old' }, daysAgoAt(60));

    const job = await Job.findOne({ title: 'In window' });
    await applyAs('agg-s1@example.com', job._id, daysAgoAt(1));
    await applyAs('agg-s2@example.com', job._id, daysAgoAt(3));

    const res = await getAnalytics(token, '30');
    assert.equal(res.status, 200);
    assert.equal(res.body.jobs, 2);
    assert.equal(res.body.applications, 2);
  });

  it('ignores a job status when counting jobs', async () => {
    const admin = await makeUser('agg-status@example.com', 'admin');
    const token = signTokenFor(admin);

    // Every lifecycle state is still a real posting in the period.
    for (const status of ['active', 'pending', 'closed', 'draft', 'expired']) {
      await makeJob({ title: `Job ${status}`, status }, daysAgoAt(1));
    }

    const res = await getAnalytics(token, '30');
    assert.equal(res.body.jobs, 5, 'all statuses are counted');
  });

  it('counts new jobseekers and recruiters from their profiles', async () => {
    const admin = await makeUser('agg-people@example.com', 'admin');
    const token = signTokenFor(admin);

    await makeProfile('p-js-1@example.com', 'jobseeker', daysAgoAt(1));
    await makeProfile('p-js-2@example.com', 'jobseeker', daysAgoAt(4));
    await makeProfile('p-rec-1@example.com', 'recruiter', daysAgoAt(2));
    await makeProfile('p-js-old@example.com', 'jobseeker', daysAgoAt(45));
    await makeProfile('p-rec-old@example.com', 'recruiter', daysAgoAt(50));
    // An admin profile is neither workspace and must be excluded.
    await makeProfile('p-admin@example.com', 'admin', daysAgoAt(1));

    const res = await getAnalytics(token, '30');
    const byId = new Map(res.body.kpis.map((kpi) => [kpi.id, kpi]));

    assert.equal(byId.get('jobseekers').value, 2);
    assert.equal(byId.get('recruiters').value, 1);
    assert.equal(byId.get('jobseekers').label, 'New Jobseekers');
    assert.equal(byId.get('recruiters').label, 'New Recruiters');
  });

  it('groups the trend by day with real zeroes on quiet days', async () => {
    const admin = await makeUser('agg-trend@example.com', 'admin');
    const token = signTokenFor(admin);

    // Three jobs today, one yesterday, none in between.
    await makeJob({ title: 'T1' }, daysAgoAt(0));
    await makeJob({ title: 'T2' }, daysAgoAt(0));
    await makeJob({ title: 'T3' }, daysAgoAt(0));
    await makeJob({ title: 'T4' }, daysAgoAt(1));

    const res = await getAnalytics(token, '7');
    const today = res.body.trend[res.body.trend.length - 1];
    const yesterday = res.body.trend[res.body.trend.length - 2];
    const middle = res.body.trend[res.body.trend.length - 3];

    assert.equal(today.date, isoDay(new Date()));
    assert.equal(today.jobs, 3);
    assert.equal(yesterday.jobs, 1);
    assert.equal(middle.jobs, 0, 'a day with no jobs is a real zero, not a gap');

    // Every day is present and the series is chronological.
    const dates = res.body.trend.map((point) => point.date);
    assert.deepEqual(dates, [...dates].sort());
    assert.equal(new Set(dates).size, dates.length, 'no duplicate days');
  });

  it('counts applications on the trend by the day they arrived', async () => {
    const admin = await makeUser('agg-apptrend@example.com', 'admin');
    const token = signTokenFor(admin);
    const job = await makeJob({ title: 'Target' }, daysAgoAt(3));

    await applyAs('at-1@example.com', job._id, daysAgoAt(0));
    await applyAs('at-2@example.com', job._id, daysAgoAt(0));

    const res = await getAnalytics(token, '7');
    const today = res.body.trend[res.body.trend.length - 1];
    const jobDay = res.body.trend[res.body.trend.length - 4];

    assert.equal(today.applications, 2);
    assert.equal(jobDay.applications, 0, 'the posting day had no applications yet');
  });

  it('ranks the top five categories from real job records', async () => {
    const admin = await makeUser('agg-cat@example.com', 'admin');
    const token = signTokenFor(admin);

    const plan = [
      ['Engineering', 6],
      ['Design', 5],
      ['Marketing', 4],
      ['Finance', 3],
      ['Sales', 2],
      ['Legal', 1],
      ['Support', 1],
    ];
    let n = 0;
    for (const [category, count] of plan) {
      for (let i = 0; i < count; i += 1) {
        n += 1;
        await makeJob({ title: `Cat ${category} ${n}`, category }, daysAgoAt(1));
      }
    }

    const res = await getAnalytics(token, '30');
    assert.equal(res.body.category.length, 5, 'exactly the top five');
    assert.deepEqual(
      res.body.category.map((item) => item.label),
      ['Engineering', 'Design', 'Marketing', 'Finance', 'Sales']
    );
    assert.deepEqual(
      res.body.category.map((item) => item.value),
      [6, 5, 4, 3, 2]
    );
  });

  it('breaks jobs down by the structured workType field', async () => {
    const admin = await makeUser('agg-worktype@example.com', 'admin');
    const token = signTokenFor(admin);

    await makeJob({ title: 'W1', workType: 'Remote' }, daysAgoAt(1));
    await makeJob({ title: 'W2', workType: 'Remote' }, daysAgoAt(1));
    await makeJob({ title: 'W3', workType: 'Hybrid' }, daysAgoAt(1));
    // Two different free-text locations that are the SAME work type: proving the
    // card reports workType rather than the unbucketed location string.
    await makeJob({ title: 'W4', workType: 'On-site', location: 'New York, NY' }, daysAgoAt(1));
    await makeJob({ title: 'W5', workType: 'On-site', location: 'Remote' }, daysAgoAt(1));

    const res = await getAnalytics(token, '30');
    const byLabel = new Map(res.body.workTypes.map((item) => [item.label, item.value]));

    assert.equal(byLabel.get('Remote'), 2);
    assert.equal(byLabel.get('Hybrid'), 1);
    assert.equal(byLabel.get('On-site'), 2);
    assert.ok(!res.body.location, 'the free-text location breakdown must be gone');
  });

  it('ranks the top five companies by real job records', async () => {
    const admin = await makeUser('agg-co@example.com', 'admin');
    const token = signTokenFor(admin);

    const plan = [['Globex', 5], ['Stark', 4], ['Wayne', 3], ['Hooli', 2], ['Initech', 1], ['Umbrella', 1]];
    let n = 0;
    for (const [company, count] of plan) {
      for (let i = 0; i < count; i += 1) {
        n += 1;
        await makeJob({ title: `Co ${n}`, company }, daysAgoAt(1));
      }
    }

    const res = await getAnalytics(token, '30');
    assert.equal(res.body.topCompanies.length, 5);
    assert.deepEqual(
      res.body.topCompanies.map((item) => item.label),
      ['Globex', 'Stark', 'Wayne', 'Hooli', 'Initech']
    );
    assert.equal(res.body.topCompanies[0].unit, 'jobs');
  });

  it('ranks jobs by real application count', async () => {
    const admin = await makeUser('agg-applied@example.com', 'admin');
    const token = signTokenFor(admin);

    const popular = await makeJob({ title: 'Popular Role' }, daysAgoAt(5));
    const quiet = await makeJob({ title: 'Quiet Role' }, daysAgoAt(5));

    for (let i = 0; i < 3; i += 1) {
      await applyAs(`pop-${i}@example.com`, popular._id, daysAgoAt(2));
    }
    await applyAs('quiet-1@example.com', quiet._id, daysAgoAt(2));

    const res = await getAnalytics(token, '30');
    assert.equal(res.body.mostApplied.length, 2);
    assert.equal(res.body.mostApplied[0].label, 'Popular Role');
    assert.equal(res.body.mostApplied[0].value, 3);
    assert.equal(res.body.mostApplied[1].value, 1);
  });

  it('keeps a deleted job in the ranking with a clear label', async () => {
    const admin = await makeUser('agg-deleted@example.com', 'admin');
    const token = signTokenFor(admin);

    const job = await makeJob({ title: 'Doomed Role' }, daysAgoAt(5));
    await applyAs('deleted-1@example.com', job._id, daysAgoAt(1));
    await Job.deleteOne({ _id: job._id });

    const res = await getAnalytics(token, '30');
    assert.equal(res.body.mostApplied.length, 1);
    assert.equal(res.body.mostApplied[0].label, 'Deleted job');
    assert.equal(res.body.mostApplied[0].value, 1, 'its real count survives the deletion');
  });
});

// ---------------------------------------------------------------------------
describe('admin analytics: application status', () => {
  it('reports the canonical backend statuses only', async () => {
    const admin = await makeUser('st-admin@example.com', 'admin');
    const token = signTokenFor(admin);
    const job = await makeJob({ title: 'Status Target' }, daysAgoAt(3));

    const created = [];
    for (let i = 0; i < APPLICATION_STATUSES.length; i += 1) {
      created.push(await applyAs(`st-${i}@example.com`, job._id, daysAgoAt(1)));
    }
    await Promise.all(
      created.map((application, index) =>
        Application.updateOne({ _id: application._id }, {
          $set: { status: APPLICATION_STATUSES[index] },
        })
      )
    );

    const res = await getAnalytics(token, '30');
    assert.deepEqual(
      res.body.status.map((slice) => slice.id),
      APPLICATION_STATUSES
    );

    for (const slice of res.body.status) {
      assert.equal(slice.count, 1, `${slice.id} must have its real count`);
      assert.equal(
        APPLICATION_STATUSES.includes(slice.id),
        true,
        'no admin-only status may appear'
      );
    }
    assert.equal(
      res.body.status.reduce((sum, slice) => sum + slice.count, 0),
      res.body.applications
    );
  });

  it('reports a real zero for a status with no applications', async () => {
    const admin = await makeUser('st-zero@example.com', 'admin');
    const token = signTokenFor(admin);
    const job = await makeJob({ title: 'Only Applied' }, daysAgoAt(2));
    await applyAs('st-zero-1@example.com', job._id, daysAgoAt(1));

    const res = await getAnalytics(token, '30');
    const byId = new Map(res.body.status.map((slice) => [slice.id, slice.count]));

    assert.equal(byId.get('applied'), 1);
    assert.equal(byId.get('hired'), 0, 'an unused status is still reported, as zero');
    assert.equal(res.body.status.length, APPLICATION_STATUSES.length);
  });

  it('excludes an application created outside the window', async () => {
    const admin = await makeUser('st-window@example.com', 'admin');
    const token = signTokenFor(admin);
    const job = await makeJob({ title: 'Windowed' }, daysAgoAt(40));
    await applyAs('st-window-1@example.com', job._id, daysAgoAt(35));

    const res = await getAnalytics(token, '7');
    assert.equal(res.body.applications, 0);
    assert.equal(res.body.status.find((s) => s.id === 'applied').count, 0);
  });

  it('reports current status counts, not cumulative stage totals', async () => {
    const admin = await makeUser('st-current@example.com', 'admin');
    const token = signTokenFor(admin);
    const job = await makeJob({ title: 'Moved On' }, daysAgoAt(4));
    const application = await applyAs('st-current-1@example.com', job._id, daysAgoAt(3));

    // One application that advanced: it is counted ONCE, where it sits now.
    await Application.updateOne({ _id: application._id }, { $set: { status: 'offer' } });

    const res = await getAnalytics(token, '30');
    const byId = new Map(res.body.status.map((slice) => [slice.id, slice.count]));

    assert.equal(byId.get('offer'), 1);
    assert.equal(byId.get('applied'), 0, 'it no longer sits in applied');
    assert.equal(
      res.body.status.reduce((sum, slice) => sum + slice.count, 0),
      1,
      'no application may be double-counted across stages'
    );
  });
});

// ---------------------------------------------------------------------------
describe('admin analytics: KPI comparisons', () => {
  const kpiOf = (body, id) => body.kpis.find((kpi) => kpi.id === id);

  it('compares against the immediately preceding period', async () => {
    const admin = await makeUser('kpi-cmp@example.com', 'admin');
    const token = signTokenFor(admin);

    // Window (last 30 days): 3 jobs. Previous 30 days: 2 jobs. => +50%.
    await makeJob({ title: 'W1' }, daysAgoAt(1));
    await makeJob({ title: 'W2' }, daysAgoAt(2));
    await makeJob({ title: 'W3' }, daysAgoAt(3));
    await makeJob({ title: 'P1' }, daysAgoAt(35));
    await makeJob({ title: 'P2' }, daysAgoAt(40));

    const res = await getAnalytics(token, '30');
    const jobs = kpiOf(res.body, 'jobs');

    assert.equal(jobs.value, 3);
    assert.equal(jobs.previous, 2);
    assert.equal(jobs.change, 50);
  });

  it('reports a fall as a negative change', async () => {
    const admin = await makeUser('kpi-fall@example.com', 'admin');
    const token = signTokenFor(admin);

    await makeJob({ title: 'W1' }, daysAgoAt(1));
    await makeJob({ title: 'P1' }, daysAgoAt(35));
    await makeJob({ title: 'P2' }, daysAgoAt(36));

    const res = await getAnalytics(token, '30');
    assert.equal(kpiOf(res.body, 'jobs').change, -50);
  });

  it('reports no change as zero', async () => {
    const admin = await makeUser('kpi-flat@example.com', 'admin');
    const token = signTokenFor(admin);

    await makeJob({ title: 'W1' }, daysAgoAt(1));
    await makeJob({ title: 'P1' }, daysAgoAt(35));

    const res = await getAnalytics(token, '30');
    assert.equal(kpiOf(res.body, 'jobs').change, 0);
  });

  it('returns null, never Infinity or NaN, when the previous period is empty', async () => {
    const admin = await makeUser('kpi-zero@example.com', 'admin');
    const token = signTokenFor(admin);

    // Present now, nothing before: a percentage is undefined, not infinite.
    await makeJob({ title: 'W1' }, daysAgoAt(1));
    await makeProfile('kpi-zero-js@example.com', 'jobseeker', daysAgoAt(1));

    const res = await getAnalytics(token, '30');

    for (const kpi of res.body.kpis) {
      if (kpi.previous === 0) {
        assert.equal(kpi.change, null, `${kpi.id} must report null`);
      }
      assert.notEqual(kpi.change, Infinity, `${kpi.id} must never be Infinity`);
      assert.notEqual(kpi.change, -Infinity, `${kpi.id} must never be -Infinity`);
      assert.ok(
        kpi.change === null || Number.isFinite(kpi.change),
        `${kpi.id} must be null or a finite number, got ${kpi.change}`
      );
    }

    assert.equal(kpiOf(res.body, 'jobs').previous, 0);
    assert.equal(kpiOf(res.body, 'jobs').change, null);
  });

  it('reports null for an empty report rather than a NaN percentage', async () => {
    const admin = await makeUser('kpi-empty@example.com', 'admin');
    const res = await getAnalytics(signTokenFor(admin), '30');

    assert.equal(res.status, 200);
    for (const kpi of res.body.kpis) {
      assert.equal(kpi.value, 0);
      assert.equal(kpi.previous, 0);
      assert.equal(kpi.change, null);
    }
  });

  it('keeps the trend consistent with the KPI totals', async () => {
    const admin = await makeUser('kpi-consistent@example.com', 'admin');
    const token = signTokenFor(admin);

    await makeJob({ title: 'W1' }, daysAgoAt(1));
    await makeJob({ title: 'W2' }, daysAgoAt(2));
    await makeJob({ title: 'W3' }, daysAgoAt(4));
    const job = await Job.findOne({ title: 'W2' });
    await applyAs('kc-1@example.com', job._id, daysAgoAt(1));

    const res = await getAnalytics(token, '30');

    const jobSum = res.body.trend.reduce((sum, point) => sum + point.jobs, 0);
    const applicationSum = res.body.trend.reduce((sum, point) => sum + point.applications, 0);
    assert.equal(jobSum, res.body.jobs, 'the series must sum to the KPI');
    assert.equal(applicationSum, res.body.applications);

    const statusSum = res.body.status.reduce((sum, slice) => sum + slice.count, 0);
    assert.equal(statusSum, res.body.applications);
  });
});

// ---------------------------------------------------------------------------
describe('admin analytics: empty collections', () => {
  it('returns a complete, zeroed report when nothing exists', async () => {
    const admin = await makeUser('empty-admin@example.com', 'admin');
    const res = await getAnalytics(signTokenFor(admin), '30');

    assert.equal(res.status, 200);
    assert.equal(res.body.jobs, 0);
    assert.equal(res.body.applications, 0);
    assert.equal(res.body.trend.length, 30);
    assert.ok(res.body.trend.every((point) => point.jobs === 0 && point.applications === 0));
    assert.deepEqual(res.body.category, []);
    assert.deepEqual(res.body.workTypes, []);
    assert.deepEqual(res.body.topCompanies, []);
    assert.deepEqual(res.body.mostApplied, []);
    // Every canonical status is still listed, at zero.
    assert.equal(res.body.status.length, APPLICATION_STATUSES.length);
    assert.ok(res.body.status.every((slice) => slice.count === 0));
    assert.ok(res.body.window.start && res.body.window.end);
    assert.ok(res.body.previousWindow.start && res.body.previousWindow.end);
  });

  it('returns a report for the year range with no data', async () => {
    const admin = await makeUser('empty-year@example.com', 'admin');
    const res = await getAnalytics(signTokenFor(admin), 'year');
    assert.equal(res.status, 200);
    assert.equal(res.body.jobs, 0);
    assert.ok(res.body.trend.length >= 1);
  });
});

// ---------------------------------------------------------------------------
describe('admin analytics: response contract', () => {
  it('exposes the stable shape the page and CSV consume', async () => {
    const admin = await makeUser('shape-admin@example.com', 'admin');
    const job = await makeJob({ title: 'Shape Role', company: 'Shape Co' }, daysAgoAt(1));
    await applyAs('shape-s1@example.com', job._id, daysAgoAt(1));
    await makeProfile('shape-js@example.com', 'jobseeker', daysAgoAt(1));
    await makeProfile('shape-rec@example.com', 'recruiter', daysAgoAt(1));

    const res = await getAnalytics(signTokenFor(admin), '30');
    const body = res.body;

    assert.ok(['7', '30', '90', 'year'].includes(body.range));
    assert.equal(typeof body.label, 'string');
    assert.equal(typeof body.window.start, 'string');
    assert.equal(typeof body.window.end, 'string');
    assert.equal(typeof body.previousWindow.start, 'string');
    assert.equal(typeof body.previousWindow.end, 'string');

    assert.ok(Array.isArray(body.trend));
    for (const point of body.trend) {
      assert.ok(typeof point.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(point.date));
      assert.equal(typeof point.jobs, 'number');
      assert.equal(typeof point.applications, 'number');
    }

    assert.equal(body.kpis.length, 4);
    assert.deepEqual(
      body.kpis.map((kpi) => kpi.id),
      ['jobs', 'applications', 'jobseekers', 'recruiters']
    );
    for (const kpi of body.kpis) {
      assert.equal(typeof kpi.label, 'string');
      assert.equal(typeof kpi.value, 'number');
      assert.equal(typeof kpi.previous, 'number');
    }

    assert.deepEqual(body.status.map((s) => s.id), APPLICATION_STATUSES);
    assert.ok(Array.isArray(body.category));
    assert.ok(Array.isArray(body.workTypes));
    assert.ok(Array.isArray(body.topCompanies));
    assert.ok(Array.isArray(body.mostApplied));

    for (const item of body.category) {
      assert.equal(typeof item.label, 'string');
      assert.equal(typeof item.value, 'number');
    }
  });

  it('does not leak any authored or fabricated series field', async () => {
    const admin = await makeUser('contract-admin@example.com', 'admin');
    const res = await getAnalytics(signTokenFor(admin), '30');

    // The previous implementation shipped fixed percentages, funnel rates and a
    // synthetic daily series. None of those keys may return now.
    for (const forbidden of ['funnel', 'delta', 'topCompaniesShare', 'noise']) {
      assert.equal(forbidden in res.body, false, `${forbidden} must not be returned`);
    }
    for (const slice of res.body.status) {
      assert.equal('value' in slice, false, 'status rows carry counts, not authored shares');
    }
  });
});