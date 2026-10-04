const { before, after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const dns = require('node:dns');

dns.setServers(['1.1.1.1', '1.0.0.1']);

const app = require('../src/app');

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

describe('HTTP security headers', () => {
  it('does not expose X-Powered-By', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.headers.get('x-powered-by'), null);
  });

  it('sets nosniff, frame denial, and a strict referrer policy', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
  });
});
