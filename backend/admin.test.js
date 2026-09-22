import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adminHistory,hasAdminAccess} from './domain.js';
import {ensureTestAdministrators} from './test-users.js';

test('administrator history rejects users without an explicit grant',async()=>{
  const calls=[];
  const pool={query:async(sql,values)=>{calls.push({sql,values});return{rowCount:0,rows:[]};}};
  assert.equal(await hasAdminAccess(pool,'member-a'),false);
  await assert.rejects(adminHistory(pool,'member-a','test-campaign',new URLSearchParams()),{code:'ADMIN_FORBIDDEN'});
  assert.equal(calls.every(call=>call.values[0]==='member-a'),true);
});

test('administrator history parameterizes user, direction and search filters',async()=>{
  const calls=[];
  const pool={query:async(sql,values)=>{
    calls.push({sql,values});
    if(sql.includes('administrator_grants'))return{rowCount:1,rows:[{}]};
    if(sql.startsWith('SELECT 1 FROM employees'))return{rowCount:1,rows:[{}]};
    if(sql.startsWith('SELECT count'))return{rowCount:1,rows:[{total:0}]};
    return{rowCount:0,rows:[]};
  }};
  const result=await adminHistory(pool,'admin-a','test-campaign',new URLSearchParams({userId:'user-a',direction:'received',q:'%_\\',page:'2'}));
  assert.equal(result.page,2);assert.equal(result.total,0);
  const count=calls.find(call=>call.sql.startsWith('SELECT count'));
  assert.deepEqual(count.values,['test-campaign','user-a','%\\%\\_\\\\%']);
  assert.match(count.sql,/b\.recipient_id=\$2/);assert.match(count.sql,/ILIKE \$3 ESCAPE/);
  const records=calls.find(call=>call.sql.includes('FROM boosters b JOIN employees s')&&!call.sql.startsWith('SELECT count'));
  assert.deepEqual(records.values,['test-campaign','user-a','%\\%\\_\\\\%',50,50]);
});

test('direction filters require a selected user and invalid filters fail early',async()=>{
  const pool={query:async sql=>sql.includes('administrator_grants')?{rowCount:1,rows:[{}]}:{rowCount:0,rows:[]}};
  await assert.rejects(adminHistory(pool,'admin','campaign',new URLSearchParams({direction:'sent'})),{code:'ADMIN_USER_REQUIRED'});
  await assert.rejects(adminHistory(pool,'admin','campaign',new URLSearchParams({direction:'invalid'})),{code:'INVALID_ADMIN_FILTER'});
});

test('the configured unique test user receives the explicit administrator grant',async()=>{
  const inserted=[];
  const people=[
    {USER_ID:'preview-a',USER_NM:'송재현',DEPT_CD:'dept-a',DEPT_NM:'가상 부서',ROLE_NM:'가상 직책'},
    {USER_ID:'preview-b',USER_NM:'김영훈',DEPT_CD:'dept-b',DEPT_NM:'가상 부서',ROLE_NM:'가상 직책'}
  ];
  const pool={query:async(sql,values)=>{
    if(sql.includes('SELECT profile FROM employees'))return{rows:people.map(profile=>({profile}))};
    if(sql.includes('INSERT INTO administrator_grants')){inserted.push(values[0]);return{rowCount:1,rows:[]};}
    throw new Error('Unexpected query');
  }};
  assert.deepEqual(await ensureTestAdministrators(pool,['송재현']),{count:1});
  assert.deepEqual(inserted,['preview-a']);
  await assert.rejects(ensureTestAdministrators(pool,['허용되지 않은 사용자']),/INVALID_TEST_ADMIN_CONFIGURATION/);
});
