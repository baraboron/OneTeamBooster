import assert from 'node:assert/strict';
const origin = 'http://192.168.20.72:30081';
async function response(path, headers = {}) {
  return fetch(origin + path, {headers, signal: AbortSignal.timeout(15000)});
}
async function json(path, headers) {
  const r = await response(path, headers); assert.equal(r.status, 200, path); return r.json();
}
assert.equal((await response('/')).status, 200);
const system = await json('/api/system');
assert.equal(system.testUserMode, true); assert.equal(system.productionReady, false);
assert.equal((await response('/api/employees?q=test')).status, 401);
const users = await json('/api/test-users');
assert.equal(users.data.length, 2);
for (const user of users.data) {
  const headers = {'X-OTB-Test-User': user.USER_ID};
  await json('/api/workspace', headers);
  const employees = await json('/api/employees?q=' + encodeURIComponent(user.USER_NM), headers);
  assert.ok(Array.isArray(employees.data));
  assert.ok(employees.data.every(row => row.USER_ID !== user.USER_ID));
}
console.log('PASS: HTTP app, test-user mode, both workspaces, HR search and unauthenticated access restriction.');
