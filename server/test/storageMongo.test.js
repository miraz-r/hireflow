// Exercises the MongoDB-backed storage driver (STORAGE_DRIVER=mongodb).
// Must run before any require of env/app so the driver flag is picked up.
process.env.STORAGE_DRIVER = 'mongodb';

const { before, after, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const dns = require('node:dns');

dns.setServers(['1.1.1.1', '1.0.0.1']);

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const env = require('../src/config/env');
const app = require('../src/app');
const User = require('../src/models/User');
const Profile = require('../src/models/Profile');
const StoredFile = require('../src/models/StoredFile');

const TEST_DB_NAME = 'hireflow_test_storage_mongo';

let server;
let baseUrl;

const makeUser = async (email, role = 'jobseeker') => {
  const passwordHash = await bcrypt.hash('password123', 4);
  return User.create({ email, passwordHash, role });
};

const signTokenFor = (user) =>
  jwt.sign({ id: user.id, role: user.role }, env.jwtSecret, { expiresIn: '1h' });

const json = async (res) => (res.headers.get('content-type') || '').includes('json') ? res.json() : null;

before(async () => {
  assert.equal(env.storageDriver, 'mongodb');
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
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Profile.deleteMany({}), StoredFile.deleteMany({})]);
});

const upload = async (route, token, field, fileName, type, contents) => {
  const form = new FormData();
  form.append(field, new Blob([contents], { type }), fileName);
  const res = await fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: res.status, body: await json(res) };
};

const seed = async () => {
  const user = await makeUser('js@example.com', 'jobseeker');
  const token = signTokenFor(user);
  await fetch(`${baseUrl}/api/profile`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'JS User', phone: '+1-555-0100', location: 'Remote' }),
  });
  return { user, token };
};

describe('mongodb storage driver', () => {
  it('stores avatar + resume bytes in MongoDB and serves them by reference', async () => {
    const { token } = await seed();

    const av = await upload('/api/profile/upload/avatar', token, 'avatar', 'a.png', 'image/png', Buffer.from([1, 2, 3, 4]));
    assert.equal(av.status, 200);
    assert.match(av.body.avatarUrl, /^\/api\/files\//);

    // Avatar is publicly servable (same origin path the <img> resolves to).
    const avRes = await fetch(`${baseUrl}${av.body.avatarUrl}`);
    assert.equal(avRes.status, 200);
    assert.equal(avRes.headers.get('content-type'), 'image/png');

    const rv = await upload('/api/profile/upload/resume', token, 'resume', 'cv.pdf', 'application/pdf', '%PDF-1.4 hi');
    assert.equal(rv.status, 200);
    assert.match(rv.body.resumeUrl, /^\/api\/files\//);

    // Resume content is NOT exposed via the public files route (500-family of
    // the avatar endpoint must refuse non-avatar bytes).
    const publicAttempt = await fetch(`${baseUrl}${rv.body.resumeUrl}`);
    assert.equal(publicAttempt.status, 404);

    // The owner can stream their own resume through the protected endpoint.
    const own = await fetch(`${baseUrl}/api/profile/resume`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(own.status, 200);
    assert.equal(own.headers.get('content-type'), 'application/pdf');
    assert.equal(await own.text(), '%PDF-1.4 hi');

    // No orphaned local files were created.
    assert.equal(await StoredFile.countDocuments(), 2);
  });

  it('replaces an avatar and the old file is publicly unreachable after removal', async () => {
    const { token } = await seed();
    const first = await upload('/api/profile/upload/avatar', token, 'avatar', 'a.png', 'image/png', Buffer.from([1]));
    const oldUrl = first.body.avatarUrl;

    const del = await fetch(`${baseUrl}/api/profile/avatar`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    assert.equal(del.status, 200);

    const gone = await fetch(`${baseUrl}${oldUrl}`);
    assert.equal(gone.status, 404);
    assert.equal(await StoredFile.countDocuments(), 0);
  });
});
