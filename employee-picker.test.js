const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mount}=require('./employee-picker.js');
function element(){return{value:'',textContent:'',hidden:false,dataset:{},children:[],listeners:{},attrs:{},
  append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},
  setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.listeners[k]=fn;},
  querySelectorAll(){return this.children.flatMap(item=>item.children);}};}
function harness(api){const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
 const picker=mount({document:{getElementById:get,createElement:element},api});
 return{get,picker,search(){get('employee-query').listeners.keydown({key:'Enter',preventDefault(){}});}};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const row=id=>({USER_ID:id,USER_NM:'동명이인',DEPT_NM:'가상 '+id,USER_EMAIL:id+'@example.invalid'});
const response=(data,page=1,hasMore=false)=>({data,total:2,page,hasMore});

test('late responses cannot overwrite latest results; selection uses distinct USER_ID and clears on edits',async()=>{
 const pending=[];const h=harness({employees:()=>new Promise(resolve=>pending.push(resolve))});
 h.get('employee-query').value='first';h.search();h.get('employee-query').value='second';h.search();
 pending[1](response([row('second'),row('other')]));await tick();
 pending[0](response([row('first')]));await tick();
 const buttons=h.get('employee-results').querySelectorAll();assert.equal(buttons.length,2);
 buttons[1].listeners.click();assert.equal(h.picker.getSelected().USER_ID,'other');
 assert.equal(buttons[1].attrs['aria-pressed'],'true');
 h.get('employee-query').listeners.input();assert.equal(h.picker.getSelected(),null);assert.equal(h.get('employee-results').children.length,0);
 h.picker.reset();
});

test('pagination retains rows, failures are visible, and reset prevents requests repainting closed dialog',async()=>{
 let resolve;const calls=[];let fail=false;
 const h=harness({employees:async(q,opts)=>{calls.push(opts);if(fail)throw Object.assign(new Error(),{code:'AUTH_NOT_CONFIGURED'});return response([row(String(opts.page))],opts.page,opts.page===1);}});
 h.get('employee-query').value='test';h.search();await tick();assert.equal(h.get('employee-more').hidden,false);
 h.get('employee-more').listeners.click();await tick();assert.equal(h.get('employee-results').children.length,2);assert.equal(calls[1].page,2);
 fail=true;h.search();await tick();assert.match(h.get('employee-status').textContent,/로그인/);assert.equal(h.get('employee-retry').hidden,false);
 const delayed=harness({employees:()=>new Promise(r=>resolve=r)});delayed.get('employee-query').value='test';delayed.search();delayed.picker.reset();resolve(response([row('late')]));await tick();assert.equal(delayed.get('employee-results').children.length,0);
});

test('names and department text are rendered as text, never HTML',async()=>{
 const h=harness({employees:async()=>response([{...row('x'),USER_NM:'<img src=x onerror=alert(1)>'}])});
 h.get('employee-query').value='test';h.search();await tick();
 const name=h.get('employee-results').children[0].children[0].children[0];assert.equal(name.textContent,'<img src=x onerror=alert(1)>');assert.equal(name.innerHTML,undefined);
});
