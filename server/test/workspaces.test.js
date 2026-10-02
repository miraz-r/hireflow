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
const SavedJob = require('../src/models/SavedJob');

// Distinct DB so this file can run concurrently with other test files.
const TEST_DB_NAME = 'hireflow_test_workspaces';

let server;
let baseUrl;

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

const VALID_PHONE = '+8801712345678';

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
    SavedJob.deleteMany({}),
  ]);
});

let counter = 0;
const nextEmail = (prefix) => {
  counter += 1;
  return `${prefix}-${counter}@example.com`;
};

// Signup is exercised through the real endpoint only in the signup suite —
// /api/auth/register is rate limited to 10 per hour per IP, so the rest of the
// file seeds accounts directly through the models (same pattern the other test
// files use).
const registerViaApi = async (prefix, role) => {
  const email = nextEmail(prefix);
  const body = { email, password: 'password123', fullName: 'Dual Person', phone: VALID_PHONE };
  if (role) body.role = role;
  const res = await request('POST', '/api/auth/register', { body });
  assert.equal(res.status, 201, res.raw);
  return { email, user: res.body.user };
};

// Creates an account with a profile for its active workspace.
const makeAccount = async (prefix, role) => {
  const passwordHash = await bcrypt.hash('password123', 4);
  const email = nextEmail(prefix);
  const user = await User.create({ email, passwordHash, role });
  await Profile.create({
    userId: user._id,
    role,
    fullName: 'Dual Person',
    phone: VALID_PHONE,
    location: 'Remote',
  });
  return { user, email, token: signTokenFor(user) };
};

// A recruiter who owns jobs, used as the "other party" when an account applies.
const makeJobOwner = async (prefix) => {
  const { user } = await makeAccount(prefix, 'recruiter');
  await Profile.updateOne(
    { userId: user._id },
    { $set: { companyName: 'Acme Corp', jobTitle: 'Talent Lead' } }
  );
  return user;
};

const makeJobFor = async (ownerId, overrides = {}) =>
  Job.create({ ...baseJob(), postedBy: ownerId, ...overrides });

const applyToJob = async (token, jobId) => {
  const res = await request('POST', '/api/applications', {
    token,
    body: {
      jobId,
      phone: VALID_PHONE,
      resumeUrl: '/uploads/resumes/cv.pdf',
      fullName: 'Dual Person',
    },
  });
  assert.equal(res.status, 201, res.raw);
  return res.body;
};

const switchTo = async (token, role) => {
  const res = await request('POST', '/api/auth/role', { token, body: { role } });
  assert.equal(res.status, 200, res.raw);
  return res.body;
};

// ---------------------------------------------------------------------------
describe('signup: initial workspace choice', () => {
  it('creates a jobseeker account and jobseeker profile by default', async () => {
    const { email, user } = await registerViaApi('signup-js');
    assert.equal(user.role, 'jobseeker');
    assert.deepEqual(user.workspaces, ['jobseeker']);

    const profile = await Profile.findOne({ userId: user.id, role: 'jobseeker' }).lean();
    assert.equal(profile.fullName, 'Dual Person');
    // Recruiter-only fields stay at their schema defaults, not the jobseeker's.
    assert.equal(profile.companyName, '');
  });

  it('creates a recruiter account and recruiter profile when recruiter is chosen', async () => {
    const { email, user } = await registerViaApi('signup-rec', 'recruiter');
    assert.equal(user.role, 'recruiter');
    assert.deepEqual(user.workspaces, ['recruiter']);

    const profile = await Profile.findOne({ userId: user.id, role: 'recruiter' }).lean();
    assert.equal(profile.fullName, 'Dual Person');
    const jsProfile = await Profile.findOne({ userId: user.id, role: 'jobseeker' }).lean();
    assert.equal(jsProfile, null, 'should not create the other workspace profile');
  });

  it('rejects an invalid initial workspace', async () => {
    const res = await request('POST', '/api/auth/register', {
      body: {
        email: nextEmail('signup-bad'),
        password: 'password123',
        fullName: 'X',
        phone: VALID_PHONE,
        role: 'admin',
      },
    });
    assert.equal(res.status, 400);
  });
});

// ---------------------------------------------------------------------------
describe('login reports the active workspace and available workspaces', () => {
  it('returns the active workspace plus every workspace the account holds', async () => {
    const { email, user } = await makeAccount('login-dual', 'jobseeker');
    const first = await request('POST', '/api/auth/login', {
      body: { email, password: 'password123' },
    });
    assert.equal(first.status, 200);
    assert.equal(first.body.user.role, 'jobseeker');
    assert.deepEqual(first.body.user.workspaces, ['jobseeker']);

    const switched = await switchTo(signTokenFor(user), 'recruiter');
    assert.deepEqual(switched.user.workspaces.sort(), ['jobseeker', 'recruiter']);

    const second = await request('POST', '/api/auth/login', {
      body: { email, password: 'password123' },
    });
    assert.equal(second.body.user.role, 'recruiter');
    assert.deepEqual(second.body.user.workspaces.sort(), ['jobseeker', 'recruiter']);
    // Same account identity across the switch.
    assert.equal(second.body.user.id, user.id);
  });

  it('/auth/me reports the active workspace and its profile name', async () => {
    const { email, user } = await makeAccount('me-dual', 'jobseeker');
    const switched = await switchTo(signTokenFor(user), 'recruiter');

    const me = await request('GET', '/api/auth/me', { token: switched.token });
    assert.equal(me.status, 200);
    assert.equal(me.body.role, 'recruiter');
    assert.deepEqual(me.body.workspaces.sort(), ['jobseeker', 'recruiter']);
    assert.equal(me.body.fullName, 'Dual Person');
    assert.equal(me.body.id, user.id);
  });
});

// ---------------------------------------------------------------------------
describe('workspace navigation preserves both profiles', () => {
  it('keeps both profiles intact across jobseeker -> recruiter -> jobseeker', async () => {
    const { user } = await makeAccount('round-trip', 'jobseeker');
    const jsProfile = await Profile.findOne({ userId: user.id, role: 'jobseeker' });

    // Fill in the jobseeker workspace.
    const jsSave = await request('PUT', '/api/profile', {
      token: signTokenFor(user),
      body: {
        fullName: 'Dual Person',
        phone: VALID_PHONE,
        location: 'Remote',
        headline: 'Backend Engineer',
        bio: 'Writes services.',
        skills: ['Node.js'],
        experience: [{ company: 'Acme', title: 'Eng', startDate: '2022-01-01T00:00:00.000Z', current: true }],
        education: [{ school: 'MIT', degree: 'BSc' }],
        links: [{ label: 'Site', url: 'https://example.com' }],
      },
    });
    assert.equal(jsSave.status, 200, jsSave.raw);
    assert.equal(jsSave.body.headline, 'Backend Engineer');
    await Profile.updateOne(
      { _id: jsProfile._id },
      { $set: { resumeUrl: '/uploads/resumes/mine.pdf', resumeName: 'mine.pdf' } }
    );

    // Open the recruiter workspace.
    const recruiterToken = (await switchTo(signTokenFor(user), 'recruiter')).token;
    const recProfile = await Profile.findOne({ userId: user.id, role: 'recruiter' }).lean();
    assert.ok(recProfile, 'recruiter workspace gets its own profile');
    assert.equal(recProfile.fullName, 'Dual Person', 'seeded with identity only');
    assert.equal(recProfile.companyName, '');

    // Fill in the recruiter workspace.
    const recSave = await request('PATCH', '/api/profile', {
      token: recruiterToken,
      body: { fullName: 'Dual Person', phone: VALID_PHONE, location: 'Remote', jobTitle: 'Talent Lead', companyName: 'Globex' },
    });
    assert.equal(recSave.status, 200, recSave.raw);
    assert.equal(recSave.body.companyName, 'Globex');
    // Recruiter-side writes must not touch the jobseeker profile.
    assert.equal(recSave.body.headline, '');

    // Switch back: the jobseeker profile is exactly as it was.
    await switchTo(recruiterToken, 'jobseeker');
    const jsAfter = await Profile.findOne({ userId: user.id, role: 'jobseeker' }).lean();
    assert.equal(jsAfter.headline, 'Backend Engineer');
    assert.equal(jsAfter.bio, 'Writes services.');
    assert.deepEqual(jsAfter.skills, ['Node.js']);
    assert.equal(jsAfter.resumeUrl, '/uploads/resumes/mine.pdf');
    assert.equal(jsAfter.experience.length, 1);
    assert.equal(jsAfter.education.length, 1);
    assert.equal(jsAfter.links.length, 1);

    // And the recruiter profile is still intact too.
    const recAfter = await Profile.findOne({ userId: user.id, role: 'recruiter' }).lean();
    assert.equal(recAfter.jobTitle, 'Talent Lead');
    assert.equal(recAfter.companyName, 'Globex');
  });

  it('a recruiter-workspace session reads and writes only the recruiter profile', async () => {
    const { user } = await makeAccount('workspace-isolation', 'jobseeker');
    await request('PUT', '/api/profile', {
      token: signTokenFor(user),
      body: {
        fullName: 'Dual Person',
        phone: VALID_PHONE,
        location: 'Remote',
        headline: 'Frontend Developer',
        skills: ['React'],
      },
    });

    const recruiterToken = (await switchTo(signTokenFor(user), 'recruiter')).token;

    const me = await request('GET', '/api/profile', { token: recruiterToken });
    assert.equal(me.status, 200);
    assert.equal(me.body.role, 'recruiter');
    // The jobseeker's headline is not visible from the recruiter workspace.
    assert.equal(me.body.headline, '');

    // Recruiter-only field writes are accepted here...
    const ok = await request('PATCH', '/api/profile', {
      token: recruiterToken,
      body: { fullName: 'Dual Person', phone: VALID_PHONE, location: 'Remote', companyName: 'Globex' },
    });
    assert.equal(ok.status, 200, ok.raw);

    // ...and the jobseeker profile is unchanged afterwards.
    const js = await Profile.findOne({ userId: user.id, role: 'jobseeker' }).lean();
    assert.equal(js.headline, 'Frontend Developer');
    assert.equal(js.companyName, '');
  });

  it('does not leak jobseeker-only fields into a recruiter profile write', async () => {
    const { user } = await makeAccount('cross-write', 'jobseeker');
    const recruiterToken = (await switchTo(signTokenFor(user), 'recruiter')).token;

    const res = await request('PATCH', '/api/profile', {
      token: recruiterToken,
      body: { fullName: 'Dual Person', phone: VALID_PHONE, location: 'Remote', headline: 'Should not be accepted' },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /headline/);
  });
});

// ---------------------------------------------------------------------------
describe('account data stays with the same user id across workspaces', () => {
  it('keeps applications, saved jobs, and posted jobs on the same account', async () => {
    const { user } = await makeAccount('data-owner', 'jobseeker');
    const jobOwner = await makeJobOwner('data-recruiter');
    const job = await makeJobFor(jobOwner._id);

    // Jobseeker activity in the jobseeker workspace.
    const application = await applyToJob(signTokenFor(user), job._id);
    const saveRes = await request('POST', '/api/saved-jobs', {
      token: signTokenFor(user),
      body: { jobId: job._id },
    });
    assert.equal(saveRes.status, 201, saveRes.raw);

    const userIdBefore = String(user.id);

    // Move to the recruiter workspace and post a job as a recruiter too.
    const dualRecruiterToken = (await switchTo(signTokenFor(user), 'recruiter')).token;
    const posted = await Job.create({ ...baseJob({ title: 'Recruiter Role' }), postedBy: user.id });

    // The user id never changed.
    const after = await User.findById(userIdBefore);
    assert.equal(String(after._id), userIdBefore);

    // Applications and saved jobs still point at the same account.
    const appDoc = await Application.findById(application._id).lean();
    assert.equal(String(appDoc.userId), userIdBefore);
    const savedDocs = await SavedJob.find({ userId: userIdBefore }).lean();
    assert.equal(savedDocs.length, 1);
    assert.equal(String(savedDocs[0].jobId), String(job._id));

    // The recruiter-posted job is intact.
    const postedDoc = await Job.findById(posted._id).lean();
    assert.equal(String(postedDoc.postedBy), userIdBefore);
    assert.equal(postedDoc.title, 'Recruiter Role');

    // Switching back leaves all of it untouched.
    await switchTo(dualRecruiterToken, 'jobseeker');
    const stillSaved = await SavedJob.countDocuments({ userId: userIdBefore });
    assert.equal(stillSaved, 1);
    const stillPosted = await Job.countDocuments({ postedBy: userIdBefore });
    assert.equal(stillPosted, 1);
    const stillApplied = await Application.countDocuments({ userId: userIdBefore });
    assert.equal(stillApplied, 1);
  });

  it('lets a recruiter-workspace session read its own applications and saved jobs', async () => {
    const { user } = await makeAccount('own-reads', 'jobseeker');
    const jobOwner = await makeJobOwner('own-reads-rec');
    const job = await makeJobFor(jobOwner._id);

    await applyToJob(signTokenFor(user), job._id);
    await request('POST', '/api/saved-jobs', {
      token: signTokenFor(user),
      body: { jobId: job._id },
    });

    const dualRecruiterToken = (await switchTo(signTokenFor(user), 'recruiter')).token;

    // Reads of the caller's OWN data are allowed in any workspace.
    const apps = await request('GET', '/api/applications/my-applications', {
      token: dualRecruiterToken,
    });
    assert.equal(apps.status, 200, apps.raw);
    assert.equal(apps.body.applications.length, 1);

    const saved = await request('GET', '/api/saved-jobs', { token: dualRecruiterToken });
    assert.equal(saved.status, 200, saved.raw);
    assert.equal(saved.body.savedJobs.length, 1);

    const check = await request('GET', `/api/saved-jobs/check/${job._id}`, {
      token: dualRecruiterToken,
    });
    assert.equal(check.status, 200, check.raw);
    assert.equal(check.body.saved, true);

    const me = await request('GET', `/api/applications/${job._id}/me`, {
      token: dualRecruiterToken,
    });
    assert.equal(me.status, 200, me.raw);
    assert.equal(me.body.applied, true);
  });

  it('still blocks jobseeker ACTIONS in the recruiter workspace', async () => {
    const { user } = await makeAccount('action-gate', 'jobseeker');
    const jobOwner = await makeJobOwner('action-gate-rec');
    const job = await makeJobFor(jobOwner._id);

    const dualRecruiterToken = (await switchTo(signTokenFor(user), 'recruiter')).token;

    const apply = await request('POST', '/api/applications', {
      token: dualRecruiterToken,
      body: { jobId: job._id, phone: VALID_PHONE, resumeUrl: '/uploads/resumes/cv.pdf' },
    });
    assert.equal(apply.status, 403);

    const save = await request('POST', '/api/saved-jobs', {
      token: dualRecruiterToken,
      body: { jobId: job._id },
    });
    assert.equal(save.status, 403);

    const unsave = await request('DELETE', `/api/saved-jobs/${job._id}`, {
      token: dualRecruiterToken,
    });
    assert.equal(unsave.status, 403);

    // Switching back allows them again.
    const jsToken = (await switchTo(dualRecruiterToken, 'jobseeker')).token;
    const saveAgain = await request('POST', '/api/saved-jobs', {
      token: jsToken,
      body: { jobId: job._id },
    });
    assert.equal(saveAgain.status, 201, saveAgain.raw);
  });

  it('never lets one account read another account’s data', async () => {
    const a = await makeAccount('acct-a', 'jobseeker');
    const b = await makeAccount('acct-b', 'jobseeker');
    const jobOwner = await makeJobOwner('acct-a-rec');
    const job = await makeJobFor(jobOwner._id);

    await applyToJob(signTokenFor(a.user), job._id);
    await request('POST', '/api/saved-jobs', {
      token: signTokenFor(a.user),
      body: { jobId: job._id },
    });

    const bToken = (await switchTo(signTokenFor(b.user), 'recruiter')).token;

    const bApps = await request('GET', '/api/applications/my-applications', { token: bToken });
    assert.equal(bApps.body.applications.length, 0);

    const bSaved = await request('GET', '/api/saved-jobs', { token: bToken });
    assert.equal(bSaved.body.savedJobs.length, 0);
  });
});

// ---------------------------------------------------------------------------
describe('admin restrictions are preserved', () => {
  it('refuses to switch the admin workspace', async () => {
    const passwordHash = await bcrypt.hash('password123', 4);
    const admin = await User.create({
      email: nextEmail('ws-admin'),
      passwordHash,
      role: 'admin',
    });
    await Profile.create({
      userId: admin._id,
      role: 'admin',
      fullName: 'The Admin',
      phone: VALID_PHONE,
    });

    const res = await request('POST', '/api/auth/role', {
      token: signTokenFor(admin),
      body: { role: 'jobseeker' },
    });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /Admin role cannot be changed/);

    const unchanged = await User.findById(admin._id).lean();
    assert.equal(unchanged.role, 'admin');
  });

  it('a jobseeker or recruiter cannot reach admin routes', async () => {
    const js = await makeAccount('no-admin-js', 'jobseeker');
    const rec = await makeAccount('no-admin-rec', 'recruiter');

    for (const account of [js, rec]) {
      const list = await request('GET', '/api/admin/applications', {
        token: signTokenFor(account.user),
      });
      assert.equal(list.status, 403);
    }
  });

  it('switching does not create a second profile for the same workspace', async () => {
    const { user } = await makeAccount('no-dupes', 'jobseeker');
    // Each switch re-issues a token carrying the new active workspace; the
    // authenticate middleware rejects a stale one, so chain the new tokens.
    const first = await switchTo(signTokenFor(user), 'recruiter');
    const second = await switchTo(first.token, 'jobseeker');
    await switchTo(second.token, 'recruiter');

    const profiles = await Profile.find({ userId: user.id }).lean();
    assert.equal(profiles.length, 2);
    const jobseekerRows = profiles.filter((p) => p.role === 'jobseeker');
    const recruiterRows = profiles.filter((p) => p.role === 'recruiter');
    assert.equal(jobseekerRows.length, 1);
    assert.equal(recruiterRows.length, 1);
  });

  it('requires authentication to switch', async () => {
    const res = await request('POST', '/api/auth/role', { body: { role: 'recruiter' } });
    assert.equal(res.status, 401);
  });

  it('rejects an invalid workspace value', async () => {
    const { user } = await makeAccount('bad-ws', 'jobseeker');
    const res = await request('POST', '/api/auth/role', {
      token: signTokenFor(user),
      body: { role: 'admin' },
    });
    assert.equal(res.status, 400);
  });
});

// ---------------------------------------------------------------------------
describe('workspace switch failure mode: deployment missing the profile index', () => {
  // An account needs one profile per workspace, so the collection's legacy
  // `userId_1` unique index (one profile per ACCOUNT) must be replaced by the
  // compound {userId, role} index. Mongoose can create the new index on boot
  // but cannot drop the old one, so a database that has not run
  // profileWorkspaces.migration.js ends up with BOTH.
  //
  // With the legacy index present, opening the second workspace can never
  // succeed. Before this was handled explicitly, the endpoint returned an opaque
  // 500 and the navbar's bare catch swallowed it, so the button looked dead.
  // The contract is now: a specific, actionable 409, the role left unchanged,
  // and no half-created profile.
  it('returns an actionable 409 and leaves the workspace unchanged', async () => {
    const { user } = await makeAccount('legacy-index', 'recruiter');

    // Reproduce a not-yet-migrated collection. The schema's plain
    // `index: true` on userId normally creates a NON-unique `userId_1`; the
    // stale index left by the previous schema is a UNIQUE one with the same
    // name, so drop it first and recreate it as unique.
    await Profile.collection.dropIndex('userId_1').catch(() => {});
    await Profile.collection.createIndex({ userId: 1 }, { unique: true, name: 'userId_1' });

    try {
      const res = await request('POST', '/api/auth/role', {
        token: signTokenFor(user),
        body: { role: 'jobseeker' },
      });

      assert.equal(res.status, 409);
      assert.equal(res.body.code, 'PROFILE_WORKSPACES_MIGRATION_PENDING');
      assert.match(res.body.error, /migrate:profile-workspaces/);
      // No token is issued, so the client cannot end up half-switched.
      assert.equal(res.body.token, undefined);

      // The account is still in its original workspace.
      const after = await User.findById(user.id).lean();
      assert.equal(after.role, 'recruiter');

      // No stray/partial profile was left behind.
      const profiles = await Profile.find({ userId: user.id }).select('role').lean();
      assert.equal(profiles.length, 1);
      assert.equal(profiles[0].role, 'recruiter');
    } finally {
      await Profile.collection.dropIndex('userId_1').catch(() => {});
    }
  });

  it('switches normally once the legacy index is gone', async () => {
    const { user } = await makeAccount('post-migration', 'recruiter');

    const res = await request('POST', '/api/auth/role', {
      token: signTokenFor(user),
      body: { role: 'jobseeker' },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'jobseeker');

    // And switching back works, with the recruiter profile preserved.
    const back = await request('POST', '/api/auth/role', {
      token: res.body.token,
      body: { role: 'recruiter' },
    });
    assert.equal(back.status, 200);
    assert.equal(back.body.user.role, 'recruiter');

    const recruiterProfile = await Profile.findOne({
      userId: user.id,
      role: 'recruiter',
    }).lean();
    assert.ok(recruiterProfile, 'the recruiter profile must survive the round trip');
  });
});

describe('account deletion removes data from every workspace', () => {
  it('deletes all workspace profiles plus applications, saved jobs, and posted jobs', async () => {
    const { user } = await makeAccount('delete-all', 'jobseeker');
    const jobOwner = await makeJobOwner('delete-all-rec');
    const job = await makeJobFor(jobOwner._id);

    await applyToJob(signTokenFor(user), job._id);
    await request('POST', '/api/saved-jobs', {
      token: signTokenFor(user),
      body: { jobId: job._id },
    });
    const recruiterTokenForUser = (await switchTo(signTokenFor(user), 'recruiter')).token;
    await Job.create({ ...baseJob({ title: 'Mine' }), postedBy: user.id });

    assert.equal(await Profile.countDocuments({ userId: user.id }), 2);

    const res = await request('DELETE', '/api/profile', { token: recruiterTokenForUser });
    assert.equal(res.status, 204, res.raw);

    assert.equal(await Profile.countDocuments({ userId: user.id }), 0);
    assert.equal(await Application.countDocuments({ userId: user.id }), 0);
    assert.equal(await SavedJob.countDocuments({ userId: user.id }), 0);
    assert.equal(await Job.countDocuments({ postedBy: user.id }), 0);
    assert.equal(await User.countDocuments({ _id: user.id }), 0);
    // Another account's job is untouched.
    assert.ok(await Job.findById(job._id));
  });
});
