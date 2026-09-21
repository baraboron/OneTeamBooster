// Run inside the deployed backend Pod. Reads approved test identity in memory only.
// Generates six synthetic drafts; never sends a booster or changes points.
import assert from 'node:assert/strict';
const origin='http://192.168.20.72:30081';
assert.equal(process.env.OPENAI_GATEWAY_URL,'https://uadmxxpoxaukuwwvfdpr.supabase.co/functions/v1/openai-gateway');
assert.ok(process.env.OTB_GATEWAY_TOKEN?.length>=32);
assert.equal(Boolean(process.env.OPENAI_API_KEY),false,'Gateway deployment does not need an OpenAI API key in the internal server');
const call=(path,options={})=>fetch(origin+path,{...options,signal:AbortSignal.timeout(35000)});
const system=await (await call('/api/system')).json();
assert.equal(system.capabilities.aiGeneration,true);assert.equal(system.testUserMode,true);assert.equal(system.productionReady,false);
const users=await (await call('/api/test-users')).json();assert.equal(users.data.length,2);
const headers={'Content-Type':'application/json','X-OTB-Test-User':users.data[0].USER_ID,Origin:origin};
const payload={projectName:'가상 문서 검토',partner:'동료',recipientScope:'같은팀',missions:['문서 작성'],boosts:['정보 공유'],impacts:['품질 향상']};
const options={method:'POST',headers,body:JSON.stringify(payload)};
const summary=state=>({points:state.points,sent:state.sentBoosters.length,received:state.received.length});
const before=await Promise.all(users.data.map(async user=>summary(await (await call('/api/workspace',{headers:{...headers,'X-OTB-Test-User':user.USER_ID}})).json())));
assert.equal((await call('/api/drafts',{...options,headers:{'Content-Type':'application/json',Origin:origin}})).status,401);
assert.equal((await call('/api/drafts',{...options,headers:{...headers,Origin:'https://invalid.example'}})).status,403);
assert.equal((await call('/api/leader/records',{headers})).status,403);
const results=[];
for(const partner of ['동료','상사 / 선배','후배 / 신입'])for(const recipientScope of ['같은팀','타팀']){
  const user=users.data[results.length%users.data.length];
  const generated=await call('/api/drafts',{...options,headers:{...headers,'X-OTB-Test-User':user.USER_ID},body:JSON.stringify({...payload,partner,recipientScope})});
  assert.equal(generated.status,200,'AI draft HTTP status');const draft=await generated.json();
  assert.equal(draft.source,'openai');assert.equal(draft.promptVersion,'praise-ko-v2');
  assert.ok(draft.message.length>0&&draft.message.length<=500&&/[가-힣]/.test(draft.message));
  results.push({partner,recipientScope,model:draft.model,messageLength:draft.message.length,...(process.argv.includes('--show-drafts')?{message:draft.message}:{})});
}
const after=await Promise.all(users.data.map(async user=>summary(await (await call('/api/workspace',{headers:{...headers,'X-OTB-Test-User':user.USER_ID}})).json())));
assert.deepEqual(after,before);
const client=await (await call('/api-client.js')).text();assert.ok(client.includes("this.request('/drafts'"));
console.log(JSON.stringify({status:'PASS',route:'internal-app -> Supabase gateway -> OpenAI',promptVersion:'praise-ko-v2',results,pointsUnchanged:true,unauthenticated:401,wrongOrigin:403,leader:403}));
