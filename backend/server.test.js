import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, readPort } from './server.js';

async function start(t) {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

test('health, readiness and HEAD accurately describe HTTP scaffold availability', async t => {
  const { server, url } = await start(t);
  assert.equal((await fetch(`${url}/healthz`)).status, 200);
  assert.equal((await fetch(`${url}/readyz`)).status, 200);
  const head = await fetch(`${url}/healthz`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  server.beginDrain();
  assert.equal((await fetch(`${url}/readyz`)).status, 503);
  assert.equal((await fetch(`${url}/healthz`)).status, 200);
});

test('system endpoint never claims authenticated, persistent or production service', async t => {
  const { url } = await start(t);
  const response = await fetch(`${url}/api/system`);
  const body = await response.json();
  assert.equal(body.mode, 'scaffold');
  assert.equal(body.productionReady, false);
  assert.ok(Object.values(body.capabilities).every(value => value === false));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('business reads and writes fail closed, even with caller-supplied identity and points', async t => {
  const { url } = await start(t);
  for (const path of ['/api/leaderboard', '/api/boosters', '/api/replies', '/api/wallet', '/api/leader/records']) {
    for (const method of ['GET', 'POST']) {
      const response = await fetch(url + path, {
        method, headers: { 'X-User-Id': 'admin', 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body: JSON.stringify({ points: 999, role: 'leader' }) } : {})
      });
      assert.equal(response.status, 503);
      assert.equal((await response.json()).error.code, 'BACKEND_NOT_CONFIGURED');
    }
  }
});

test('unsupported health methods and unrelated paths do not report success', async t => {
  const { url } = await start(t);
  const response = await fetch(`${url}/api/system`, { method: 'POST' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, HEAD');
  assert.equal((await fetch(`${url}/missing`)).status, 404);
});

test('invalid ports are rejected before starting the server', () => {
  assert.equal(readPort(), 3000);
  assert.equal(readPort('8080'), 8080);
  for (const value of ['0', '-1', '65536', '3.5', '3000oops', '']) assert.throws(() => readPort(value));
});
