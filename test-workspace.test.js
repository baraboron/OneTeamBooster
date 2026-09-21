const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create,empty}=require('./test-workspace.js');
const users=[{USER_ID:'a',USER_NM:'가상 A'},{USER_ID:'b',USER_NM:'가상 B'}];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(overrides={}){
 const data=[],states=[],saved=new Map();let id='';
 const api={system:async()=>({testUserMode:true}),testUsers:async()=>({mode:'test',data:users}),setTestUser:value=>id=value,
   workspace:async()=>({...empty(),mode:'test',employee:users.find(user=>user.USER_ID===id),points:id==='a'?10:20}),
   leaderboard:async()=>({mode:'test',scope:'test',leaders:[]}),send:async()=>({id:'record'}),...overrides};
 const workspace=create({api,onData:value=>data.push(value),onState:value=>states.push(value),storage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)}});
 return{workspace,data,states,saved,api};
}
test('test mode starts empty, requires explicit selection and remembers only the ID',async t=>{
 const h=harness();t.after(()=>h.workspace.stop());await h.workspace.init();
 assert.equal(h.workspace.getState().ready,false);assert.equal(h.data.at(-1).points,0);
 await h.workspace.select('a');assert.equal(h.data.at(-1).points,10);assert.equal(h.saved.get('otb-test-user'),'a');
 await h.workspace.select('b');assert.equal(h.data.at(-1).points,20);
 assert.equal(h.saved.size,1);assert.equal(h.workspace.getState().employee.USER_ID,'b');
});
test('late response from previous user is discarded and failed refresh disables writes',async t=>{
 const h=harness();t.after(()=>h.workspace.stop());await h.workspace.init();let oldResolve;
 h.api.workspace=()=>new Promise(resolve=>oldResolve=resolve);const previous=h.workspace.select('a');
 h.api.workspace=async()=>({...empty(),mode:'test',employee:users[1],points:25});await h.workspace.select('b');
 oldResolve({...empty(),mode:'test',employee:users[0],points:999});await previous;
 assert.equal(h.data.at(-1).points,25);
 h.api.workspace=async()=>{throw new Error('연결 오류');};await h.workspace.refresh();
 assert.equal(h.workspace.getState().ready,false);await assert.rejects(h.workspace.send({},'request'));
});
test('saving prevents user switches and duplicate clicks; confirmed writes reload server data',async t=>{
 let resolve;const h=harness({send:()=>new Promise(r=>resolve=r)});t.after(()=>h.workspace.stop());await h.workspace.init();await h.workspace.select('a');
 const saving=h.workspace.send({},'same-request');await tick();
 assert.equal(await h.workspace.select('b'),false);await assert.rejects(h.workspace.send({},'same-request'));
 h.api.workspace=async()=>({...empty(),mode:'test',employee:users[0],points:30});resolve({id:'record'});await saving;
 assert.equal(h.data.at(-1).points,30);assert.equal(h.workspace.getState().busy,false);
});
