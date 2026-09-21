import { AppError } from './domain.js';

// Explicitly requested test personas. This is not authentication or leader authorization.
export const TEST_USER_NAMES = Object.freeze(['송재현', '김영훈']);
export async function testUsers(pool) {
  const {rows} = await pool.query(`SELECT profile FROM employees WHERE active
    AND profile->>'USER_NM'=ANY($1::text[]) ORDER BY profile->>'USER_NM',user_id`, [TEST_USER_NAMES]);
  if (TEST_USER_NAMES.some(name=>rows.filter(row=>row.profile.USER_NM===name).length!==1)) {
    throw new AppError(503,'TEST_USERS_AMBIGUOUS','테스트 사용자 인사정보를 확인해야 합니다.');
  }
  return rows.map(({profile})=>Object.fromEntries(['USER_ID','USER_NM','DEPT_CD','DEPT_NM','ROLE_NM'].map(key=>[key,profile[key]])));
}

export async function testIdentity(pool,req,origin) {
  if (req.headers['sec-fetch-site']==='cross-site') throw new AppError(403,'ORIGIN_REJECTED');
  if (!['GET','HEAD'].includes(req.method) && req.headers.origin!==origin) throw new AppError(403,'ORIGIN_REJECTED','같은 사이트에서 다시 시도해 주세요.');
  const id=req.headers['x-otb-test-user'];
  if (!id) throw new AppError(401,'TEST_USER_REQUIRED','테스트 사용자를 선택해 주세요.');
  const users=await testUsers(pool);
  if (!users.some(row=>row.USER_ID===id)) throw new AppError(403,'TEST_USER_NOT_ALLOWED');
  return {userId:id};
}
