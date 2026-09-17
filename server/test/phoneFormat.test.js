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
const TEST_DB_NAME = 'hireflow_test_phone_format';

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

// Phone formats that must keep passing (they all currently do).
const SUPPORTED_PHONE_FORMATS = [
  '+1-555-0100',      // E.164-ish US with hyphen
  '(555) 123-4567',   // parens and spaces
  '5551234567',       // bare digits
  '+44 20 7946 0958', // country code + space
  '+8801712345678',   // international, no separators
];

// Characters outside PHONE_CHARS_RE, or shorter than the 6-char floor.
const INVALID_CHAR_PHONES = [
  'abc',           // letters
  '+1-555-0100!',  // punctuation outside the set
  '123',           // too short
];

// Above the shared 32-char ceiling.
const TOO_LONG_PHONE = '1'.repeat(33);

const validJob = {
  title: 'Software Engineer',
  company: 'Acme Corp',
  location: 'Remote',
  workType: 'Remote',
  employmentType: 'Full-time',
  experienceLevel: 'Mid-level',
  category: 'Engineering',
};

const baselineProfile = {
  fullName: 'Jane Recruiter',
  location: 'Remote',
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
});

describe('Profile phone format guard', () => {
  it('accepts the existing supported phone formats', async () => {
    let i = 0;
    for (const phone of SUPPORTED_PHONE_FORMATS) {
      i += 1;
      const recruiter = await makeUser(`profile-ok-${i}@example.com`, 'recruiter');
      const token = signTokenFor(recruiter);
      const res = await request('POST', '/api/profile', {
        token,
        body: { ...baselineProfile, phone },
      });
      assert.equal(
        res.status,
        201,
        `expected ${phone} to be accepted, got ${res.status} ${res.raw}`
      );
    }
  });

  it('rejects characters outside PHONE_CHARS_RE', async () => {
    const recruiter = await makeUser('profile-bad@example.com', 'recruiter');
    const token = signTokenFor(recruiter);

    for (const phone of INVALID_CHAR_PHONES) {
      const res = await request('POST', '/api/profile', {
        token,
        body: { ...baselineProfile, phone },
      });
      assert.equal(
        res.status,
        400,
        `expected ${phone} to be rejected, got ${res.status} ${res.raw}`
      );
      assert.equal(res.body.fieldErrors.phone, 'Invalid phone format');
    }

    const tooLong = await request('POST', '/api/profile', {
      token,
      body: { ...baselineProfile, phone: TOO_LONG_PHONE },
    });
    assert.equal(tooLong.status, 400);
    assert.equal(tooLong.body.fieldErrors.phone, 'Invalid phone format');
  });

  it('enforces the same rule at the model layer', async () => {
    const recruiter = await makeUser('profile-model@example.com', 'recruiter');

    const ok = await Profile.create({
      userId: recruiter._id,
      role: 'recruiter',
      fullName: 'Jane Recruiter',
      phone: '+1-555-0100',
    });
    assert.equal(ok.phone, '+1-555-0100');

    await assert.rejects(
      Profile.create({
        userId: new mongoose.Types.ObjectId(),
        role: 'recruiter',
        fullName: 'Jane Recruiter',
        phone: 'not-a-phone',
      })
    );
  });
});

describe('Application phone format guard', () => {
  const seedJobAndJobseeker = async (email) => {
    const recruiter = await makeUser(`${email}-recruiter@example.com`, 'recruiter');
    const jobseeker = await makeUser(`${email}-jobseeker@example.com`, 'jobseeker');
    await Profile.create({
      userId: jobseeker._id,
      role: 'jobseeker',
      fullName: 'Jane Applicant',
      phone: '+1-555-0100',
    });
    const job = await Job.create({ ...validJob, postedBy: recruiter._id });
    return { jobseeker, job, jobseekerToken: signTokenFor(jobseeker) };
  };

  it('accepts the existing supported phone formats', async () => {
    const { jobseeker, job, jobseekerToken } = await seedJobAndJobseeker('apply-ok');

    for (const phone of SUPPORTED_PHONE_FORMATS) {
      const res = await request('POST', '/api/applications', {
        token: jobseekerToken,
        body: {
          jobId: job._id,
          fullName: 'Jane Applicant',
          email: 'jane@example.com',
          phone,
          resumeUrl: '/uploads/resumes/jane.pdf',
        },
      });
      await Application.deleteMany({ jobId: job._id, userId: jobseeker._id });
      assert.equal(
        res.status,
        201,
        `expected ${phone} to be accepted, got ${res.status} ${res.raw}`
      );
    }
  });

  it('rejects invalid-character input when the client is bypassed', async () => {
    const { job, jobseekerToken } = await seedJobAndJobseeker('apply-bad');

    for (const phone of INVALID_CHAR_PHONES) {
      const res = await request('POST', '/api/applications', {
        token: jobseekerToken,
        body: {
          jobId: job._id,
          fullName: 'Jane Applicant',
          email: 'jane@example.com',
          phone,
          resumeUrl: '/uploads/resumes/jane.pdf',
        },
      });
      assert.equal(
        res.status,
        400,
        `expected ${phone} to be rejected, got ${res.status} ${res.raw}`
      );
      assert.equal(res.body.fieldErrors.phone, 'Invalid phone format');
    }

    // Over-long phones still hit the existing 32-char ceiling first.
    const tooLong = await request('POST', '/api/applications', {
      token: jobseekerToken,
      body: {
        jobId: job._id,
        fullName: 'Jane Applicant',
        email: 'jane@example.com',
        phone: TOO_LONG_PHONE,
        resumeUrl: '/uploads/resumes/jane.pdf',
      },
    });
    assert.equal(tooLong.status, 400);
    assert.equal(tooLong.body.fieldErrors.phone, 'Phone must be at most 32 characters');
  });

  it('remains optional', async () => {
    const { job, jobseekerToken } = await seedJobAndJobseeker('apply-optional');

    // Unset phone entirely must still pass as an optional field; the stored
    // phone falls back to '' exactly like the model's default.
    const res = await request('POST', '/api/applications', {
      token: jobseekerToken,
      body: {
        jobId: job._id,
        fullName: 'Jane Applicant',
        email: 'jane@example.com',
        resumeUrl: '/uploads/resumes/jane.pdf',
      },
    });
    assert.equal(res.status, 201);

    const stored = await Application.findOne({ jobId: job._id });
    assert.equal(stored.phone, '');
  });

  it('keeps existing application validation behavior intact', async () => {
    const { job, jobseekerToken } = await seedJobAndJobseeker('apply-existing');

    // Empty phone is still treated as missing.
    const emptyPhone = await request('POST', '/api/applications', {
      token: jobseekerToken,
      body: {
        jobId: job._id,
        fullName: 'Jane Applicant',
        email: 'jane@example.com',
        phone: '',
        resumeUrl: '/uploads/resumes/jane.pdf',
      },
    });
    assert.equal(emptyPhone.status, 400);
    assert.equal(emptyPhone.body.fieldErrors.phone, 'Phone number is required');

    // Other existing rules are untouched.
    const badEmail = await request('POST', '/api/applications', {
      token: jobseekerToken,
      body: {
        jobId: job._id,
        fullName: 'Jane Applicant',
        email: 'not-an-email',
        phone: '+1-555-0199',
        resumeUrl: '/uploads/resumes/jane.pdf',
      },
    });
    assert.equal(badEmail.status, 400);
  });
});