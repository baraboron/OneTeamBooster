const STORE='otb-prototype-v1';
const seed=[
 {id:1,from:'박지훈',team:'설비기술팀',mission:'성능 개선',boost:'책임감(R&R)',impact:'리스크 방지',message:'예상치 못한 이슈에서도 끝까지 원인을 확인해 주신 덕분에, 모두가 안심하고 다음 단계로 갈 수 있었습니다. 고맙습니다!',time:'오늘 오전 10:24',replied:false},
 {id:2,from:'이서연',team:'연구소',mission:'문서 작성',boost:'정보 공유',impact:'품질 향상',message:'복잡했던 자료를 한눈에 이해할 수 있게 정리해 주셔서 협업 속도가 훨씬 빨라졌어요. 정말 든든했습니다.',time:'어제 오후 4:10',replied:true},
 {id:3,from:'최민호',team:'영업팀',mission:'고객 대응',boost:'공동 목표 의식',impact:'팀워크 강화',message:'고객의 관점과 우리 팀의 목표를 함께 생각해 주신 덕분에 좋은 답을 찾을 수 있었습니다.',time:'9월 4일',replied:false}
];
let data=JSON.parse(localStorage.getItem(STORE)||'null')||{sent:4,points:95,boosters:seed};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function save(){localStorage.setItem(STORE,JSON.stringify(data))}
function initials(n){return n.slice(0,1)}
function render(){
 const received=data.boosters.length, unread=data.boosters.filter(x=>!x.replied).length;
 $('#inbox-count').textContent=unread;
 $('#point-total').textContent=data.points;
 $('#stats').innerHTML=`<div class="stat"><span>이번 달 보낸 부스터</span><b>${data.sent} <small>건</small></b><small>동료의 협업을 바로 인정했어요</small></div><div class="stat"><span>받은 부스터</span><b>${received} <small>건</small></b><small>당신의 기여가 동료에게 닿았어요</small></div><div class="stat"><span>현재 포인트</span><b>${data.points} <small>P</small></b><small>이번 주 +25P 획득</small></div>`;
 const row=x=>`<div class="booster-row"><span class="avatar">${initials(x.from)}</span><div class="copy"><b>${x.from} <span class="tag">${x.boost}</span></b><p>${x.message.slice(0,42)}${x.message.length>42?'…':''}</p></div><time>${x.time}</time></div>`;
 $('#recent-list').innerHTML=data.boosters.slice(0,3).map(row).join('');
 $('#inbox-list').innerHTML=data.boosters.map(x=>`<article class="inbox-card"><div class="top"><span class="avatar">${initials(x.from)}</span><div><b>${x.from}</b><small>${x.team} · ${x.time}</small></div><span class="tag">${x.impact}</span></div><p class="message">${x.message}</p>${x.replied?'<span class="replied">✓ 감사 답장을 보냈어요</span>':`<button class="reply" data-reply="${x.id}">감사 답장 보내기 · 발신자 +5P</button>`}</article>`).join('');
 const counts={};data.boosters.forEach(x=>counts[x.boost]=(counts[x.boost]||0)+1);const max=Math.max(...Object.values(counts));
 $('#strength-list').innerHTML=Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="strength"><div><b>${k}</b><span>${v}회</span></div><i style="--score:${Math.round(v/max*100)}%"></i></div>`).join('')||'<p>받은 부스터가 쌓이면 협업 강점이 나타납니다.</p>';
}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2700)}
function openComposer(){ $('#modal').classList.add('open'); $('#booster-form').classList.remove('hidden'); $('#message-preview').classList.add('hidden'); $('#recipient').focus() }
function closeComposer(){ $('#modal').classList.remove('open') }
$$('.nav-link').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
$$('[data-view-target]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.viewTarget)));
function showView(v){$$('.view').forEach(x=>x.classList.toggle('active',x.id===v));$$('.nav-link').forEach(x=>x.classList.toggle('active',x.dataset.view===v));const titles={home:'좋은 협업은 바로 인정할 때 더 커집니다.',inbox:'동료의 마음이 도착했어요.',impact:'함께 만든 변화가 당신의 이야기입니다.',insight:'협업의 연결을 더 건강하게 만듭니다.'};$('#page-title').textContent=titles[v];$('#eyebrow').textContent=v==='insight'?'LEADER VIEW · DEMO':'ONE TEAM, EVERY DAY';window.scrollTo({top:0,behavior:'smooth'})}
$('#open-composer').onclick=openComposer;$('#open-composer-hero').onclick=openComposer;$('#close-composer').onclick=closeComposer;$('#modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeComposer()});
$$('.choice-group').forEach(g=>g.addEventListener('click',e=>{if(e.target.tagName==='BUTTON'){[...g.children].forEach(x=>x.classList.remove('selected'));e.target.classList.add('selected')}}));
$('#booster-form').addEventListener('submit',e=>{e.preventDefault();const name=$('#recipient').value.trim();const mission=$('[data-name="mission"] .selected').textContent;const boost=$('#boost').value, impact=$('#impact-select').value;const templates={"적극적 경청":`${name}님, 서로 다른 의견을 끝까지 들어 주신 덕분에 ${mission} 과정에서 더 좋은 답을 찾을 수 있었습니다. ${impact}이라는 변화를 함께 만들어 주셔서 고맙습니다!`,"책임감(R&R)":`${name}님, ${mission}에서 맡은 역할을 끝까지 책임져 주신 덕분에 ${impact}을 이룰 수 있었습니다. 든든한 OneTeam Partner가 되어 주셔서 감사합니다!`};$('#message-text').value=templates[boost]||`${name}님, ${mission} 과정에서 보여 주신 ${boost} 덕분에 ${impact}이라는 좋은 변화를 만들 수 있었습니다. 함께해 주셔서 진심으로 감사합니다!`;$('#booster-form').classList.add('hidden');$('#message-preview').classList.remove('hidden')});
$('#back-to-form').onclick=()=>{$('#booster-form').classList.remove('hidden');$('#message-preview').classList.add('hidden')};
$('#send-booster').onclick=()=>{data.sent++;data.points+=10;save();render();closeComposer();$('#booster-form').reset();toast('부스터를 전송했어요. 당신에게 +10P가 쌓였습니다!')};
$('#inbox-list').addEventListener('click',e=>{const id=Number(e.target.dataset.reply);if(!id)return;const x=data.boosters.find(x=>x.id===id);if(x&&!x.replied){x.replied=true;data.points+=20;save();render();toast(`${x.from}님에게 감사 답장을 보냈어요. 당신에게 +20P!`)}});
render();
