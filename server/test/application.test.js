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
const TEST_DB_NAME = 'hireflow_test_applications';

let server;
let baseUrl;

const makeUser = async (email, role) => {
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
  await User.deleteMany({});
  await Profile.deleteMany({});
  await Job.deleteMany({});
  await Application.deleteMany({});
  await RecruiterActivity.deleteMany({});
});

let seedCounter = 0;
const seedJobAndParties = async () => {
  seedCounter += 1;
  const recruiter = await makeUser(`recruiter-${seedCounter}@example.com`, 'recruiter');
  const jobseeker = await makeUser(`jobseeker-${seedCounter}@example.com`, 'jobseeker');
  await Profile.create({
    userId: jobseeker._id,
    role: 'jobseeker',
    fullName: 'Profile Name',
    phone: '+1-555-0100',
    headline: 'Developer',
  });
  const job = await Job.create({ ...validJob, postedBy: recruiter._id });
  return {
    recruiter,
    jobseeker,
    job,
    recruiterToken: signTokenFor(recruiter),
    jobseekerToken: signTokenFor(jobseeker),
  };
};

const validApplication = {
  jobId: null, // filled in below
  fullName: 'Jane Applicant',
  email: 'jane.applicant@example.com',
  phone: '+1-555-0199',
  coverLetter: 'I am a great fit for this role.',
  resumeUrl: '/uploads/resumes/jane.pdf',
  linkedin: 'https://linkedin.com/in/janeapplicant',
  portfolio: 'https://janeapplicant.dev',
};

describe('POST /api/applications persists applicant form data', () => {
  it('persists and returns fullName, email, linkedin, and portfolio', async () => {
    const { jobseeker, job, jobseekerToken } = await seedJobAndParties();

    const res = await request('POST', '/api/applications', {
      token: jobseekerToken,
      body: { ...validApplication, jobId: job._id },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.fullName, 'Jane Applicant');
    assert.equal(res.body.email, 'jane.applicant@example.com');
    assert.equal(res.body.linkedin, 'https://linkedin.com/in/janeapplicant');
    assert.equal(res.body.portfolio, 'https://janeapplicant.dev');
    assert.equal(String(res.body.jobId), String(job._id));
    assert.equal(String(res.body.userId), String(jobseeker._id));
    assert.equal(res.body.status, 'applied');

    // The document itself must hold the values.
    const stored = await Application.findById(res.body._id);
    assert.equal(stored.fullName, 'Jane Applicant');
    assert.equal(stored.email, 'jane.applicant@example.com');
    assert.equal(stored.linkedin, 'https://linkedin.com/in/janeapplicant');
    assert.equal(stored.portfolio, 'https://janeapplicant.dev');
  });

  it('still requires the existing phone and resumeUrl fields', async () => {
    const { job, jobseekerToken } = await seedJobAndParties();

    const noPhone = await request('POST', '/api/applications', {
      token: jobseekerToken,
      body: { ...validApplication, jobId: job._id, phone: '' },
    });
    assert.equal(noPhone.status, 400);

    const noResume = await request('POST', '/api/applications', {
      token: jobseekerToken,
      body: { ...validApplication, jobId: job._id, resumeUrl: '' },
    });
    assert.equal(noResume.status, 400);

    const noJob = await request('POST', '/api/applications', {
      token: jobseekerToken,
      body: { ...validApplication, jobId: undefined },
    });
    assert.equal(noJob.status, 400);
  });

  it('validates the new optional fields like the form does', async () => {
    const { job, jobseekerToken } = await seedJobAndParties();

    const badEmail = await request('POST', '/api/applications', {
      token: jobseekerToken,
      body: { ...validApplication, jobId: job._id, email: 'not-an-email' },
    });
    assert.equal(badEmail.status, 400);

    const badLinkedin = await request('POST', '/api/applications', {
      token: jobseekerToken,
      body: { ...validApplication, jobId: job._id, linkedin: 'javascript:alert(1)' },
    });
    assert.equal(badLinkedin.status, 400);

    const badPortfolio = await request('POST', '/api/applications', {
      token: jobseekerToken,
      body: { ...validApplication, jobId: job._id, portfolio: 'not-a-url' },
    });
    assert.equal(badPortfolio.status, 400);

    const emptyOk = await request('POST', '/api/applications', {
      token: jobseekerToken,
      body: { ...validApplication, jobId: job._id, linkedin: '', portfolio: '', email: '', fullName: '' },
    });
    assert.equal(emptyOk.status, 201);
  });

  it('rejects duplicate applications', async () => {
    const { job, jobseekerToken } = await seedJobAndParties();

    const first = await request('POST', '/api/applications', {
      token: jobseekerToken,
      body: { ...validApplication, jobId: job._id },
    });
    assert.equal(first.status, 201);

    const second = await request('POST', '/api/applications', {
      token: jobseekerToken,
      body: { ...validApplication, jobId: job._id },
    });
    assert.equal(second.status, 409);
  });
});

describe('application data retrieval', () => {
  it('recruiter detail view returns the submitted applicant information', async () => {
    const { recruiter, job, recruiterToken, jobseekerToken } = await seedJobAndParties();

    const created = await request('POST', '/api/applications', {
      token: jobseekerToken,
      body: { ...validApplication, jobId: job._id },
    });
    assert.equal(created.status, 201);

    const detail = await request('GET', `/api/applications/${created.body._id}`, {
      token: recruiterToken,
    });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.applicant.fullName, 'Jane Applicant');
    assert.equal(detail.body.applicant.email, 'jane.applicant@example.com');
    assert.equal(detail.body.applicant.phone, '+1-555-0199');
    assert.equal(detail.body.applicant.resumeUrl, '/uploads/resumes/jane.pdf');
    assert.equal(detail.body.applicant.linkedin, 'https://linkedin.com/in/janeapplicant');
    assert.equal(detail.body.applicant.portfolio, 'https://janeapplicant.dev');
    assert.equal(detail.body.coverLetter, 'I am a great fit for this role.');
    assert.equal(detail.body.job.title, 'Software Engineer');
  });

  it('jobseeker self-check surfaces the persisted application', async () => {
    const { job, jobseekerToken } = await seedJobAndParties();

    const created = await request('POST', '/api/applications', {
      token: jobseekerToken,
      body: { ...validApplication, jobId: job._id },
    });

    const me = await request('GET', `/api/applications/${job._id}/me`, {
      token: jobseekerToken,
    });
    assert.equal(me.status, 200);
    assert.equal(me.body.applied, true);
    assert.equal(String(me.body.application._id), String(created.body._id));
    assert.equal(me.body.application.fullName, 'Jane Applicant');
    assert.equal(me.body.application.email, 'jane.applicant@example.com');
    assert.equal(me.body.application.linkedin, 'https://linkedin.com/in/janeapplicant');
  });

  it('recruiter refuses application detail for a job they do not own', async () => {
    const { job, jobseekerToken } = await seedJobAndParties();
    const otherRecruiter = await makeUser('other-recruiter@example.com', 'recruiter');

    const created = await request('POST', '/api/applications', {
      token: jobseekerToken,
      body: { ...validApplication, jobId: job._id },
    });

    const forbidden = await request('GET', `/api/applications/${created.body._id}`, {
      token: signTokenFor(otherRecruiter),
    });
    assert.equal(forbidden.status, 403);
  });

  it('legacy applications (no submitted applicant fields) still render with fallbacks', async () => {
    const { recruiter, jobseeker, job, recruiterToken } = await seedJobAndParties();

    // Simulate a legacy record created before the four fields existed.
    const legacy = await Application.create({
      jobId: job._id,
      userId: jobseeker._id,
      phone: '+1-555-0100',
      resumeUrl: '/uploads/resumes/legacy.pdf',
    });

    const detail = await request('GET', `/api/applications/${legacy._id}`, {
      token: recruiterToken,
    });
    assert.equal(detail.status, 200);
    // Falls back to the profile name and the user's account email.
    assert.equal(detail.body.applicant.fullName, 'Profile Name');
    assert.equal(detail.body.applicant.email, jobseeker.email);
    assert.equal(detail.body.applicant.linkedin, '');
    assert.equal(detail.body.applicant.portfolio, '');
    assert.equal(detail.body.applicant.phone, '+1-555-0100');
  });
});

describe('persistent recruiter activity history', () => {
  const apply = async (jobId, jobseekerToken) => {
    const res = await request('POST', '/api/applications', {
      token: jobseekerToken,
      body: { ...validApplication, jobId },
    });
    assert.equal(res.status, 201);
    return res.body;
  };

  const setStatus = async (applicationId, status, recruiterToken) =>
    request('PATCH', `/api/applications/${applicationId}/status`, {
      token: recruiterToken,
      body: { status },
    });

  it('records a new persistent event on every status change', async () => {
    const { job, recruiter, recruiterToken, jobseekerToken } = await seedJobAndParties();
    const created = await apply(job._id, jobseekerToken);

    const first = await setStatus(created._id, 'under-review', recruiterToken);
    assert.equal(first.status, 200);
    assert.equal(first.body.status, 'under-review');

    const second = await setStatus(created._id, 'interview', recruiterToken);
    assert.equal(second.status, 200);
    assert.equal(second.body.status, 'interview');

    const events = await RecruiterActivity.find({ applicationId: created._id }).sort({
      createdAt: 1,
    });
    assert.equal(events.length, 2);
    assert.equal(events[0].previousStatus, 'applied');
    assert.equal(events[0].newStatus, 'under-review');
    assert.equal(events[1].previousStatus, 'under-review');
    assert.equal(events[1].newStatus, 'interview');
    assert.equal(String(events[0].recruiterId), String(recruiter._id));
  });

  it('exposes the full history through the activity feed, newest first', async () => {
    const { job, recruiterToken, jobseekerToken } = await seedJobAndParties();
    const created = await apply(job._id, jobseekerToken);

    await setStatus(created._id, 'under-review', recruiterToken);
    await setStatus(created._id, 'interview', recruiterToken);

    const feed = await request('GET', '/api/applications/activity', {
      token: recruiterToken,
    });
    assert.equal(feed.status, 200);

    const statusItems = feed.body.items.filter((i) => i.type === 'status-changed');
    assert.equal(statusItems.length, 2);
    assert.equal(statusItems[0].newStatus, 'interview');
    assert.equal(statusItems[0].previousStatus, 'under-review');
    assert.equal(statusItems[1].newStatus, 'under-review');
    assert.equal(statusItems[1].previousStatus, 'applied');

    assert.ok(
      feed.body.items.some((i) => i.type === 'application-created') &&
        feed.body.items.some((i) => i.type === 'application-created' && i.at)
    );
    assert.equal(feed.body.items[0].applicant.fullName, 'Profile Name');
    assert.equal(feed.body.items[0].job.title, 'Software Engineer');
    assert.equal(feed.body.items[0].job.company, 'Acme Corp');
  });

  it('refuses the activity feed for a recruiter who owns none of the jobs', async () => {
    const { job, jobseekerToken } = await seedJobAndParties();
    await apply(job._id, jobseekerToken);

    const otherRecruiter = await makeUser('other-activity-recruiter@example.com', 'recruiter');
    const feed = await request('GET', '/api/applications/activity', {
      token: signTokenFor(otherRecruiter),
    });
    assert.equal(feed.status, 200);
    assert.deepEqual(feed.body.items, []);
  });
});