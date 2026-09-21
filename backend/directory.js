import { AppError } from './domain.js';

export async function searchEmployees(pool, params, excludeId = '') {
  const q = (params.get('q') || '').trim();
  const department = (params.get('DEPT_CD') || '').trim();
  const pageValue = params.get('page') || '1';
  if (q.length < 2 || q.length > 50) throw new AppError(400, 'SEARCH_LENGTH', '검색어를 2~50자로 입력해 주세요.');
  if (!/^[1-9]\d{0,3}$/.test(pageValue) || department.length > 100) throw new AppError(400, 'INVALID_SEARCH');
  const page = Number(pageValue), pageSize = 20;
  const pattern = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
  // Count and page use one PostgreSQL snapshot, including an empty last page.
  const { rows: [result] } = await pool.query(`WITH matches AS (
    SELECT user_id, profile FROM employees WHERE active AND user_id <> $1
      AND ($3 = '' OR profile->>'DEPT_CD' = $3)
      AND (profile->>'USER_NM' ILIKE $2 OR profile->>'DEPT_NM' ILIKE $2
        OR profile->>'USER_EMAIL' ILIKE $2 OR profile->>'ROLE_NM' ILIKE $2 OR user_id ILIKE $2)
  ), selected AS (
    SELECT * FROM matches ORDER BY profile->>'USER_NM', user_id LIMIT $4 OFFSET $5
  ) SELECT (SELECT count(*)::int FROM matches) AS total,
    COALESCE((SELECT jsonb_agg(profile ORDER BY profile->>'USER_NM',user_id) FROM selected), '[]'::jsonb) AS data`,
  [excludeId, pattern, department, pageSize, (page - 1) * pageSize]);
  const total = result.total, totalPages = Math.ceil(total / pageSize);
  return { data: result.data, count: result.data.length, total, page, pageSize, totalPages, hasMore: page < totalPages };
}

export async function listDepartments(pool) {
  const { rows } = await pool.query(`SELECT profile->>'DEPT_CD' AS "DEPT_CD",
    min(profile->>'DEPT_NM') AS "DEPT_NM", count(*)::int AS count
    FROM employees WHERE active AND profile->>'DEPT_CD' <> ''
    GROUP BY profile->>'DEPT_CD' ORDER BY min(profile->>'DEPT_NM'), profile->>'DEPT_CD'`);
  return { data: rows, count: rows.length };
}
