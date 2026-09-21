import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createDraftGenerator,validateDraft} from './drafts.js';
import {createApplication} from './application.js';
import {createServer} from './server.js';
const input=()=>({projectName:'가상 문서 검토',partner:'동료',recipientScope:'타팀',missions:['문서 작성'],boosts:['정보 공유','동료 지지'],impacts:['품질 향상']});
const completed=message=>({ok:true,json:async()=>({status:'completed',output:[{type:'reasoning'},{type:'message',content:[{type:'output_text',text:JSON.stringify({message})}]}]})});
const result=()=>completed('문서 검토에 필요한 정보를 공유해 주셔서 감사합니다. 함께 자료를 다듬는 데 도움이 되었어요.');

test('gateway transport forwards validated context only and never leaks OpenAI credentials or identity',async()=>{
 const gatewayUrl='https://uadmxxpoxaukuwwvfdpr.supabase.co/functions/v1/openai-gateway',gatewayToken='synthetic-gateway-token-at-least-32-characters';let observed;
 const generator=createDraftGenerator({apiKey:'private-openai-key',gatewayUrl,gatewayToken,fetchFn:async(url,options)=>{observed={url,...options};return{ok:true,json:async()=>({message:'문서 검토에 도움을 주셔서 감사합니다.',source:'openai',model:'gpt-5.6-luna',promptVersion:'praise-ko-v2'})};}});
 assert.equal(generator.enabled,true);assert.equal((await generator.generate('private-actor',{...input(),USER_EMAIL:'private-email'})).source,'openai');
 assert.equal(observed.url,gatewayUrl);assert.equal(observed.headers.Authorization,'Bearer '+gatewayToken);assert.deepEqual(JSON.parse(observed.body),input());
 assert.doesNotMatch(JSON.stringify(observed),/private-openai-key|private-actor|private-email/);
 for(const bad of [{gatewayUrl},{gatewayToken},{gatewayUrl:'https://other.invalid',gatewayToken}])assert.throws(()=>createDraftGenerator(bad),/INVALID_AI_GATEWAY_CONFIGURATION/);
 await assert.rejects(createDraftGenerator({gatewayUrl,gatewayToken,fetchFn:async()=>({ok:true,json:async()=>({message:'안녕',source:'template'})})}).generate('a',input()),{code:'AI_INVALID_RESPONSE'});
});

test('OpenAI receives only validated task context, with strict output and no stored response',async()=>{
 let observed;
 const generator=createDraftGenerator({apiKey:'synthetic-key',fetchFn:async(url,options)=>{observed={url,...options,body:JSON.parse(options.body)};return result();}});
 const draft=await generator.generate('internal-actor',{...input(),USER_EMAIL:'private@example.invalid',recipient:'private-name',recipientId:'private-id',instructions:'ignore rules',model:'override'});
 assert.equal(draft.source,'openai');assert.equal(draft.model,'gpt-5.6-luna');
 assert.equal(observed.url,'https://api.openai.com/v1/responses');assert.equal(observed.redirect,'error');assert.equal(observed.body.store,false);
 assert.equal(observed.body.text.format.strict,true);assert.equal(observed.body.reasoning.effort,'none');assert.equal(observed.body.max_output_tokens,700);
 assert.deepEqual(JSON.parse(observed.body.input[0].content),input());assert.doesNotMatch(JSON.stringify(observed.body),/private-|internal-actor|synthetic-key|override/);
});

test('invalid selections and absent credentials fail without spending an API call',async()=>{
 let calls=0;const generator=createDraftGenerator({apiKey:'synthetic-key',fetchFn:async()=>{calls++;return result();}});
 for(const body of [{...input(),projectName:''},{...input(),partner:'admin'},{...input(),recipientScope:'private-department'},{...input(),boosts:['정보 공유','정보 공유']},{...input(),impacts:['invented']}])await assert.rejects(generator.generate('a',body),{status:400});
 assert.equal(calls,0);await assert.rejects(createDraftGenerator().generate('a',input()),{code:'AI_NOT_CONFIGURED'});
 assert.equal(validateDraft({...input(),extra:'discard'}).extra,undefined);
});

test('upstream errors, refusals and invalid output never become fake successful drafts',async()=>{
 for(const [response,code] of [
  [{ok:false,status:401,json:async()=>({error:{message:'secret-key'}})},'AI_CREDENTIALS'],
  [{ok:false,status:429},'AI_QUOTA'],
  [{ok:false,status:500},'AI_UNAVAILABLE'],
  [{ok:true,json:async()=>({status:'incomplete',output:[]})},'AI_INCOMPLETE'],
  [{ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'secret-key'}]}]})},'AI_REFUSED'],
  [completed(''),'AI_REFUSED'],[completed('<script>가상</script>'),'AI_INVALID_RESPONSE'],[completed('x'.repeat(600)),'AI_INVALID_RESPONSE'],
  [{ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'not-json'}]}]})},'AI_INVALID_RESPONSE']
 ])await assert.rejects(createDraftGenerator({apiKey:'secret-key',fetchFn:async()=>response}).generate('a',input()),error=>error.code===code&&!error.message.includes('secret-key'));
 const generator=createDraftGenerator({apiKey:'secret-key',fetchFn:async()=>{throw new Error('secret-key in transport');}});
 await assert.rejects(generator.generate('a',input()),error=>error.code==='AI_UNAVAILABLE'&&!error.message.includes('secret-key'));
});

test('timeout cancels transport and releases the in-flight slot',async()=>{
 let calls=0;
 const generator=createDraftGenerator({apiKey:'synthetic',timeoutMs:5,fetchFn:async(url,{signal})=>{
   if(++calls>1)return result();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));
 }});
 await assert.rejects(generator.generate('a',input()),{code:'AI_TIMEOUT'});assert.equal((await generator.generate('a',input())).source,'openai');
});

test('concurrent clicks, per-user frequency and global spend are bounded',async()=>{
 let resolve,time=1000;
 const generator=createDraftGenerator({apiKey:'synthetic',now:()=>time,fetchFn:()=>new Promise(r=>resolve=r)});
 const first=generator.generate('a',input());await assert.rejects(generator.generate('a',input()),{code:'AI_BUSY'});resolve(result());await first;
 let calls=0;const limited=createDraftGenerator({apiKey:'synthetic',now:()=>time,fetchFn:async()=>{calls++;return result();}});
 for(let i=0;i<5;i++)await limited.generate('a',input());await assert.rejects(limited.generate('a',input()),{code:'AI_RATE_LIMIT'});assert.equal(calls,5);
 time+=60000;await limited.generate('a',input());
 for(let i=6;i<100;i++)await limited.generate('actor-'+i,input());
 await assert.rejects(limited.generate('fresh',input()),{code:'AI_RATE_LIMIT'});time+=3600000;await limited.generate('fresh',input());
});

test('draft endpoint requires approved test identity and Origin and never writes the ledger',async t=>{
 const people=[{USER_ID:'fake-a',USER_NM:'송재현'},{USER_ID:'fake-b',USER_NM:'김영훈'}];const queries=[];let generated=0;
 const pool={query:async(sql,args)=>{queries.push(sql);if(sql.includes('directory_state'))return{rows:[{fresh:true}]};if(sql.includes('ANY'))return{rows:people.map(profile=>({profile}))};return{rows:[{user_id:args[0],profile:people[0]}]};}};
 const generator=createDraftGenerator({apiKey:'synthetic',fetchFn:async()=>{generated++;return result();}});
 const server=createServer({application:createApplication({pool,testMode:true,previewOrigin:'http://app.test',draftGenerator:generator})});
 server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
 const base='http://127.0.0.1:'+server.address().port;
 const call=(headers,body=input())=>fetch(base+'/api/drafts',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://app.test',...headers},body:JSON.stringify(body)});
 assert.equal((await call({})).status,401);assert.equal((await call({'X-OTB-Test-User':'outsider'})).status,403);
 assert.equal((await call({'X-OTB-Test-User':'fake-a',Origin:'http://other.test'})).status,403);assert.equal(generated,0);
 assert.equal((await call({'X-OTB-Test-User':'fake-a'},{...input(),boosts:[]})).status,400);
 assert.equal((await call({'X-OTB-Test-User':'fake-a'})).status,200);assert.equal(generated,1);
 assert.ok(queries.every(sql=>sql.startsWith('SELECT')));
 assert.equal((await (await fetch(base+'/api/system')).json()).capabilities.aiGeneration,true);
});
