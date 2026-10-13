import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateBooster,OPTIONS,presentRecord,workspace} from './domain.js';
import {createApplication} from './application.js';
import {createServer} from './server.js';
import {once} from 'node:events';

test('all ordered selections are validated and preserved; client identity/points are discarded',()=>{
  const input={recipientId:'test-b',projectName:'검증 업무',partner:'동료',missions:OPTIONS.missions.slice(0,3),boosts:OPTIONS.boosts.slice(0,3),impacts:OPTIONS.impacts.slice(0,3),message:'검증 칭찬',points:999,senderId:'forged'};
  const value=validateBooster(input);
  assert.equal(value.recipientScope,undefined);
  assert.deepEqual(validateBooster({...input,isAnonymous:false}),value,'Named sends preserve old idempotency hashes');
  assert.equal(validateBooster({...input,isAnonymous:true}).isAnonymous,true);
  for(const isAnonymous of ['true',1,null,{}])assert.throws(()=>validateBooster({...input,isAnonymous}),{code:'INVALID_ANONYMITY'});
  for(const recipientScope of OPTIONS.recipientScope)assert.equal(validateBooster({...input,recipientScope}).recipientScope,recipientScope);
  assert.throws(()=>validateBooster({...input,recipientScope:'private-department'}),{code:'INVALID_RECIPIENT_SCOPE'});
  assert.deepEqual(value.boosts,input.boosts);assert.deepEqual(value.impacts,input.impacts);
  assert.equal(value.points,undefined);assert.equal(value.senderId,undefined);
  for(const broken of [{...input,boosts:['not-allowed']},{...input,missions:['문서 작성','문서 작성']},{...input,message:' '},{...input,impacts:[]}])assert.throws(()=>validateBooster(broken));
});

test('anonymous identity is removed from received payload but available to the sender',async()=>{
  const row={id:'record',sender_id:'sender-private-id',recipient_id:'recipient-id',is_anonymous:true,
    sender:{USER_NM:'가상 발신자',DEPT_NM:'가상 발신부서'},recipient:{USER_NM:'가상 수신자',DEPT_NM:'가상 수신부서'},
    missions:['문서 작성'],boosts:['정보 공유'],impacts:['품질 향상'],message:'감사합니다.',created_at:new Date()};
  const masked=presentRecord(row);
  assert.equal(masked.from,'익명');assert.equal(masked.team,'');assert.equal(masked.senderId,null);
  assert.equal(JSON.stringify(masked).includes('발신'),false);
  assert.equal(presentRecord(row,{revealSender:true}).senderId,row.sender_id);
  assert.equal(presentRecord({...row,is_anonymous:false}).from,row.sender.USER_NM);
  const pool={query:async sql=>({rows:sql.includes('SELECT b.*')?[row]:sql.includes('sum(points)')?[{points:20}]:[{daily:0,weekly:[]}]})};
  assert.equal((await workspace(pool,row.recipient_id,'campaign')).received[0].senderId,null);
  assert.equal((await workspace(pool,row.sender_id,'campaign')).sentBoosters[0].from,row.sender.USER_NM);
});

test('deployed preview APIs reject spoofed IDs, roles, cookies and writes before any DB lookup',async t=>{
  const application=createApplication({pool:{query(){throw new Error('DB must not be queried without authentication');}}});
  const server=createServer({application});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const path of ['/api/employees?q=test','/api/workspace','/api/leaderboard','/api/leader/records','/api/me','/api/auth/login','/api/boosters']){
    const response=await fetch(base+path,{method:path==='/api/boosters'?'POST':'GET',headers:{'X-User-Id':'admin','X-Role':'leader',Cookie:'role=admin'}});
    assert.equal(response.status,401);assert.equal((await response.json()).error.code,'AUTH_NOT_CONFIGURED');
  }
});
