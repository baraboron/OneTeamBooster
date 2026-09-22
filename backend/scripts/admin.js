// Operator-only tooling. No public identity, login or role-grant endpoint.
import { createPool, migrate, syncDirectory, transaction } from '../database.js';
import { createHrClient } from '../hr-client.js';
const pool=createPool();
try {
  await migrate(pool);
  const [command,userId,...departments]=process.argv.slice(2);
  if(command==='sync-hr') {
    const result=await syncDirectory(pool,createHrClient({apiKey:process.env.DATA_API_KEY,baseUrl:process.env.DATA_API_URL}));
    console.log(JSON.stringify({synced:true,count:result.count}));
  } else if(command==='leader-scopes' && userId) {
    await transaction(pool,async db=>{
      for(const department of departments)if(!(await db.query("SELECT 1 FROM employees WHERE active AND profile->>'DEPT_CD'=$1 LIMIT 1",[department])).rowCount)throw new Error('UNKNOWN_DEPARTMENT');
      await db.query('DELETE FROM leader_scopes WHERE leader_id=$1',[userId]);
      for(const department of new Set(departments))await db.query('INSERT INTO leader_scopes VALUES($1,$2)',[userId,department]);
    });
    console.log('Explicit leader department scopes updated.');
  } else if(['grant-admin','revoke-admin'].includes(command) && userId && departments.length===0) {
    if(!(await pool.query('SELECT 1 FROM employees WHERE active AND user_id=$1',[userId])).rowCount)throw new Error('UNKNOWN_EMPLOYEE');
    if(command==='grant-admin')await pool.query('INSERT INTO administrator_grants(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING',[userId]);
    else await pool.query('DELETE FROM administrator_grants WHERE user_id=$1',[userId]);
    console.log(command==='grant-admin'?'Explicit administrator access granted.':'Explicit administrator access revoked.');
  } else throw new Error('INVALID_ADMIN_COMMAND');
} catch { console.error('ADMIN_OPERATION_FAILED');process.exitCode=1; }
finally {await pool.end();}
