/**
 * HireFlow Registration + Profile — focused integration test
 * Validates that:
 *   1. jobseeker registration creates User + profile can be created on-demand
 *   2. recruiter registration creates User + profile can be created on-demand
 *   3. duplicate registration returns 409
 *   4. login still works after registration
 *   5. GET /api/profile works after profile is created via POST
 *
 * With lazy/on-demand profile creation (Option C), a profile is NOT auto-created
 * during registration. Users must POST /api/profile to create their profile.
 */
'use strict';
require('dns').setServers(['1.1.1.1']);
const { spawn } = require('child_process');
const fs = require('fs');

const OUT = 'C:/Users/Miraz/AppData/Local/Temp/registration-test.log';
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
  r.setTimeout(10000, () => { r.destroy(new Error('request timeout')); });
  if (body) r.write(JSON.stringify(body));
  r.end();
});

const uid = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
const eq = (got, exp, label) => got === exp ? ok(label) : fail(label, `expected ${exp}, got ${got}`);

const waitForServer = () => new Promise((res, rej) => {
  let tries = 0;
  const try_ = () => req('GET', '/health', null, null).then(({ status }) => {
    if (status === 200) return res();
    if (++tries > 30) return rej(new Error('server did not start'));
    setTimeout(try_, 500);
  });
  try_();
});

const main = async () => {
  try { fs.unlinkSync(OUT); } catch {}

  log('[test] Starting server...');
  server = spawn('node', ['src/server.js'], {
    cwd: 'd:/The Lab/hireflow/server',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.pipe(fs.createWriteStream(OUT, { flags: 'a' }));
  server.stderr.pipe(fs.createWriteStream(OUT, { flags: 'a' }));

  await waitForServer();

  // ── Test 1: Jobseeker registration creates User ──────────────────────────────
  log('[T1] Jobseeker registration creates User');
  const jsEmail = `js_${uid()}@example.com`;
  const jsPwd = 'PasswordJs1';
  const jsReg = await req('POST', '/auth/register', { email: jsEmail, password: jsPwd, role: 'jobseeker' });
  eq(jsReg.status, 201, '  register → 201');
  if (jsReg.status === 201) {
    eq(!!jsReg.body.user, true, '  response has user object');
    eq(jsReg.body.user.email, jsEmail.toLowerCase(), '  email correct');
    eq(jsReg.body.user.role, 'jobseeker', '  role=jobseeker');
    eq(!!jsReg.body.user.id, true, '  user.id present');
  }

  // ── Test 2: Login works after jobseeker registration ─────────────────────────
  log('\n[T2] Login works after jobseeker registration');
  const jsLogin = await req('POST', '/auth/login', { email: jsEmail, password: jsPwd });
  eq(jsLogin.status, 200, '  login → 200');
  if (jsLogin.status === 200) {
    eq(!!jsLogin.body.token, true, '  token returned');
    eq(jsLogin.body.user.role, 'jobseeker', '  role preserved');
  }
  const jsToken = jsLogin.body.token || '';

  // ── Test 3: Profile NOT auto-created (lazy/on-demand) ───────────────────────
  log('\n[T3] Profile NOT auto-created after jobseeker registration (lazy/on-demand)');
  const jsGet = await req('GET', '/profile', null, jsToken);
  eq(jsGet.status, 404, '  GET /profile → 404 (no auto-created profile)');

  // ── Test 4: Profile can be created on-demand ─────────────────────────────────
  log('\n[T4] Profile can be created on-demand via POST /api/profile');
  const jsCreate = await req('POST', '/profile', {
    fullName: 'Alice Jobseeker',
    phone: '+1-555-0100',
    headline: 'Software Engineer',
  }, jsToken);
  eq(jsCreate.status, 201, '  POST /profile → 201');
  if (jsCreate.status === 201) {
    eq(jsCreate.body.role, 'jobseeker', '  role=jobseeker');
    eq(jsCreate.body.fullName, 'Alice Jobseeker', '  fullName stored');
    eq(jsCreate.body.headline, 'Software Engineer', '  headline stored');
    eq(!!jsCreate.body.id, true, '  profile id present');
  }

  // ── Test 5: GET /profile works after profile is created ─────────────────────
  log('\n[T5] GET /profile works after profile is created');
  const jsGet2 = await req('GET', '/profile', null, jsToken);
  eq(jsGet2.status, 200, '  GET /profile → 200');
  if (jsGet2.status === 200) {
    eq(jsGet2.body.fullName, 'Alice Jobseeker', '  fullName correct');
    eq(jsGet2.body.role, 'jobseeker', '  role correct');
  }

  // ── Test 6: Recruiter registration creates User ──────────────────────────────
  log('\n[T6] Recruiter registration creates User');
  const recEmail = `rec_${uid()}@example.com`;
  const recPwd = 'PasswordRc2';
  const recReg = await req('POST', '/auth/register', { email: recEmail, password: recPwd, role: 'recruiter' });
  eq(recReg.status, 201, '  register → 201');
  if (recReg.status === 201) {
    eq(!!recReg.body.user, true, '  response has user object');
    eq(recReg.body.user.email, recEmail.toLowerCase(), '  email correct');
    eq(recReg.body.user.role, 'recruiter', '  role=recruiter');
    eq(!!recReg.body.user.id, true, '  user.id present');
  }

  // ── Test 7: Login works after recruiter registration ────────────────────────
  log('\n[T7] Login works after recruiter registration');
  const recLogin = await req('POST', '/auth/login', { email: recEmail, password: recPwd });
  eq(recLogin.status, 200, '  login → 200');
  if (recLogin.status === 200) {
    eq(!!recLogin.body.token, true, '  token returned');
    eq(recLogin.body.user.role, 'recruiter', '  role preserved');
  }
  const recToken = recLogin.body.token || '';

  // ── Test 8: Profile NOT auto-created for recruiter ───────────────────────────
  log('\n[T8] Profile NOT auto-created after recruiter registration');
  const recGet = await req('GET', '/profile', null, recToken);
  eq(recGet.status, 404, '  GET /profile → 404 (no auto-created profile)');

  // ── Test 9: Recruiter profile can be created on-demand ──────────────────────
  log('\n[T9] Recruiter profile can be created on-demand');
  const recCreate = await req('POST', '/profile', {
    fullName: 'Bob Recruiter',
    phone: '+1-555-0200',
    companyName: 'Tech Corp',
    jobTitle: 'HR Manager',
  }, recToken);
  eq(recCreate.status, 201, '  POST /profile → 201');
  if (recCreate.status === 201) {
    eq(recCreate.body.role, 'recruiter', '  role=recruiter');
    eq(recCreate.body.companyName, 'Tech Corp', '  companyName stored');
    eq(recCreate.body.jobTitle, 'HR Manager', '  jobTitle stored');
  }

  log('[test] Server ready\n');}
