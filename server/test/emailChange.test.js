const { before, after, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const dns = require('node:dns');

// Node's DNS settings are overridden in config/db.js for Atlas SRV discovery;
// mirror that here so this harness works before config/db is required.
dns.setServers(['1.1.1.1', '1.0.0.1']);

const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const env = require('../src/config/env');
const app = require('../src/app');
const User = require('../src/models/User');
const EmailChange = require('../src/models/EmailChange');
const emailService = require('../src/services/email.service');

const TEST_DB_NAME = 'hireflow_test';

let server;
let baseUrl;
let sentEmails = [];

const resetEmails = () => {
  sentEmails = [];
};

// Stub the email service so no real emails are sent during tests.
emailService.sendEmailChangeVerification = async (payload) => {
  sentEmails.push({ type: 'verification', ...payload });
};
emailService.sendEmailChangedNotification = async (payload) => {
  sentEmails.push({ type: 'changed', ...payload });
};

const makeUser = async (email, role = 'jobseeker') => {
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

const lastVerificationEmail = () => {
  const emails = sentEmails.filter((email) => email.type === 'verification');
  return emails[emails.length - 1];
};

const lastToken = () => {
  const email = lastVerificationEmail();
  return email ? email.token : null;
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
  resetEmails();
  await EmailChange.deleteMany({});
});

describe('POST /api/email-change (request email change)', () => {
  it('succeeds for an authenticated user', async () => {
    const user = await makeUser('request-succeeds@example.com');
    const res = await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'request-succeeds-new@example.com' },
    });

    assert.equal(res.status, 201);
    assert.match(res.body.message, /Verification email sent/);
    assert.equal(res.body.newEmail, 'request-succeeds-new@example.com');
    assert.ok(res.body.expiresAt);
    assert.equal(res.body.token, undefined);
  });

  it('sets the verification expiry to exactly 1 hour', async () => {
    const user = await makeUser('one-hour-expiry@example.com');
    const res = await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'one-hour-expiry-new@example.com' },
    });

    assert.equal(res.status, 201);
    const diff = Date.parse(res.body.expiresAt) - Date.now();
    assert.ok(
      Math.abs(diff - 60 * 60 * 1000) < 10 * 1000,
      `expiry should be ~1 hour from creation, got diff ${diff}ms`
    );
  });

  it('requires authentication', async () => {
    const res = await request('POST', '/api/email-change', {
      body: { newEmail: 'anon@example.com' },
    });
    assert.equal(res.status, 401);
  });

  it('rejects an invalid email address', async () => {
    const user = await makeUser('invalid-email-request@example.com');
    const res = await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'not-an-email' },
    });
    assert.equal(res.status, 400);
  });

  it('keeps the current email unchanged after a request', async () => {
    const user = await makeUser('keeps-unchanged@example.com');
    await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'keeps-unchanged-new@example.com' },
    });

    const reloaded = await User.findById(user._id);
    assert.equal(reloaded.email, 'keeps-unchanged@example.com');
  });

  it('enforces uniqueness against other users', async () => {
    const user = await makeUser('dup-request@example.com');
    await makeUser('taken-target@example.com');

    const res = await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'taken-target@example.com' },
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'Email already in use');
  });

  it('rejects requesting the current email as the new email', async () => {
    const user = await makeUser('same-current@example.com');
    const res = await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'same-current@example.com' },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /different from your current email/);
  });
});

describe('POST /api/email-change/verify-email (verify)', () => {
  it('changes the email only after a valid token is verified', async () => {
    const user = await makeUser('verify-happy@example.com');
    await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'verify-happy-new@example.com' },
    });
    const rawToken = lastToken();

    let reloaded = await User.findById(user._id);
    assert.equal(reloaded.email, 'verify-happy@example.com');

    const res = await request('POST', '/api/email-change/verify-email', {
      token: signTokenFor(user),
      body: { token: rawToken },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.email, 'verify-happy-new@example.com');

    reloaded = await User.findById(user._id);
    assert.equal(reloaded.email, 'verify-happy-new@example.com');

    // A second use of the token must fail (single-use).
    const again = await request('POST', '/api/email-change/verify-email', {
      token: signTokenFor(user),
      body: { token: rawToken },
    });
    assert.equal(again.status, 400);
  });

  it('rejects an invalid token', async () => {
    const user = await makeUser('invalid-token@example.com');
    await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'invalid-token-new@example.com' },
    });

    const res = await request('POST', '/api/email-change/verify-email', {
      token: signTokenFor(user),
      body: { token: 'definitely-not-the-token' },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Invalid or expired/);
  });

  it('rejects an expired token', async () => {
    const user = await makeUser('expired-token@example.com');
    await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'expired-token-new@example.com' },
    });
    const rawToken = lastToken();

    await EmailChange.updateMany(
      { userId: user._id },
      { $set: { expiresAt: new Date(Date.now() - 60_000) } }
    );

    const res = await request('POST', '/api/email-change/verify-email', {
      token: signTokenFor(user),
      body: { token: rawToken },
    });
    assert.equal(res.status, 400);

    const reloaded = await User.findById(user._id);
    assert.equal(reloaded.email, 'expired-token@example.com');
  });

  it('requires the token body field', async () => {
    const user = await makeUser('missing-token@example.com');
    const res = await request('POST', '/api/email-change/verify-email', {
      token: signTokenFor(user),
      body: {},
    });
    assert.equal(res.status, 400);
  });
});

describe('POST /api/email-change/resend (resend verification)', () => {
  it('invalidates the previous token and the new token works', async () => {
    const user = await makeUser('resend-fresh@example.com');
    await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'resend-fresh-new@example.com' },
    });
    const oldToken = lastToken();

    const resendRes = await request('POST', '/api/email-change/resend', {
      token: signTokenFor(user),
    });
    assert.equal(resendRes.status, 200);
    assert.ok(resendRes.body.expiresAt);

    const newToken = lastToken();
    assert.ok(newToken);
    assert.notEqual(newToken, oldToken);

    const oldRes = await request('POST', '/api/email-change/verify-email', {
      token: signTokenFor(user),
      body: { token: oldToken },
    });
    assert.equal(oldRes.status, 400);

    const newRes = await request('POST', '/api/email-change/verify-email', {
      token: signTokenFor(user),
      body: { token: newToken },
    });
    assert.equal(newRes.status, 200);
    assert.equal(newRes.body.email, 'resend-fresh-new@example.com');
  });

  it('resets the expiry to 1 hour on resend', async () => {
    const user = await makeUser('resend-reset@example.com');
    const initialRes = await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'resend-reset-new@example.com' },
    });
    assert.equal(initialRes.status, 201);
    const initialExpiry = Date.parse(initialRes.body.expiresAt);

    const resendRes = await request('POST', '/api/email-change/resend', {
      token: signTokenFor(user),
    });
    assert.equal(resendRes.status, 200);
    assert.ok(resendRes.body.expiresAt);

    const resentExpiry = Date.parse(resendRes.body.expiresAt);
    const diff = resentExpiry - Date.now();
    assert.ok(
      Math.abs(diff - 60 * 60 * 1000) < 10 * 1000,
      `resend expiry should be ~1 hour from resend time, got diff ${diff}ms`
    );
    assert.ok(resentExpiry > initialExpiry, 'resend must push the expiry later');
  });

  it('resends to the pending new email address', async () => {
    const user = await makeUser('resend-target@example.com');
    await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'resend-target-new@example.com' },
    });
    resetEmails();

    await request('POST', '/api/email-change/resend', {
      token: signTokenFor(user),
    });

    const email = lastVerificationEmail();
    assert.ok(email);
    assert.equal(email.to, 'resend-target-new@example.com');
  });

  it('returns 404 when there is no pending change', async () => {
    const user = await makeUser('no-pending-resend@example.com');
    const res = await request('POST', '/api/email-change/resend', {
      token: signTokenFor(user),
    });
    assert.equal(res.status, 404);
  });
});

describe('second email change while a request is pending', () => {
  it('replaces the pending request and invalidates the previous token', async () => {
    const user = await makeUser('replace-a@example.com');

    await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'replace-b-first@example.com' },
    });
    const firstToken = lastToken();

    const replaceRes = await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'replace-c-second@example.com' },
    });
    assert.equal(replaceRes.status, 201);
    assert.equal(replaceRes.body.newEmail, 'replace-c-second@example.com');

    // Only one active pending request exists per user.
    assert.equal(await EmailChange.countDocuments({ userId: user._id }), 1);

    // The previous request's token must no longer work.
    const oldVerify = await request('POST', '/api/email-change/verify-email', {
      token: signTokenFor(user),
      body: { token: firstToken },
    });
    assert.equal(oldVerify.status, 400);

    // Pending status reflects the replacement request.
    const statusRes = await request('GET', '/api/email-change', {
      token: signTokenFor(user),
    });
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.body.pending, true);
    assert.equal(statusRes.body.newEmail, 'replace-c-second@example.com');

    // The replacement token is usable and the email actually changes.
    const newToken = lastToken();
    const newVerify = await request('POST', '/api/email-change/verify-email', {
      token: signTokenFor(user),
      body: { token: newToken },
    });
    assert.equal(newVerify.status, 200);
    assert.equal(newVerify.body.email, 'replace-c-second@example.com');
  });

  it('resend operates on the current pending email after a replacement', async () => {
    const user = await makeUser('replace-resend@example.com');

    await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'replace-resend-a@example.com' },
    });
    await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'replace-resend-b@example.com' },
    });
    resetEmails();

    await request('POST', '/api/email-change/resend', {
      token: signTokenFor(user),
    });

    const email = lastVerificationEmail();
    assert.ok(email);
    assert.equal(email.to, 'replace-resend-b@example.com');
  });
});

describe('DELETE /api/email-change (cancel)', () => {
  it('invalidates the pending change and keeps the current email', async () => {
    const user = await makeUser('cancel-pending@example.com');
    await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'cancel-pending-new@example.com' },
    });
    const rawToken = lastToken();

    const cancelRes = await request('DELETE', '/api/email-change', {
      token: signTokenFor(user),
    });
    assert.equal(cancelRes.status, 200);

    const verifyRes = await request('POST', '/api/email-change/verify-email', {
      token: signTokenFor(user),
      body: { token: rawToken },
    });
    assert.equal(verifyRes.status, 400);

    const reloaded = await User.findById(user._id);
    assert.equal(reloaded.email, 'cancel-pending@example.com');
  });

  it('returns 404 when there is no pending change to cancel', async () => {
    const user = await makeUser('no-pending-cancel@example.com');
    const res = await request('DELETE', '/api/email-change', {
      token: signTokenFor(user),
    });
    assert.equal(res.status, 404);
  });
});

describe('GET /api/email-change (pending status)', () => {
  it('returns pending: false when there is no pending change', async () => {
    const user = await makeUser('no-pending-status@example.com');
    const res = await request('GET', '/api/email-change', {
      token: signTokenFor(user),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.pending, false);
  });

  it('returns the pending email and expiry when a change is active', async () => {
    const user = await makeUser('pending-status@example.com');
    await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'pending-status-new@example.com' },
    });

    const res = await request('GET', '/api/email-change', {
      token: signTokenFor(user),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.pending, true);
    assert.equal(res.body.newEmail, 'pending-status-new@example.com');
    assert.ok(res.body.expiresAt);
    assert.equal(res.body.tokenHash, undefined);
  });

  it('returns pending: false for an expired request', async () => {
    const user = await makeUser('expired-pending-status@example.com');
    await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'expired-pending-status-new@example.com' },
    });

    await EmailChange.updateMany(
      { userId: user._id },
      { $set: { expiresAt: new Date(Date.now() - 60_000) } }
    );

    const res = await request('GET', '/api/email-change', {
      token: signTokenFor(user),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.pending, false);
  });

  it('returns pending: false after the token is consumed', async () => {
    const user = await makeUser('consumed-pending-status@example.com');
    await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'consumed-pending-status-new@example.com' },
    });
    const rawToken = lastToken();

    await request('POST', '/api/email-change/verify-email', {
      token: signTokenFor(user),
      body: { token: rawToken },
    });

    const res = await request('GET', '/api/email-change', {
      token: signTokenFor(user),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.pending, false);
  });

  it('requires authentication', async () => {
    const res = await request('GET', '/api/email-change');
    assert.equal(res.status, 401);
  });
});

describe('lifecycle and security', () => {
  it('a pending change survives re-authentication (fresh login)', async () => {
    const user = await makeUser('relogin@example.com');
    await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'relogin-new@example.com' },
    });
    const rawToken = lastToken();

    const freshToken = signTokenFor(await User.findById(user._id));
    const res = await request('POST', '/api/email-change/verify-email', {
      token: freshToken,
      body: { token: rawToken },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.email, 'relogin-new@example.com');
  });

  it('notifies the old email address after a successful change', async () => {
    const user = await makeUser('notify-old@example.com');
    await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'notify-old-new@example.com' },
    });
    const rawToken = lastToken();

    await request('POST', '/api/email-change/verify-email', {
      token: signTokenFor(user),
      body: { token: rawToken },
    });

    const changed = sentEmails.find((email) => email.type === 'changed');
    assert.ok(changed, 'old-email notification should have been sent');
    assert.equal(changed.to, 'notify-old@example.com');
    assert.equal(changed.newEmail, 'notify-old-new@example.com');
  });

  it('sends the verification email to the pending new email', async () => {
    const user = await makeUser('verify-to@example.com');
    await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'verify-to-new@example.com' },
    });

    const email = lastVerificationEmail();
    assert.ok(email);
    assert.equal(email.to, 'verify-to-new@example.com');
    assert.ok(email.token);
  });

  it('does not store raw tokens in the database', async () => {
    const user = await makeUser('raw-token@example.com');
    await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'raw-token-new@example.com' },
    });
    const rawToken = lastToken();

    const doc = await EmailChange.findOne({ userId: user._id });
    assert.ok(doc);
    assert.ok(doc.tokenHash);
    assert.notEqual(doc.tokenHash, rawToken);
    assert.equal(
      doc.tokenHash,
      crypto.createHash('sha256').update(rawToken).digest('hex')
    );

    const rawDoc = JSON.stringify(doc.toObject());
    assert.ok(!rawDoc.includes(rawToken), 'raw token found in stored document');
  });

  it('does not expose raw tokens in API responses or logs', async () => {
    const user = await makeUser('no-leak@example.com');
    const logs = [];
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    console.log = (...args) => logs.push(args.join(' '));
    console.warn = (...args) => logs.push(args.join(' '));
    console.error = (...args) => logs.push(args.join(' '));

    try {
      await request('POST', '/api/email-change', {
        token: signTokenFor(user),
        body: { newEmail: 'no-leak-new@example.com' },
      });
      const rawToken = lastToken();

      const resendRes = await request('POST', '/api/email-change/resend', {
        token: signTokenFor(user),
      });
      const verifyRes = await request('POST', '/api/email-change/verify-email', {
        token: signTokenFor(user),
        body: { token: rawToken },
      });

      for (const response of [resendRes, verifyRes]) {
        assert.ok(
          !JSON.stringify(response.body).includes(rawToken),
          'raw token leaked into an API response'
        );
      }

      assert.ok(
        !logs.join('\n').includes(rawToken),
        'raw token was written to the logs'
      );
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }
  });

  it('prevents a user from manipulating another user\'s pending change', async () => {
    const userA = await makeUser('victim-a@example.com');
    const userB = await makeUser('attacker-b@example.com');

    await request('POST', '/api/email-change', {
      token: signTokenFor(userA),
      body: { newEmail: 'victim-a-new@example.com' },
    });
    const aToken = lastToken();

    // B cannot verify A's token.
    const brute = await request('POST', '/api/email-change/verify-email', {
      token: signTokenFor(userB),
      body: { token: aToken },
    });
    assert.equal(brute.status, 400);

    // B has nothing pending to cancel or resend.
    const cancelB = await request('DELETE', '/api/email-change', {
      token: signTokenFor(userB),
    });
    assert.equal(cancelB.status, 404);
    const resendB = await request('POST', '/api/email-change/resend', {
      token: signTokenFor(userB),
    });
    assert.equal(resendB.status, 404);

    // A's pending change is still intact and usable.
    const okA = await request('POST', '/api/email-change/verify-email', {
      token: signTokenFor(userA),
      body: { token: aToken },
    });
    assert.equal(okA.status, 200);
  });

  it('does not create a second user account for the pending email', async () => {
    const user = await makeUser('no-dupe@example.com');
    await request('POST', '/api/email-change', {
      token: signTokenFor(user),
      body: { newEmail: 'no-dupe-new@example.com' },
    });
    const rawToken = lastToken();

    const before = await User.countDocuments();
    await request('POST', '/api/email-change/verify-email', {
      token: signTokenFor(user),
      body: { token: rawToken },
    });
    const after = await User.countDocuments();

    assert.equal(after, before);
    const owner = await User.findOne({ email: 'no-dupe-new@example.com' });
    assert.equal(String(owner._id), String(user._id));
  });
});