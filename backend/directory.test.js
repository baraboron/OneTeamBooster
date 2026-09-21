import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { searchEmployees } from './directory.js';
import { createApplication } from './application.js';
import { createServer } from './server.js';

test('search bounds and literal wildcard escaping keep queries parameterized', async()=>{
  const calls=[];
  const pool={query:async(sql,values)=>{calls.push({sql,values});return{rows:[{total:25,data:[{USER_ID:'fake-21',USER_NM:'가상'}]}]};}};
  const result=await searchEmployees(pool,new URLSearchParams({q:'%_\\',page:'2',DEPT_CD:'fake-dept'}),'self');
  assert.deepEqual(calls[0].values,['self','%\\%\\_\\\\%','fake-dept',20,20]);
  assert.equal(result.page,2);assert.equal(result.totalPages,2);assert.equal(result.hasMore,false);
  for(const params of [{},{q:' ',DEPT_CD:' '},{q:'a'},{q:'a',DEPT_CD:'fake-dept'},{q:'a'.repeat(51)},{q:'test',page:'0'},{q:'test',page:'-1'},{q:'test',page:'1.5'},{q:'test',page:'99999'},{DEPT_CD:'a'.repeat(101)}]){
    await assert.rejects(searchEmployees(pool,new URLSearchParams(params)));
  }
  assert.equal(calls.length,1);
  await searchEmployees(pool,new URLSearchParams({DEPT_CD:' fake-dept ',page:'2'}),'self');
  assert.deepEqual(calls.at(-1).values,['self','%%','fake-dept',20,20]);
});

test('explicit preview exposes only directory reads; stale data and spoofed writes stay blocked',async t=>{
  let fresh=true;
  const pool={query:async(sql)=>{
    if(sql.includes('directory_state'))return{rows:[{fresh}]};
    if(sql.includes('WITH matches'))return{rows:[{total:0,data:[]}]};
    return{rows:[]};
  }};
  const server=createServer({application:createApplication({pool,previewEmployeeSearch:true})});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`;
  const result=await fetch(base+'/api/employees?q=test');assert.equal(result.status,200);assert.deepEqual((await result.json()).data,[]);
  assert.equal((await fetch(base+'/api/employees?DEPT_CD=fake-dept')).status,200);
  assert.equal((await fetch(base+'/api/employees')).status,400);
  assert.equal((await fetch(base+'/api/departments')).status,200);
  for(const path of ['/api/employees','/api/departments','/api/boosters','/api/boosters/fake/reply']){
    assert.equal((await fetch(base+path,{method:'POST',headers:{'X-User-Id':'admin'}})).status,401);
  }
  for(const path of ['/api/workspace','/api/me','/api/leaderboard','/api/leader/records'])assert.equal((await fetch(base+path)).status,401);
  fresh=false;assert.equal((await fetch(base+'/api/employees?q=test')).status,503);
});
