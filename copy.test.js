const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const copy=require('./praise-copy.js');
const catalog=require('./motivation-templates.js');
test('all 49 boost/impact draft pairs use natural phrases without raw taxonomy suffixes',()=>{
 for(const boost of Object.keys(copy.actions))for(const impact of Object.keys(copy.outcomes)){
   const message=copy.draft({projectName:'고객사 A 장비 셋업',recipient:'테스트',mission:'문서 작성',boost,impact});
   assert.match(message,/테스트님, 고객사 A 장비 셋업에서 문서 작성 업무에서/);
   assert.doesNotMatch(message,/undefined|NaN|이라는 변화|로서 함께한|책임감\(R&R\) 덕분/);
   assert.equal((message.match(/덕분에/g)||[]).length,1);
 }
});
test('home copy is synced with its reference and avoids rejected abstractions',()=>{
 const guide=fs.readFileSync(path.join(__dirname,'MOTIVATION_COPY.md'),'utf8');
 for(const entry of Object.values(catalog)){
   for(const text of [...entry.titles,...entry.facts,...entry.endings]){
     assert.ok(guide.includes(text),text);
     assert.doesNotMatch(text,/구체적인 인정|협업의 순간|인정의 기록|다음 인정|빛나는 순간|당신의/);
   }
 }
 const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
 assert.doesNotMatch(app,/동료가 기억한 협업의 순간/);
});

test('local preview varies six tones without casual speech or invented familiarity',()=>{
 const drafts=new Set();
 for(const partner of ['동료','상사 / 선배','후배 / 신입'])for(const recipientScope of ['같은팀','타팀']){
   const message=copy.draft({recipient:'가상 동료',projectName:'가상 문서 검토',mission:'문서 작성',boost:'정보 공유',impact:'품질 향상',partner,recipientScope});
   drafts.add(message);
   assert.match(message,/정보를 제때 공유/);assert.match(message,/완성도/);
   assert.doesNotMatch(message,/늘 함께|누구보다 가까운|잘했|성장했|수고했어|undefined/);
   if(partner==='상사 / 선배')assert.match(message,/감사드립니다\.$/);
   else if(recipientScope==='같은팀')assert.match(message,/고마워요\.$/);
   else assert.match(message,/감사합니다\.$/);
 }
 assert.equal(drafts.size,6);
});
