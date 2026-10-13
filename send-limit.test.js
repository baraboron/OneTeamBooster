const {test}=require('node:test');
const assert=require('node:assert/strict');
const {resetTimes,countdown,init}=require('./send-limit.js');

test('reset countdown follows Korean midnight and next Monday across week and year boundaries',()=>{
 for(const [now,daily,weekly] of [
  ['2026-10-13T12:00:00+09:00','2026-10-14T00:00:00+09:00','2026-10-19T00:00:00+09:00'],
  ['2026-10-18T23:59:59+09:00','2026-10-19T00:00:00+09:00','2026-10-19T00:00:00+09:00'],
  ['2026-10-19T00:00:00+09:00','2026-10-20T00:00:00+09:00','2026-10-26T00:00:00+09:00'],
  ['2026-12-31T23:59:59+09:00','2027-01-01T00:00:00+09:00','2027-01-04T00:00:00+09:00']
 ])assert.deepEqual(resetTimes(Date.parse(now)),{daily:Date.parse(daily),weekly:Date.parse(weekly)});
 assert.equal(countdown(1000,0),'00:00:01');assert.equal(countdown(90061000,0),'1일 01:01:01');assert.equal(countdown(0,1000),'00:00:00');
});

test('rules open on hover, focus and tap and close with Escape or outside click',t=>{
 const nodes=new Map();
 function node(id){if(!nodes.has(id))nodes.set(id,{hidden:true,events:{},attrs:{},addEventListener(type,fn){this.events[type]=fn;},setAttribute(key,value){this.attrs[key]=value;},contains(target){return [...nodes.values()].includes(target);}});return nodes.get(id);}
 const doc={getElementById:node,events:{},addEventListener(type,fn){this.events[type]=fn;}};
 t.after(init(doc));const wrap=node('send-limit-wrap'),button=node('send-limit'),tip=node('send-limit-rules');
 wrap.events.mouseenter();assert.equal(tip.hidden,false);assert.match(node('daily-reset-countdown').textContent,/\d\d:\d\d:\d\d/);
 wrap.events.mouseleave();assert.equal(tip.hidden,true);
 button.events.focus();assert.equal(button.attrs['aria-expanded'],'true');
 doc.events.keydown({key:'Escape'});assert.equal(tip.hidden,true);
 button.events.blur();button.events.click();assert.equal(tip.hidden,false);
 doc.events.click({target:{}});assert.equal(tip.hidden,true);
});
