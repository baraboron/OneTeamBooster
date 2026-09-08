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
