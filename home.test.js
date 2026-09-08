const {test}=require('node:test');
const assert=require('node:assert/strict');
const D=require('./home-domain.js');
const T=require('./motivation-templates.js');
const Client=require('./leaderboard-client.js');
const full={sent:5,received:3,pending:2,replied:1,cross:1,points:120};
const blank={sent:0,received:0,pending:0,replied:0,cross:0,points:0};
const snapshot=()=>({scope:'company',mode:'live',periodLabel:'캠페인 누적',asOf:new Date().toISOString(),leaders:[{userId:'a',displayName:'가상 A',points:30,rank:1},{userId:'b',displayName:'가상 B',points:20,rank:2},{userId:'c',displayName:'가상 C',points:10,rank:3}]});

test('98 written components produce 672 distinct, fully resolved contextual combinations',()=>{
 assert.equal(Object.keys(T).length,7);
 let count=0,parts=0;
 for(const [key,entry] of Object.entries(T)){
   assert.equal(entry.titles.length,6);assert.equal(entry.facts.length,4);assert.equal(entry.endings.length,4);
   parts+=entry.titles.length+entry.facts.length+entry.endings.length;
   const messages=new Set(),m=key==='beginning'?blank:full;
   for(let i=0;i<96;i++){
     const copy=D.compose(m,key,i),text=[copy.title,copy.fact,copy.ending].join(' ');
     assert.doesNotMatch(text,/undefined|NaN|\{\w+\}/);messages.add(text);
   }
   assert.equal(messages.size,96);count+=messages.size;
 }
 assert.equal(parts,98);assert.equal(count,672);
});
test('zero records, pending and cross-team messages are gated by actual metrics',()=>{
 assert.deepEqual(D.eligible(blank),['beginning']);
 assert.throws(()=>D.compose(blank,'pending'));
 assert.equal(D.preferred(full),'pending');
 const m=D.metrics({points:95,received:[{replied:false},{replied:true}],sentBoosters:[{recipientScope:'타팀'}]});
 assert.deepEqual(m,{received:2,sent:1,pending:1,replied:1,cross:1,points:95});
 assert.ok(!D.eligible(m).includes('milestone'));
});
test('send, reply and receive immediately select corresponding encouragement',()=>{
 assert.equal(D.preferred({...full,sent:6},full),'sending');
 assert.equal(D.preferred({...full,replied:2,pending:1},full),'gratitude');
 assert.equal(D.preferred({...full,received:4},full),'receiving');
});
test('TOP 10 uses competition ranking and preserves every tied tenth-place entry',()=>{
 const rows=[120,110,100,90,80,70,60,50,40,30,30,20].map((points,i)=>({userId:String(i),displayName:'가상 '+i,points}));
 const ranked=D.rankLeaders(rows);
 assert.deepEqual(ranked.map(r=>r.rank),[1,2,3,4,5,6,7,8,9,10,10]);
 assert.deepEqual(rows.map(r=>r.points),[120,110,100,90,80,70,60,50,40,30,30,20]);
 assert.deepEqual(D.rankLeaders([{...rows[0],points:110},rows[1],rows[2]]).map(r=>r.rank),[1,1,3]);
 assert.throws(()=>D.rankLeaders([rows[0],rows[0]]));
 assert.throws(()=>D.rankLeaders([{...rows[0],points:-1}]));
 assert.throws(()=>D.rankLeaders([{...rows[0],points:'100'}]));
});
test('live snapshots require company scope, correct ranks and a valid freshness timestamp',()=>{
 assert.equal(D.validateSnapshot(snapshot()).stale,false);
 assert.equal(D.validateSnapshot({...snapshot(),asOf:new Date(Date.now()-61000).toISOString()}).stale,true);
 assert.throws(()=>D.validateSnapshot({...snapshot(),mode:'demo'}));
 assert.throws(()=>D.validateSnapshot({...snapshot(),scope:'local'}));
 assert.throws(()=>D.validateSnapshot({...snapshot(),asOf:'invalid'}));
 assert.throws(()=>D.validateSnapshot({...snapshot(),asOf:new Date(Date.now()+120000).toISOString()}));
 const bad=snapshot();bad.leaders[0].rank=2;assert.throws(()=>D.validateSnapshot(bad));
 assert.equal(D.validateSnapshot({...snapshot(),leaders:[]}).leaders.length,0);
});
test('disconnected transport performs no network calls',async()=>{
 let calls=0;const c=new Client({url:'',fetchFn:()=>{calls++;}});
 c.start();await c.refresh();c.stop();assert.equal(calls,0);assert.equal(c.state.status,'disconnected');
});
test('successful updates use server points; failures retain last snapshot with error status',async()=>{
 const value=snapshot();let fail=false;
 const c=new Client({url:'/api/leaderboard',fetchFn:async(url,options)=>{
   assert.equal(options.cache,'no-store');assert.equal(options.credentials,'same-origin');
   if(fail)throw new Error('offline');return {ok:true,json:async()=>value};
 }});
 await c.refresh();assert.equal(c.state.status,'current');
 value.leaders[0].points=50;await c.refresh();assert.equal(c.state.snapshot.leaders[0].points,50);
 fail=true;await c.refresh();assert.equal(c.state.status,'error');assert.equal(c.state.snapshot.leaders[0].points,50);c.stop();
});
test('SSE invalidation refreshes ranking and disconnect falls back to polling',async()=>{
 let stream,calls=0;
 class MockStream{constructor(){stream=this;}close(){this.closed=true;}}
 const c=new Client({url:'/api/leaderboard',eventsUrl:'/api/events',EventSourceClass:MockStream,fetchFn:async()=>{calls++;return {ok:true,json:async()=>snapshot()};}});
 c.start();await new Promise(resolve=>setImmediate(resolve));
 stream.onopen();assert.equal(c.state.streamConnected,true);
 stream.onmessage();await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,2);
 stream.onerror();assert.equal(c.state.streamConnected,false);assert.ok(c.timer);
 c.stop();assert.equal(stream.closed,true);assert.equal(c.timer,null);
});
test('overlapping refreshes are suppressed and stopped requests cannot repaint',async()=>{
 let finish,calls=0;const c=new Client({url:'/api/leaderboard',fetchFn:()=>{calls++;return new Promise(resolve=>finish=resolve);}});
 const pending=c.refresh();await c.refresh();assert.equal(calls,1);c.stop();
 finish({ok:true,json:async()=>snapshot()});await pending;assert.equal(c.state.snapshot,null);
});
