// Run inside the deployed backend Pod. Reads approved test identity in memory only.
// Generates one synthetic draft; never sends a booster or changes points.
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
const payload={projectName:'가상 문서 검토',partner:'동료',missions:['문서 작성'],boosts:['정보 공유'],impacts:['품질 향상']};
const options={method:'POST',headers,body:JSON.stringify(payload)};
const before=await (await call('/api/workspace',{headers})).json();
assert.equal((await call('/api/drafts',{...options,headers:{'Content-Type':'application/json',Origin:origin}})).status,401);
assert.equal((await call('/api/drafts',{...options,headers:{...headers,Origin:'https://invalid.example'}})).status,403);
assert.equal((await call('/api/leader/records',{headers})).status,403);
const generated=await call('/api/drafts',options);
assert.equal(generated.status,200,'AI draft HTTP status');const draft=await generated.json();
assert.equal(draft.source,'openai');assert.equal(draft.promptVersion,'praise-ko-v1');
assert.ok(draft.message.length>0&&draft.message.length<=500&&/[가-힣]/.test(draft.message));
const after=await (await call('/api/workspace',{headers})).json();
assert.equal(after.points,before.points);assert.equal(after.sentBoosters.length,before.sentBoosters.length);assert.equal(after.received.length,before.received.length);
const client=await (await call('/api-client.js')).text();assert.ok(client.includes("this.request('/drafts'"));
console.log(JSON.stringify({status:'PASS',route:'internal-app -> Supabase gateway -> OpenAI',model:draft.model,messageLength:draft.message.length,pointsUnchanged:true,unauthenticated:401,wrongOrigin:403,leader:403}));
