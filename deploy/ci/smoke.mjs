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
assert.equal(system.capabilities.aiGeneration, true);
assert.equal((await response('/api/employees?q=test')).status, 401);
const users = await json('/api/test-users');
assert.equal(users.data.length, 2);
const headers = {'X-OTB-Test-User': users.data[0].USER_ID};
const departments = await json('/api/departments', headers);
const department = departments.data.find(row => row.count > 20) || departments.data[0];
assert.ok(department, 'A department must exist for the directory check');
const departmentPath = '/api/employees?DEPT_CD=' + encodeURIComponent(department.DEPT_CD);
const members = await json(departmentPath, headers);
assert.ok(members.data.every(row => row.DEPT_CD === department.DEPT_CD && row.USER_ID !== users.data[0].USER_ID));
assert.equal(members.total, department.count - Number(users.data[0].DEPT_CD === department.DEPT_CD));
if (members.hasMore) {
  const next = await json(departmentPath + '&page=2', headers);
  const firstIds = new Set(members.data.map(row => row.USER_ID));
  assert.equal(next.page, 2); assert.equal(next.total, members.total);
  assert.ok(next.data.length > 0 && next.data.every(row => row.DEPT_CD === department.DEPT_CD && row.USER_ID !== users.data[0].USER_ID && !firstIds.has(row.USER_ID)));
}
for (const user of users.data) {
  const headers = {'X-OTB-Test-User': user.USER_ID};
  await json('/api/workspace', headers);
  const employees = await json('/api/employees?q=' + encodeURIComponent(user.USER_NM), headers);
  assert.ok(Array.isArray(employees.data));
  assert.ok(employees.data.every(row => row.USER_ID !== user.USER_ID));
}
console.log('PASS: HTTP app, AI configuration, test-user mode, both workspaces, HR search and unauthenticated access restriction.');
