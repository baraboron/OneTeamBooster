const {test}=require('node:test');
const assert=require('node:assert/strict');
const Client=require('./api-client.js');
test('API client uses same-origin requests and preserves employee field names',async()=>{
  let observed;
  const client=new Client(async(url,options)=>{observed={url,options};return{ok:true,json:async()=>({data:[{USER_ID:'fake',USER_NM:'가상 직원'}]})};});
  const result=await client.employees('가상');assert.equal(result.data[0].USER_ID,'fake');assert.match(observed.url,/^\/api\/employees\?q=/);assert.equal(observed.options.credentials,'same-origin');
  await client.send({recipientId:'fake',boosts:['정보 공유','동료 지지']},'stable-request-id','csrf-test');assert.equal(observed.options.headers['Idempotency-Key'],'stable-request-id');
  const controller=new AbortController();await client.employees('가상',{page:2,department:'dept-test',signal:controller.signal});assert.match(observed.url,/page=2&DEPT_CD=dept-test/);assert.equal(observed.options.signal,controller.signal);
  await client.adminRecords({userId:'user-a',direction:'received',q:'문서',page:2});assert.match(observed.url,/^\/api\/admin\/records\?/);assert.match(observed.url,/userId=user-a&direction=received&q=%EB%AC%B8%EC%84%9C&page=2/);
});
test('authentication failures remain failures rather than empty successful data',async()=>{
  const client=new Client(async()=>({ok:false,status:401,json:async()=>({error:{code:'AUTH_NOT_CONFIGURED',message:'로그인 연결 대기'}})}));
  await assert.rejects(client.workspace(),error=>error.status===401&&error.code==='AUTH_NOT_CONFIGURED');
});
