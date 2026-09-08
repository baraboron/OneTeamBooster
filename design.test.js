const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'styles.css'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'ui.js'),'utf8');

test('HTML IDs are unique and local resources exist',()=>{
 const stack=[],voidTags=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
 for(const match of html.matchAll(/<!--[\s\S]*?-->|<\/?([a-z][\w:-]*)\b[^>]*>/gi)){
   if(!match[1])continue;
   const name=match[1].toLowerCase();
   if(match[0].startsWith('</'))assert.equal(stack.pop(),name,'HTML nesting: '+name);
   else if(!voidTags.has(name)&&!match[0].endsWith('/>'))stack.push(name);
 }
 assert.deepEqual(stack,[]);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length);
 for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
   const url=match[1];
   if(url.startsWith('#')||/^https?:/.test(url))continue;
   assert.ok(fs.existsSync(path.join(__dirname,url)),url);
 }
 for(const id of ['home','received','sent','insight','modal','report-modal','main-content','demo-role','recent-list','point-total','praise-briefing','score-strip']){
   assert.ok(ids.includes(id),id);
 }
});

test('application static ID selectors retain their HTML targets',()=>{
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 for(const match of app.matchAll(/\$\('#([\w-]+)'\)/g)){
   assert.ok(ids.has(match[1]),match[1]);
 }
 assert.ok(html.includes('id="recipient"'),'recipient');
 for(const name of ['partner','mission','boost','impact']){
   assert.ok(html.includes('data-name="'+name+'"'),name);
 }
});

const token=name=>{
 const match=css.match(new RegExp('--'+name+':(#[a-fA-F0-9]{3,6})'));
 assert.ok(match,name);
 let hex=match[1].slice(1); if(hex.length===3)hex=hex.split('').map(c=>c+c).join('');
 return hex.match(/../g).map(h=>parseInt(h,16)/255);
};
const luminance=rgb=>rgb.map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0);
test('shared text color pairs meet 4.5:1 contrast target',()=>{
 for(const [fg,bg] of [['ink','surface'],['muted','surface'],['muted','canvas'],['blue','sky'],['orange','warm'],['green','success-bg'],['surface','navy'],['violet','violet-bg'],['teal','teal-bg'],['amber','amber-bg'],['surface','violet'],['surface','teal'],['surface','orange']]){
   const values=[luminance(token(fg)),luminance(token(bg))].sort((a,b)=>b-a);
   const ratio=(values[0]+.05)/(values[1]+.05);
   assert.ok(ratio>=4.5,fg+'/'+bg+' = '+ratio.toFixed(2));
 }
});

test('readable type scale, unified brand and reduced-motion rules',()=>{
 assert.equal([...css.matchAll(/--navy:/g)].length,1);
 assert.doesNotMatch(css,/rotate\(|skew\(|perspective\(/);
 assert.doesNotMatch(css,/object-fit:\s*cover/);
 for(const [,number,unit] of css.matchAll(/font-size:\s*([\d.]+)(px|rem)/g)){
   assert.ok(Number(number)*(unit==='rem'?16:1)>=12,'font-size '+number+unit);
 }
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/focus-visible/);
 assert.match(css,/\.sidebar nav \{grid-column:1\/-1;display:flex/);
 assert.doesNotMatch(css,/\.sidebar\s*\{[^}]*display:none/);
});

test('dialog and navigation accessibility wiring remains present',()=>{
 assert.match(html,/class="skip-link" href="#main-content"/);
 assert.match(html,/id="message-text" aria-label=/);
 assert.match(ui,/shell\.inert = Boolean\(next\)/);
 assert.match(ui,/event\.key === 'Escape'/);
 assert.match(ui,/event\.key === 'Tab'/);
 assert.match(ui,/returnFocus\.focus\(\)/);
 assert.match(ui,/aria-current/);
 assert.match(app,/aria-pressed/);
});

test('design governance and truthful prototype labels remain linked',()=>{
 const agents=fs.readFileSync(path.join(__dirname,'AGENTS.md'),'utf8');
 assert.match(agents,/DESIGN_GUIDELINES\.md/);
 assert.match(agents,/design\.test\.js/);
 assert.match(html,/템플릿 기반 시연/);
 assert.match(html,/전사 포인트 TOP 10/);
 assert.match(html,/연결 대기/);
 assert.doesNotMatch(app,/(?<!\$)\$\('[^']+'\)\.forEach/);
 assert.match(html,/하루 최대 3회 발송 · 동일인에게는 월요일 기준 주 1회/);
});
