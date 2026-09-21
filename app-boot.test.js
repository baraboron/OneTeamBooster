// Lightweight runtime harness, not a browser layout/accessibility test.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function boot({fetchFn}={}){
 const nodes=new Map(),storage=new Map();
 function node(key){
   if(!nodes.has(key)){
     const classes=new Set(),listeners={};
     nodes.set(key,{id:key.replace('#',''),value:key==='#demo-role'?'member':'',dataset:{},innerHTML:'',textContent:'',children:[],hidden:false,listeners,
       classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x)},
       append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},querySelectorAll:()=>[],setAttribute(){},addEventListener:(type,fn)=>listeners[type]=fn,click(){this.onclick?.();listeners.click?.({target:this});},focus(){},reset(){},scrollIntoView(){}});
   }
   return nodes.get(key);
 }
 let generated=0;
 const context={console,URL,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,fetch:fetchFn,crypto:require('node:crypto').webcrypto,location:{href:'http://localhost/',origin:'http://localhost'},document:{hidden:false,querySelector:node,querySelectorAll:()=>[],createElement:()=>node('#generated-'+generated++),getElementById:id=>node('#'+id),addEventListener(){}},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},addEventListener(){},scrollTo(){}};
 context.window=context;vm.createContext(context);
 for(const file of ['leader.js','motivation-templates.js','home-domain.js','leaderboard-client.js','home-config.js','home.js','praise-copy.js',...(fetchFn?['api-client.js','employee-picker.js','test-workspace.js']:[]),'app.js']){
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

test('integrated test-user UI searches employees, submits to server and switches records without local writes',async()=>{
 const people=[{USER_ID:'a',USER_NM:'가상 A',DEPT_NM:'가상 부서'},{USER_ID:'b',USER_NM:'가상 B',DEPT_NM:'가상 부서'}];
 let sent=false,observed;
 const h=boot({fetchFn:async(path,options)=>{
   const id=options.headers['X-OTB-Test-User'];let body={};
   if(path==='/api/system')body={testUserMode:true};
   else if(path==='/api/test-users')body={mode:'test',data:people};
   else if(path==='/api/departments')body={data:[]};
   else if(path.startsWith('/api/employees?'))body={data:[people[1]],total:1,page:1,hasMore:false};
   else if(path==='/api/leaderboard')body={scope:'test',mode:'test',asOf:new Date().toISOString(),leaders:[]};
   else if(path==='/api/workspace')body={mode:'test',employee:people.find(p=>p.USER_ID===id),points:sent?(id==='a'?10:20):0,remainingToday:sent?2:3,weeklyRecipientIds:[],received:[],sentBoosters:[]};
   else if(path==='/api/boosters'){observed={id,body:JSON.parse(options.body),key:options.headers['Idempotency-Key']};sent=true;body={id:'record'};}
   return {ok:true,json:async()=>body};
 }});
 const tick=()=>new Promise(resolve=>setImmediate(resolve));await tick();
 assert.equal(h.node('#test-user-panel').hidden,false);assert.equal(h.node('#point-total').textContent,0);
 await h.node('#test-user').listeners.change({target:{value:'a'}});
 h.node('#open-composer').click();
 assert.equal(h.node('#recipient-name-field').hidden,true,'Hide the display-only recipient field during employee search');
 assert.equal(h.node('#employee-query-field').hidden,false,'The recipient label must expose the editable search field');
 assert.equal(Boolean(h.node('#employee-query').readOnly),false);
 assert.equal(h.node('#recipient-source-field').hidden,true,'Test users do not need a disabled source switch');
 h.node('#employee-query').value='가상';h.node('#employee-query').listeners.keydown({key:'Enter',preventDefault(){}});await tick();
 h.node('#employee-results').children[0].children[0].click();assert.equal(h.node('#recipient').value,'가상 B');
 const selected={partner:['동료'],mission:['문서 작성'],boost:['정보 공유','동료 지지'],impact:['품질 향상']};
 h.context.document.querySelectorAll=selector=>{const key=selector.match(/data-name="(\w+)"/);return key?(selected[key[1]]||[]).map((value,i)=>({dataset:{value,rank:String(i+1)}})):[];};
 h.node('#project-name').value='가상 업무';h.node('#booster-form').listeners.submit({preventDefault(){}});
 assert.equal(h.node('#send-booster').disabled,false);await h.node('#send-booster').onclick();
 assert.equal(observed.id,'a');assert.equal(observed.body.recipientId,'b');assert.equal(observed.body.boosts.length,2);assert.match(observed.key,/^[\da-f-]{36}$/);
 assert.equal(h.node('#point-total').textContent,10);assert.equal(h.storage.size,0);
 await h.node('#test-user').listeners.change({target:{value:'b'}});assert.equal(h.node('#current-user-name').textContent,'가상 B');assert.equal(h.node('#point-total').textContent,20);
 assert.equal(h.node('#demo-role').hidden,true);assert.equal(h.node('#leaderboard-title').textContent,'테스트 포인트 TOP 10');
 vm.runInContext('remoteWorkspace.stop()',h.context);
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

test('ordered selections survive save, reuse and summaries; employee drafts never enter local storage',()=>{
 const {node,context,storage}=boot();
 const values={projectName:'가상 업무',recipient:'시연 동료',partner:'동료',mission:'문서 작성 · 평가 및 분석',boost:'정보 공유',impact:'품질 향상',missions:['문서 작성','평가 및 분석'],boosts:['정보 공유','동료 지지','유연성'],impacts:['품질 향상','팀워크 강화']};
 for(const [key,plural] of [['mission','missions'],['boost','boosts'],['impact','impacts']]){
   const group=node('[data-name="'+key+'"]');group.dataset.mode=key==='mission'?'multiple':'rank';
   group.children=[...values[plural]].reverse().map(value=>{const button=node('#'+key+value);button.dataset.value=value;return button;});
 }
 node('#message-preview').dataset.values=JSON.stringify(values);node('#message-text').value='시연 초안';node('#send-booster').click();
 const item=JSON.parse(storage.get('otb-prototype-v2')).sentBoosters[0];assert.deepEqual(item.boosts,values.boosts);assert.deepEqual(item.impacts,values.impacts);
 assert.match(node('#sent-list').innerHTML,/정보 공유 → 동료 지지 → 유연성/);
 node('#sent-list').listeners.click({target:{dataset:{reuse:item.id}}});
 assert.equal(node('[data-name="boost"]').children.find(b=>b.dataset.value==='유연성').dataset.rank,'3');
 const counts=vm.runInContext('countBy(data.sentBoosters,"boost")',context);assert.equal(counts['유연성'],1);
 const before=storage.get('otb-prototype-v2');node('#message-preview').dataset.values=JSON.stringify({...values,directoryDraft:true});node('#send-booster').click();assert.equal(storage.get('otb-prototype-v2'),before);
 node('#open-employee-search').click();assert.equal(node('#recipient-source').value,'directory');assert.equal(node('#employee-directory').hidden,false);
 node('#recipient-source').listeners.change({target:{value:'demo'}});
 assert.equal(node('#recipient-name-field').hidden,false);assert.equal(node('#employee-query-field').hidden,true);assert.equal(node('#recipient').readOnly,false);
});
