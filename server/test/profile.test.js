const { before, after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const dns = require('node:dns');
const fs = require('node:fs');
const path = require('node:path');

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
const { UPLOAD_ROOT, AVATAR_DIR, publicPathFor } = require('../src/config/uploads');

// Distinct DB so this file can run concurrently with other test files.
const TEST_DB_NAME = 'hireflow_test_profiles';

let server;
let baseUrl;

const makeUser = async (email, role = 'recruiter') => {
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

const validProfile = {
  fullName: 'Jane Recruiter',
  phone: '+1-555-0100',
  location: 'Remote',
};

const createRecruiterWithProfile = async (email) => {
  const recruiter = await makeUser(email, 'recruiter');
  const token = signTokenFor(recruiter);
  const res = await request('POST', '/api/profile', { token, body: validProfile });
  assert.equal(res.status, 201);
  return { user: recruiter, token, profileId: res.body.id };
};

const writeFixtures = (count) => {
  // Safe fixtures OUTSIDE the avatar/upload directories but on the same drive
  // as UPLOAD_ROOT so path.relative() yields `../` traversal. These must
  // survive any malicious delete attempt.
  const dir = fs.mkdtempSync(path.join(__dirname, '.tmp-fixtures-'));
  const files = [];
  for (let i = 0; i < count; i += 1) {
    const f = path.join(dir, `outside-fixture-${i}.txt`);
    fs.writeFileSync(f, 'DO NOT DELETE');
    files.push(f);
  }
  return { dir, files };
};

const removeDir = (dir) => {
  fs.rmSync(dir, { recursive: true, force: true });
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

describe('avatar upload (server-controlled avatarUrl)', () => {
  it('uploads and serves a local avatar, then removes it', async () => {
    const { user, token } = await createRecruiterWithProfile('upload-avatar@example.com');

    const fd = new FormData();
    fd.append('avatar', new Blob(['fake-image-bytes'], { type: 'image/png' }), 'avatar.png');
    const uploadRes = await fetch(`${baseUrl}/api/profile/upload/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    assert.equal(uploadRes.status, 200);
    const uploaded = await uploadRes.json();
    assert.match(uploaded.avatarUrl, /^\/uploads\/avatars\/[^/]+\.png$/);
    assert.equal(String(uploaded.userId), String(user._id));

    const fileOnDisk = path.join(UPLOAD_ROOT, uploaded.avatarUrl.slice('/uploads/'.length));
    assert.ok(fs.existsSync(fileOnDisk), 'uploaded avatar file should exist on disk');

    const removeRes = await request('DELETE', '/api/profile/avatar', { token });
    assert.equal(removeRes.status, 200);
    assert.equal(removeRes.body.avatarUrl, '');
    assert.ok(!fs.existsSync(fileOnDisk), 'avatar file should be deleted on removal');
  });
});

describe('IDOR guard: avatarUrl is not client-controllable', () => {
  it('silently drops avatarUrl sent to PATCH /api/profile', async () => {
    const { token } = await createRecruiterWithProfile('patch-drop@example.com');
    const malicious = '/uploads/../src/config/env.js';

    // PATCH validators still require the shared required fields.
    const res = await request('PATCH', '/api/profile', {
      token,
      body: { ...validProfile, avatarUrl: malicious, jobTitle: 'Hiring Manager' },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.avatarUrl, '');

    const stored = await Profile.findOne({ userId: res.body.userId });
    assert.equal(stored.avatarUrl, '');
  });

  it('silently drops avatarUrl sent to PUT /api/profile', async () => {
    const { token } = await createRecruiterWithProfile('put-drop@example.com');
    const malicious = '/uploads/../src/config/env.js';

    const res = await request('PUT', '/api/profile', {
      token,
      body: { ...validProfile, avatarUrl: malicious },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.avatarUrl, '');

    const stored = await Profile.findOne({ userId: res.body.userId });
    assert.equal(stored.avatarUrl, '');
  });

  it('silently drops avatarUrl sent on profile creation', async () => {
    const recruiter = await makeUser('create-drop@example.com', 'recruiter');
    const token = signTokenFor(recruiter);

    const res = await request('POST', '/api/profile', {
      token,
      body: { ...validProfile, avatarUrl: '/uploads/../src/config/env.js' },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.avatarUrl, '');

    const stored = await Profile.findOne({ userId: res.body.userId });
    assert.equal(stored.avatarUrl, '');
  });
});

describe('path-traversal guard: avatar removal', () => {
  it('legitimate local avatar is still removed and avatarUrl cleared', async () => {
    const { user, token } = await createRecruiterWithProfile('legit-remove@example.com');

    // Plant a real avatar file inside AVATAR_DIR and point the profile at it.
    const fileOnDisk = path.join(AVATAR_DIR, `legit-${Date.now()}.png`);
    fs.writeFileSync(fileOnDisk, 'avatar-bytes');
    const avatarUrl = publicPathFor(fileOnDisk);
    await Profile.updateOne({ userId: user._id }, { $set: { avatarUrl } });
    assert.match(avatarUrl, /^\/uploads\/avatars\/[^/]+/);

    const res = await request('DELETE', '/api/profile/avatar', { token });
    assert.equal(res.status, 200);
    assert.equal(res.body.avatarUrl, '');
    assert.ok(!fs.existsSync(fileOnDisk), 'legit avatar file should be deleted');
  });

  it('cannot delete a fixture outside the avatar dir via traversal avatarUrl', async () => {
    const { user, token } = await createRecruiterWithProfile('traversal@example.com');
    const { dir, files } = writeFixtures(1);
    try {
      // Craft the same malicious URL the old client-set value could hold:
      // a relative path that walks up out of the upload root to the fixture.
      const maliciousUrl = publicPathFor(files[0]);
      assert.ok(maliciousUrl.includes('..'), 'fixture must sit outside the upload root');

      await Profile.updateOne({ userId: user._id }, { $set: { avatarUrl: maliciousUrl } });

      const res = await request('DELETE', '/api/profile/avatar', { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.avatarUrl, '');

      assert.ok(fs.existsSync(files[0]), 'fixture outside avatar dir must be untouched');
    } finally {
      removeDir(dir);
    }
  });

  it('cannot delete a fixture outside the avatar dir via an absolute avatarUrl', async () => {
    const { user, token } = await createRecruiterWithProfile('absolute@example.com');
    const { dir, files } = writeFixtures(1);
    try {
      const absolutePath = files[0];
      assert.ok(path.isAbsolute(absolutePath));

      await Profile.updateOne({ userId: user._id }, { $set: { avatarUrl: absolutePath } });

      const res = await request('DELETE', '/api/profile/avatar', { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.avatarUrl, '');

      assert.ok(fs.existsSync(files[0]), 'fixture targeted by absolute path must be untouched');
    } finally {
      removeDir(dir);
    }
  });

  it('does not delete a resume living inside uploads but outside the avatar dir', async () => {
    const { user, token } = await createRecruiterWithProfile('resume-protect@example.com');
    const resumeDir = path.join(UPLOAD_ROOT, 'resumes');
    const fileOnDisk = path.join(resumeDir, `guarded-${Date.now()}.pdf`);
    fs.writeFileSync(fileOnDisk, 'resume-bytes');
    try {
      const resumeUrl = publicPathFor(fileOnDisk);
      assert.match(resumeUrl, /^\/uploads\/resumes\//);

      await Profile.updateOne({ userId: user._id }, { $set: { avatarUrl: resumeUrl } });

      const res = await request('DELETE', '/api/profile/avatar', { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.avatarUrl, '');

      assert.ok(fs.existsSync(fileOnDisk), 'resume outside avatar dir must be untouched');
    } finally {
      fs.rmSync(fileOnDisk, { force: true });
    }
  });

  it('returns 404 when there is no profile to remove an avatar from', async () => {
    const recruiter = await makeUser('no-profile-remove@example.com', 'recruiter');
    const res = await request('DELETE', '/api/profile/avatar', {
      token: signTokenFor(recruiter),
    });
    assert.equal(res.status, 404);
  });
});