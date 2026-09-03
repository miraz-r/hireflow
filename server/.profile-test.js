/**
 * HireFlow Profile Management — integration test
 * Starts the server as a child process and runs HTTP tests against it.
 * Results are appended to a temp log so they survive terminal issues.
 */
'use strict';
require('dns').setServers(['1.1.1.1']);
const { spawn } = require('child_process');
const fs = require('fs');

const OUT = 'C:/Users/Miraz/AppData/Local/Temp/profile-test.log';
const log = (...args) => {
  const msg = args.map((v) => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(' ');
  fs.appendFileSync(OUT, msg + '\n');
  console.log(msg);
};

let server;
let passed = 0;
let failed = 0;
const ok   = (l) => { passed++; log(`  PASS  ${l}`); };
const fail = (l, d) => { failed++; log(`  FAIL  ${l}: ${d}`); };

const req = (method, path, body, token) => new Promise((res) => {
  const http = require('http');
  const opts = {
    hostname: 'localhost', port: 5000, path: `/api${path}`, method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  const r = http.request(opts, (resp) => {
    let d = '';
    resp.on('data', (c) => (d += c));
    resp.on('end', () => {
      let j = {};
      try { j = JSON.parse(d); } catch { j = d; }
      res({ status: resp.statusCode, body: j });
    });
  });
  r.on('error', (e) => res({ status: 0, body: { error: e.message } }));
  // 10 s timeout: if the server hangs, surface it as a failure rather than
  // letting the whole test process block.
  r.setTimeout(10000, () => {
    r.destroy(new Error('request timeout (10000ms)'));
  });
  if (body) r.write(JSON.stringify(body));
  r.end();
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const uid = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

const waitForServer = () => new Promise((res, rej) => {
  let tries = 0;
  const try_ = () => req('GET', '/health', null, null).then(({ status }) => {
    if (status === 200) return res();
    if (++tries > 30) return rej(new Error('server did not start'));
    setTimeout(try_, 500);
  });
  try_();
});

// ── Test helpers ────────────────────────────────────────────────────────────
const eq = (got, exp, label) => got === exp ? ok(label) : fail(label, `expected ${exp}, got ${got}`);
const eqObj = (got, exp, label) => JSON.stringify(got) === JSON.stringify(exp) ? ok(label) : fail(label, `expected ${JSON.stringify(exp)}, got ${JSON.stringify(got)}`);

// ── Start server ───────────────────────────────────────────────────────────
const main = async () => {
  try { fs.unlinkSync(OUT); } catch {}

  log('[test] Starting server…');
  server = spawn('node', ['src/server.js'], {
    cwd: 'd:/The Lab/hireflow/server',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.pipe(fs.createWriteStream(OUT, { flags: 'a' }));
  server.stderr.pipe(fs.createWriteStream(OUT, { flags: 'a' }));

  await waitForServer();
  log('[test] Server ready\n');

  const jsEmail  = `js_${uid()}@example.com`;
  const recEmail = `rec_${uid()}@example.com`;
  const jsPwd    = 'PasswordJs1';
  const recPwd   = 'PasswordRc2';
  const jsFullName = 'Alice Jobseeker';
  const recFullName = 'Bob Recruiter';
  const jsPhone = '+1-555-0100';
  const recPhone = '+1-555-0200';

  const reg = (email, password, role, fullName, phone) =>
    req('POST', '/auth/register', { email, password, role, fullName, phone })
      .then((r) => r.status === 201 ? req('POST', '/auth/login', { email, password }) : r)
      .then((r) => r.body.token || '');

  const jsToken  = await reg(jsEmail, jsPwd, 'jobseeker', jsFullName, jsPhone);
  if (jsToken) ok('Register + login jobseeker'); else fail('Register + login jobseeker', 'no token');
  const recToken = await reg(recEmail, recPwd, 'recruiter', recFullName, recPhone);
  if (recToken) ok('Register + login recruiter'); else fail('Register + login recruiter', 'no token');

  if (!jsToken || !recToken) {
    log('FATAL: cannot obtain tokens'); server.kill(); process.exit(1);
  }

  // T1
  log('\n[T1] Unauthenticated requests');
  eq((await req('GET',   '/profile', null, null)).status, 401, 'GET    /profile no token → 401');
  eq((await req('POST',  '/profile', {},   null)).status, 401, 'POST   /profile no token → 401');
  eq((await req('PUT',   '/profile', {},   null)).status, 401, 'PUT    /profile no token → 401');
  eq((await req('PATCH', '/profile', {},   null)).status, 401, 'PATCH  /profile no token → 401');

  // T2
  log('\n[T2] Jobseeker profile auto-created at registration');
  const jsGetAuto = await req('GET', '/profile', null, jsToken);
  eq(jsGetAuto.status, 200, 'GET /profile → 200 (profile auto-created)');
  if (jsGetAuto.status === 200) {
    const p = jsGetAuto.body;
    eq(p.role, 'jobseeker', '  role=jobseeker');
    eq(p.fullName, jsFullName, '  fullName from registration');
    eq(p.phone, jsPhone, '  phone from registration');
  }
  // Enrich via PUT (profile already exists, POST would 409)
  const jsProfile = {
    location: 'San Francisco, CA',
    headline: 'Full-stack Engineer',
    bio: 'Building things with Node.js and React.',
    education: [{ school: 'MIT', degree: 'BSc', field: 'CS', startDate: '2018-09-01', endDate: '2022-06-01', current: false }],
    experience: [{ company: 'TechCorp', title: 'Software Engineer', startDate: '2022-07-01', current: true, description: 'Full-stack dev.' }],
    links: [{ label: 'GitHub', url: 'https://github.com/alice' }],
  };
  const jsCreate = await req('PUT', '/profile', { fullName: jsFullName, phone: jsPhone, ...jsProfile }, jsToken);
  eq(jsCreate.status, 200, 'PUT /profile to enrich → 200');
  if (jsCreate.status === 200) {
    const p = jsCreate.body;
    eq(p.role, 'jobseeker', '  role=jobseeker');
    eq(p.headline, 'Full-stack Engineer', '  headline stored');
    eq(p.education && p.education.length, 1, '  education stored');
  }
  // Skills normalization is an internal schema hook fired on Profile.create()/save().
  // The public API path that exercises it is now registration (which calls Profile.create()).
  // We verify registration-time creation works in T2 above; the hook itself is not retested here.

  // T3
  log('\n[T3] Recruiter profile auto-created at registration');
  const recGetAuto = await req('GET', '/profile', null, recToken);
  eq(recGetAuto.status, 200, 'GET /profile → 200 (profile auto-created)');
  if (recGetAuto.status === 200) {
    const p = recGetAuto.body;
    eq(p.role, 'recruiter', '  role=recruiter');
    eq(p.fullName, recFullName, '  fullName from registration');
    eq(p.phone, recPhone, '  phone from registration');
  }
  const recProfile = {
    location: 'New York, NY',
    jobTitle: 'Senior Recruiter',
    companyName: 'Acme Corp',
    companyWebsite: 'https://acme.com',
    companyDescription: 'We build great things.',
  };
  const recCreate = await req('PUT', '/profile', { fullName: recFullName, phone: recPhone, ...recProfile }, recToken);
  eq(recCreate.status, 200, 'PUT /profile to enrich → 200');
  if (recCreate.status === 200) {
    const p = recCreate.body;
    eq(p.role, 'recruiter', '  role=recruiter');
    eq(p.companyName, 'Acme Corp', '  companyName stored');
    eq(p.headline, '', '  jobseeker headline absent (default empty string)');
    eq(p.bio, '', '  jobseeker bio absent (default empty string)');
  }

  // T4
  log('\n[T4] Duplicate profile → 409');
  eq((await req('POST', '/profile', { fullName: 'Alice Again', phone: '+1-555-9999' }, jsToken)).status, 409, 'POST /profile on existing profile → 409');

  // T5
  log('\n[T5] GET own profile');
  const jsGet = await req('GET', '/profile', null, jsToken);
  eq(jsGet.status, 200, 'GET /profile → 200');
  if (jsGet.status === 200) {
    eq(jsGet.body.fullName, 'Alice Jobseeker', '  correct fullName');
    eq(jsGet.body.headline, 'Full-stack Engineer', '  jobseeker data present');
    eq(jsGet.body.__v, undefined, '  __v not exposed');
  }

  // T6
  log('\n[T6] Update own profile (PUT)');
  const jsPut = await req('PUT', '/profile', {
    fullName: 'Alice Updated',
    phone: '+1-555-0101',
    location: 'Remote',
    headline: 'Backend Engineer',
    bio: 'Node.js specialist.',
    skills: ['Go', 'Kubernetes'],
    education: [],
    experience: [],
    links: [],
  }, jsToken);
  eq(jsPut.status, 200, 'PUT /profile → 200');
  if (jsPut.status === 200) {
    eq(jsPut.body.fullName, 'Alice Updated', '  fullName updated');
    eq(jsPut.body.headline, 'Backend Engineer', '  headline updated');
    eq(JSON.stringify(jsPut.body.skills), JSON.stringify(['Go', 'Kubernetes']), '  old skills replaced');
  }

  // T7
  log('\n[T7] Patch own profile (PATCH)');
  const jsPatch = await req('PATCH', '/profile', { headline: 'DevOps Engineer' }, jsToken);
  eq(jsPatch.status, 200, 'PATCH /profile → 200');
  if (jsPatch.status === 200) {
    eq(jsPatch.body.headline, 'DevOps Engineer', '  headline patched');
    eq(jsPatch.body.fullName, 'Alice Updated', '  other fields preserved');
  }

  // T8
  log('\n[T8] Profile auto-created at registration — no 404');
  const freshEmail = `fresh_${uid()}@example.com`;
  const freshPwd  = 'PasswordFr3';
  const freshReg  = await req('POST', '/auth/register', { email: freshEmail, password: freshPwd, role: 'jobseeker', fullName: 'Fresh User', phone: '+1-555-0300' });
  let freshToken = '';
  if (freshReg.status === 201) {
    const lr = await req('POST', '/auth/login', { email: freshEmail, password: freshPwd });
    freshToken = lr.body.token || '';
  }
  const freshGet = await req('GET', '/profile', null, freshToken);
  eq(freshGet.status, 200, 'GET /profile → 200 (profile auto-created)');
  if (freshGet.status === 200) {
    eq(freshGet.body.fullName, 'Fresh User', '  fullName from registration');
    eq(freshGet.body.role, 'jobseeker', '  role correct');
  }

  // T9
  log('\n[T9] Role fields cannot cross roles');
  const cross1 = await req('PUT', '/profile', { fullName: 'Bob', phone: '+1-555-0300', headline: 'Looking for work', bio: 'My bio' }, recToken);
  (cross1.status === 400 || cross1.status === 422 ? ok : fail)('PUT recruiter with jobseeker fields → 4xx', `got ${cross1.status}`);
  const cross2 = await req('PUT', '/profile', { fullName: 'Alice', phone: '+1-555-0400', companyName: 'Startup', companyWebsite: 'https://mine.com' }, jsToken);
  (cross2.status === 400 || cross2.status === 422 ? ok : fail)('PUT jobseeker with recruiter fields → 4xx', `got ${cross2.status}`);
  const cross3 = await req('PATCH', '/profile', { headline: 'Open to offers', skills: ['Python'] }, recToken);
  (cross3.status === 400 || cross3.status === 422 ? ok : fail)('PATCH recruiter with jobseeker fields → 4xx', `got ${cross3.status}`);
  const cross4 = await req('PATCH', '/profile', { companyName: 'My Startup' }, jsToken);
  (cross4.status === 400 || cross4.status === 422 ? ok : fail)('PATCH jobseeker with recruiter fields → 4xx', `got ${cross4.status}`);

  // T10
  log('\n[T10] Unknown fields are ignored');
  const unk = await req('PATCH', '/profile', { fullName: 'Alice Patch', phone: '+1-555-0500', _hackField: 'ignored', __v: 99, _id: '000000000000000000000000' }, jsToken);
  eq(unk.status, 200, 'PATCH /profile with unknown fields → 200');
  if (unk.status === 200) {
    eq(unk.body.fullName, 'Alice Patch', '  known fields applied');
    eq(unk.body.__v, undefined, '  __v not exposed');
  }

  // T11
  log('\n[T11] PUT without required fields → 400');
  const noReq = await req('PUT', '/profile', { location: 'Only location' }, jsToken);
  (noReq.status === 400 ? ok : fail)('PUT /profile missing fullName/phone → 400', `got ${noReq.status}`);

  // Summary
  log(`\n${'='.repeat(50)}`);
  log(`Results: ${passed} passed, ${failed} failed`);
  server.kill();
  process.exit(failed > 0 ? 1 : 0);
};

main().catch((e) => {
  log('FATAL:', e.message);
  if (server) server.kill();
  process.exit(1);
});

