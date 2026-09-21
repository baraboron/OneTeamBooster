import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateBooster,OPTIONS} from './domain.js';
import {createApplication} from './application.js';
import {createServer} from './server.js';
import {once} from 'node:events';

test('all ordered selections are validated and preserved; client identity/points are discarded',()=>{
  const input={recipientId:'test-b',projectName:'검증 업무',partner:'동료',missions:OPTIONS.missions.slice(0,3),boosts:OPTIONS.boosts.slice(0,3),impacts:OPTIONS.impacts.slice(0,3),message:'검증 칭찬',points:999,senderId:'forged'};
  const value=validateBooster(input);
  assert.equal(value.recipientScope,undefined);
  for(const recipientScope of OPTIONS.recipientScope)assert.equal(validateBooster({...input,recipientScope}).recipientScope,recipientScope);
  assert.throws(()=>validateBooster({...input,recipientScope:'private-department'}),{code:'INVALID_RECIPIENT_SCOPE'});
  assert.deepEqual(value.boosts,input.boosts);assert.deepEqual(value.impacts,input.impacts);
  assert.equal(value.points,undefined);assert.equal(value.senderId,undefined);
  for(const broken of [{...input,boosts:['not-allowed']},{...input,missions:['문서 작성','문서 작성']},{...input,message:' '},{...input,impacts:[]}])assert.throws(()=>validateBooster(broken));
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
