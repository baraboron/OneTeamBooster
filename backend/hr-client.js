export const HR_FIELDS = Object.freeze(['USER_ID','USER_NM','USER_EMAIL','ROLE_CD','ROLE_NM','DEPT_CD','DEPT_NM','INSERT_DT']);

export class HrError extends Error {
  constructor(code, status = 502) { super(code); this.code = code; this.status = status; }
}

export function normalizeEmployee(row) {
  if (!row || typeof row !== 'object') throw new HrError('HR_INVALID_EMPLOYEE');
  const result = Object.fromEntries(HR_FIELDS.map(field => [field, String(row[field] ?? '').trim()]));
  if (!result.USER_ID || !result.USER_NM || result.USER_ID.length > 100) throw new HrError('HR_INVALID_EMPLOYEE');
  return result;
}

export function createHrClient({ apiKey, baseUrl = 'http://ax.ips.co.kr/api/gateway/common/hr-user', fetchFn = fetch, timeoutMs = 15000 } = {}) {
  if (!apiKey) throw new HrError('HR_KEY_NOT_CONFIGURED', 503);
  const endpoint = new URL(baseUrl);
  if (!['http:','https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new HrError('HR_INVALID_URL', 503);

  async function page({ page = 1, pageSize = 1000, where = {} } = {}) {
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new HrError('HR_INVALID_PAGE');
    const url = new URL(endpoint);
    url.searchParams.set('token', apiKey);
    let response;
    try {
      response = await fetchFn(url, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ columns: HR_FIELDS, where, page, pageSize, orderBy: [{ column: 'USER_ID', dir: 'ASC' }] })
      });
    } catch { throw new HrError('HR_UNREACHABLE'); }
    if (!response.ok) throw new HrError(response.status === 401 || response.status === 403 ? 'HR_ACCESS_DENIED' : 'HR_UPSTREAM_ERROR');
    let body;
    try { body = await response.json(); } catch { throw new HrError('HR_INVALID_RESPONSE'); }
    if (!Array.isArray(body.data) || !Number.isSafeInteger(Number(body.total)) || Number(body.total) < 0) throw new HrError('HR_INVALID_RESPONSE');
    const total = Number(body.total);
    if (total > 100000 || body.data.length > pageSize) throw new HrError('HR_INVALID_RESPONSE');
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (body.totalPages !== undefined && Number(body.totalPages) !== totalPages && !(total === 0 && Number(body.totalPages) === 0)) throw new HrError('HR_INCONSISTENT_PAGES');
    if (body.page !== undefined && Number(body.page) !== page) throw new HrError('HR_INCONSISTENT_PAGES');
    const hasMore = page < totalPages;
    if (body.hasMore !== undefined && body.hasMore !== hasMore) throw new HrError('HR_INCONSISTENT_PAGES');
    return { data: body.data.map(normalizeEmployee), total, page, pageSize, totalPages, hasMore };
  }

  async function all() {
    const rows = [], ids = new Set();
    let expectedTotal;
    for (let current = 1; current <= 100; current++) {
      const result = await page({ page: current });
      if (expectedTotal !== undefined && expectedTotal !== result.total) throw new HrError('HR_CHANGED_DURING_SYNC');
      expectedTotal = result.total;
      for (const employee of result.data) {
        if (ids.has(employee.USER_ID)) throw new HrError('HR_DUPLICATE_ID');
        ids.add(employee.USER_ID); rows.push(employee);
      }
      if (!result.hasMore) {
        if (rows.length !== expectedTotal) throw new HrError('HR_INCOMPLETE_SYNC');
        return rows;
      }
      if (!result.data.length) throw new HrError('HR_INCOMPLETE_SYNC');
    }
    throw new HrError('HR_TOO_MANY_PAGES');
  }
  return { page, all };
}
