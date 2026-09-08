// Lightweight runtime harness, not a browser layout/accessibility test.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function boot(){
 const nodes=new Map(),storage=new Map();
 function node(key){
   if(!nodes.has(key)){
     const classes=new Set(),listeners={};
     nodes.set(key,{id:key.replace('#',''),value:key==='#demo-role'?'member':'',dataset:{},innerHTML:'',textContent:'',children:[],hidden:false,listeners,
       classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x)},
       querySelectorAll:()=>[],setAttribute(){},addEventListener:(type,fn)=>listeners[type]=fn,click(){this.onclick?.();listeners.click?.({target:this});},focus(){},reset(){},scrollIntoView(){}});
   }
   return nodes.get(key);
 }
 const context={console,URL,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,location:{href:'http://localhost/',origin:'http://localhost'},document:{hidden:false,querySelector:node,querySelectorAll:()=>[],getElementById:id=>node('#'+id),addEventListener(){}},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},addEventListener(){},scrollTo(){}};
 context.window=context;vm.createContext(context);
 for(const file of ['leader.js','motivation-templates.js','home-domain.js','leaderboard-client.js','home-config.js','home.js','praise-copy.js','app.js']){
   vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),context,{filename:file});
 }
 return {node,context,storage};
}
test('application boots with populated home, contextual encouragement and disconnected TOP 10',()=>{
 const {node}=boot();
 assert.equal(node('#point-total').textContent,95);
 assert.equal(node('#motivation-label').textContent,'아직 답장하지 않은 칭찬');
 assert.match(node('#home-brief').textContent,/2건/);
 assert.match(node('#recent-list').innerHTML,/박지훈/);
 assert.equal(node('#leaderboard-status').textContent,'연결 대기');
 const before=node('#motivation-title').textContent;node('#motivation-next').click();
 assert.notEqual(node('#motivation-title').textContent,before);
});
test('sending and replying refresh motivation; sample ranking follows local points',()=>{
 const {node,storage}=boot();
 node('#message-preview').dataset.values=JSON.stringify({projectName:'검증 프로젝트',recipient:'시연 동료',partner:'동료',mission:'문서 작성',boost:'정보 공유',impact:'품질 향상'});
 node('#message-text').value='검증용 메시지';node('#send-booster').click();
 assert.equal(node('#point-total').textContent,105);
 assert.equal(node('#motivation-label').textContent,'칭찬을 보냈어요');
 assert.equal(JSON.parse(storage.get('otb-prototype-v2')).sentBoosters.length,3);
 node('#received-list').listeners.click({target:{dataset:{reply:'r1'},classList:{contains:()=>false}}});
 node('#reply-template').value='따뜻한 칭찬 덕분에 힘이 났어요. 함께해 주셔서 고맙습니다.';node('#reply-form').listeners.submit({preventDefault(){}});
 assert.equal(node('#motivation-label').textContent,'답장을 보냈어요');
 node('#demo-role').onchange({target:{value:'leader'}});
 assert.match(node('#insight').innerHTML,/협업이 많은 부서 TOP 3/);
 assert.match(node('#insight').innerHTML,/설비기술팀|연구소|영업팀/);
 node('#leaderboard-sample').click();
 assert.equal(node('#leaderboard-status').textContent,'시연 데이터');
 assert.match(node('#leaderboard-list').innerHTML,/나 · 로컬 시연/);
 assert.match(node('#leaderboard-list').innerHTML,/110/);
 node('#leaderboard-sample').click();
 assert.equal(node('#leaderboard-status').textContent,'연결 대기');
});
