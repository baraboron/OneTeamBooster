import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHrClient } from './hr-client.js';

const employee = id => ({ USER_ID: String(id), USER_NM: `가상 ${id}`, DEPT_CD: 'test', DEPT_NM: '가상 부서', extra: 'discard' });
const response = body => ({ ok: true, json: async () => body });

test('HR client collects more than 1000 records and retains original approved field names', async () => {
  const calls = [];
  const client = createHrClient({ apiKey: 'test-only', fetchFn: async (url, options) => {
    calls.push(JSON.parse(options.body));
    assert.equal(options.redirect, 'error');
    assert.equal(url.searchParams.get('token'), 'test-only');
    const page = calls.length;
    return response({ data: Array.from({ length: page === 1 ? 1000 : 5 }, (_, i) => employee((page-1)*1000+i)), total: 1005, page, totalPages: 2, hasMore: page === 1 });
  }});
  const rows = await client.all();
  assert.equal(rows.length, 1005);
  assert.equal(calls[1].page, 2);
  assert.equal(rows[0].extra, undefined);
  assert.equal(rows[0].USER_EMAIL, '');
});

test('incomplete or changing HR results cannot replace a valid directory', async () => {
  for (const body of [
    { message: 'too many rows' },
    { data: [employee('a')], total: 2 },
    { data: [employee('a'), employee('a')], total: 2 },
    { data: [employee('a')], total: 1, hasMore: true }
  ]) await assert.rejects(createHrClient({ apiKey: 'test-only', fetchFn: async () => response(body) }).all());
});

test('HR network errors do not expose keys, URLs or upstream body text', async () => {
  const client = createHrClient({ apiKey: 'secret-test', fetchFn: async () => { throw new Error('http://host?token=secret-test'); } });
  await assert.rejects(client.all(), error => error.message === 'HR_UNREACHABLE' && !JSON.stringify(error).includes('secret-test'));
});
