const { before, after, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const dns = require('node:dns');

dns.setServers(['1.1.1.1', '1.0.0.1']);

const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const env = require('../src/config/env');
const app = require('../src/app');
const { RESUME_DIR } = require('../src/config/uploads');
const User = require('../src/models/User');
const Profile = require('../src/models/Profile');
const Job = require('../src/models/Job');
const Application = require('../src/models/Application');

const TEST_DB_NAME = 'hireflow_test_resume_access';

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
  return { status: res.status, headers: res.headers, text };
};

const RESUME_FILE = 'resume-test-fixture.pdf';
const RESUME_PATH = path.join(RESUME_DIR, RESUME_FILE);

before(async () => {
  fs.writeFileSync(RESUME_PATH, '%PDF-1.4 fake test resume');
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
  fs.rmSync(RESUME_PATH, { force: true });
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
  const recruiter = await makeUser('owner@example.com', 'recruiter');
  const otherRecruiter = await makeUser('other@example.com', 'recruiter');
  const admin = await makeUser('admin@example.com', 'admin');
  const applicant = await makeUser('alice@example.com', 'jobseeker');
  const bystander = await makeUser('bob@example.com', 'jobseeker');

  const job = await Job.create({
    title: 'Analyst',
    company: 'Acme',
    location: 'Remote',
    workType: 'Remote',
    employmentType: 'Full-time',
    experienceLevel: 'Mid-level',
    category: 'Data',
    description: 'x',
    postedBy: recruiter._id,
  });

  const application = await Application.create({
    jobId: job._id,
    userId: applicant._id,
    resumeUrl: `/uploads/resumes/${RESUME_FILE}`,
  });
  await Profile.create({
    userId: applicant._id, role: 'jobseeker', fullName: 'Alice', phone: '+15550100',
    location: 'Remote', resumeUrl: `/uploads/resumes/${RESUME_FILE}`, resumeName: 'alice-cv.pdf',
  });
  return { recruiter, otherRecruiter, admin, applicant, bystander, job, application };
};

describe('resume file privacy', () => {
  it('does not serve resume files from the public static mount', async () => {
    const res = await get(`/uploads/resumes/${RESUME_FILE}`);
    assert.equal(res.status, 404);
  });

  it('rejects unauthenticated access to both protected endpoints', async () => {
    const { application } = await seed();
    assert.equal((await get('/api/profile/resume')).status, 401);
    assert.equal((await get(`/api/applications/${application.id}/resume`)).status, 401);
  });

  it('lets the owner read their own resume via /api/profile/resume', async () => {
    const { applicant } = await seed();
    const res = await get('/api/profile/resume', { token: signTokenFor(applicant) });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.ok(res.text.includes('%PDF'));
  });

  it('gives another jobseeker no access via the application endpoint', async () => {
    const { bystander, application } = await seed();
    const res = await get(`/api/applications/${application.id}/resume`, { token: signTokenFor(bystander) });
    assert.equal(res.status, 403);
  });

  it('lets the applicant read their own resume via the application endpoint', async () => {
    const { applicant, application } = await seed();
    const res = await get(`/api/applications/${application.id}/resume`, { token: signTokenFor(applicant) });
    assert.equal(res.status, 200);
  });

  it('lets the owning recruiter read the applicant resume', async () => {
    const { recruiter, application } = await seed();
    const res = await get(`/api/applications/${application.id}/resume`, { token: signTokenFor(recruiter) });
    assert.equal(res.status, 200);
  });

  it('blocks a recruiter from unrelated applicants', async () => {
    const { otherRecruiter, application } = await seed();
    const res = await get(`/api/applications/${application.id}/resume`, { token: signTokenFor(otherRecruiter) });
    assert.equal(res.status, 403);
  });

  it('lets an admin read any resume', async () => {
    const { admin, application } = await seed();
    const res = await get(`/api/applications/${application.id}/resume`, { token: signTokenFor(admin) });
    assert.equal(res.status, 200);
  });

  it('returns 400 for malformed application ids and 404 without path leaks', async () => {
    const { admin } = await seed();
    assert.equal((await get('/api/applications/not-an-id/resume', { token: signTokenFor(admin) })).status, 400);
    const res = await get('/api/applications/000000000000000000000000/resume', { token: signTokenFor(admin) });
    assert.equal(res.status, 404);
    assert.ok(!res.text.includes(RESUME_DIR) && !res.text.includes('uploads'));
  });

  it('returns 404 when the application has no resume uploaded', async () => {
    const { admin, applicant, recruiter } = await seed();
    const job2 = await Job.create({
      title: 'No Resume Job', company: 'Acme', location: 'Remote', workType: 'Remote',
      employmentType: 'Full-time', experienceLevel: 'Mid-level', category: 'Data', description: 'x',
      postedBy: recruiter._id,
    });
    const app2 = await Application.create({ jobId: job2._id, userId: applicant._id, resumeUrl: '' });
    const realProfile = await Profile.findOne({ userId: applicant._id });
    await Profile.findByIdAndUpdate(realProfile._id, { resumeUrl: '' });
    const res = await get(`/api/applications/${app2.id}/resume`, { token: signTokenFor(admin) });
    assert.equal(res.status, 404);
    assert.ok(res.text.includes('No resume uploaded'));
  });
});
