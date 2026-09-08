const STORE='otb-prototype-v2';
const DAILY_BOOST_LIMIT=3;
const receivedSeed=[
 {id:'r1',from:'박지훈',team:'설비기술팀',partner:'동료',mission:'성능 개선',boost:'책임감(R&R)',impact:'리스크 방지',message:'예상치 못한 이슈에서도 끝까지 원인을 확인해 주신 덕분에, 모두가 안심하고 다음 단계로 갈 수 있었습니다. 고맙습니다!',time:'오늘 오전 10:24',replied:false},
 {id:'r2',from:'이서연',team:'연구소',partner:'프로젝트 참여원 / 팀 전체',mission:'문서 작성',boost:'정보 공유',impact:'품질 향상',message:'복잡했던 자료를 한눈에 이해할 수 있게 정리해 주셔서 협업 속도가 훨씬 빨라졌어요. 정말 든든했습니다.',time:'어제 오후 4:10',replied:true},
 {id:'r3',from:'최민호',team:'영업팀',partner:'동료',mission:'고객 대응',boost:'공동 목표 의식',impact:'팀워크 강화',message:'고객의 관점과 우리 팀의 목표를 함께 생각해 주신 덕분에 좋은 답을 찾을 수 있었습니다.',time:'9월 4일',replied:false}
];
const sentSeed=[
 {id:'s1',recipient:'정하늘',partner:'동료',mission:'문서 작성',boost:'정보 공유',impact:'품질 향상',message:'정하늘님, 동료로서 함께한 문서 작성에서 보여 주신 정보 공유 덕분에 품질 향상이라는 변화를 만들었습니다. 필요한 내용을 먼저 연결해 주셔서 모두가 같은 방향으로 움직일 수 있었습니다. 고맙습니다!',time:'9월 5일',sentAt:Date.now()-172800000},
 {id:'s2',recipient:'오성민',partner:'동료',mission:'평가 및 분석',boost:'적극적 경청',impact:'시야 확장',message:'오성민님, 함께한 평가 및 분석에서 보여 주신 적극적 경청 덕분에 시야를 넓힐 수 있었습니다. 다른 관점을 끝까지 들어 주셔서 더 나은 판단을 할 수 있었습니다. 감사합니다!',time:'9월 3일',sentAt:Date.now()-345600000}
];
let data=JSON.parse(localStorage.getItem(STORE)||'null')||{points:95,received:receivedSeed,sentBoosters:sentSeed};
if(!data.received)data={points:data.points||95,received:data.boosters||receivedSeed,sentBoosters:sentSeed};
const $=selector=>document.querySelector(selector),$$=selector=>[...document.querySelectorAll(selector)];
const selectionList=name=>[...document.querySelectorAll(`[data-name="${name}"] .selected`)].sort((a,b)=>(Number(a.dataset.rank)||0)-(Number(b.dataset.rank)||0)).map(button=>button.dataset.value||button.textContent.trim());
const selected=name=>selectionList(name)[0]||'';
const initials=name=>name.slice(0,1);
const escapeHtml=value=>String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
function save(){localStorage.setItem(STORE,JSON.stringify(data));}
function localDayStart(date=Date.now()){const start=new Date(date);start.setHours(0,0,0,0);return start.getTime();}
function mondayStart(date=Date.now()){const start=new Date(date);start.setHours(0,0,0,0);start.setDate(start.getDate()-(start.getDay()+6)%7);return start.getTime();}
function sentSince(start){return data.sentBoosters.filter(item=>!item.isDemo&&Number.isFinite(item.sentAt)&&item.sentAt>=start);}
function remainingDailyBoosters(){return Math.max(0,DAILY_BOOST_LIMIT-sentSince(localDayStart()).length);}
function isRecipientWeeklyLimited(recipient){const name=recipient.trim();return Boolean(name)&&sentSince(mondayStart()).some(item=>item.recipient===name);}
function sendLimitMessage(values){if(values.isDemo)return '';if(remainingDailyBoosters()===0)return '오늘은 부스터를 3회 모두 보냈어요. 내일 다시 보낼 수 있습니다.';if(isRecipientWeeklyLimited(values.recipient))return '같은 동료에게는 월요일 기준으로 주 1회만 부스터를 보낼 수 있습니다.';return '';}
function toast(message){const element=$('#toast');element.textContent=message;element.classList.add('show');setTimeout(()=>element.classList.remove('show'),2800);}
function countBy(list,key){return list.reduce((all,item)=>{all[item[key]]=(all[item[key]]||0)+1;return all;},{});}
function topOf(list,key,fallback='아직 기록 없음'){return Object.entries(countBy(list,key)).sort((a,b)=>b[1]-a[1])[0]?.[0]||fallback;}
function formatSelections(item){return `<div class="meta-tags"><span>${escapeHtml(item.partner)}</span><span>${escapeHtml(item.mission)}</span><span>${escapeHtml(item.boost)}</span><span>${escapeHtml(item.impact)}</span></div>`;}
function summaryCards(items){return items.map(([value,label])=>`<article class="summary-card"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></article>`).join('');}
function receivedCard(item){return `<article class="booster-card"><div class="card-top"><span class="avatar">${initials(item.from)}</span><div><b>${escapeHtml(item.from)}</b><small>${escapeHtml(item.team)} · ${escapeHtml(item.time)}</small></div><span class="state received-state">${item.isDemo?'시연 받음':'받음'}</span></div>${formatSelections(item)}<p class="message">${escapeHtml(item.message)}</p><div class="card-bottom">${item.replied?`<div><span class="replied">✓ 감사 답장을 보냈어요${item.replyPointsAwarded?' · 내 포인트 +5P':''}</span>${item.replyText?`<small class="reply-text">${escapeHtml(item.replyText)}</small>`:''}</div>`:`<button class="reply" data-reply="${item.id}">감사 답장 고르기 · 내 포인트 +5P</button>`}<button class="text-button report-from-card">분석 보기</button></div></article>`;}
function sentCard(item){const reply=item.recipientReply?`<div class="recipient-reply"><b>받은 감사 답장</b><p>${escapeHtml(item.recipientReply)}</p>${item.recipientReplyAt?`<small>${escapeHtml(item.recipientReplyAt)}</small>`:''}</div>`:'<p class="recipient-reply-empty">감사 답장이 아직 오지 않았습니다.</p>';return `<article class="booster-card"><div class="card-top"><span class="avatar sent-avatar">${initials(item.recipient)}</span><div><b>${escapeHtml(item.recipient)}</b><small>${escapeHtml(item.time)}</small></div><span class="state sent-state">${item.isDemo?'시연 보냄':'보냄'}</span></div>${formatSelections(item)}<p class="message">${escapeHtml(item.message)}</p>${reply}<div class="card-bottom"><button class="secondary reuse" data-reuse="${item.id}">이 내용 재사용</button></div></article>`;}
function pieChartMarkup(label,key,received,colors){
 const entries=Object.entries(countBy(received,key)).sort((a,b)=>b[1]-a[1]),total=received.length;
 let offset=0;
 const slices=entries.map(([name,count],index)=>{const start=offset,end=offset+count/total*100;color=colors[index%colors.length];offset=end;return `${color} ${start}% ${end}%`;}).join(',');
 const detail=entries.map(([name,count])=>`${name} ${count}건`).join(', ');
 return `<section class="praise-chart"><h4>${label}</h4><div class="pie-chart" style="--pie-slices:${slices}" role="img" aria-label="${escapeHtml(label)}: ${escapeHtml(detail)}"><span>${total}<small>건</small></span></div><ul>${entries.map(([name,count],index)=>`<li><i style="--legend-color:${colors[index%colors.length]}"></i><span>${escapeHtml(name)}</span><b>${count}건</b></li>`).join('')}</ul></section>`;
}
function briefingMarkup(received){
 if(!received.length)return '<p class="helper">아직 받은 칭찬이 없어요. 칭찬이 도착하면 항목별 통계를 보여드릴게요.</p>';
 const colors=['#294f9b','#a95022','#17696d','#6b46aa','#996013','#23734f','#5f6f83'];
 return `<div class="praise-charts">${pieChartMarkup('미션 레코드','mission',received,colors)}${pieChartMarkup('부스트포인트','boost',received,colors)}${pieChartMarkup('원팀 임팩트','impact',received,colors)}</div>`;
}
function renderReport(){const received=data.received,sent=data.sentBoosters,strength=Object.entries(countBy(received,'boost')).sort((a,b)=>b[1]-a[1]);$('#report-content').innerHTML=`<div class="report-score"><div><small>현재 점수</small><b>${data.points}P</b></div><div><small>받은 칭찬</small><b>${received.length}건</b></div><div><small>보낸 칭찬</small><b>${sent.length}건</b></div></div><section><h3>동료가 칭찬한 항목</h3>${strength.map(([name,count])=>`<div class="report-bar"><span>${escapeHtml(name)}</span><i><b style="width:${Math.round(count/Math.max(1,received.length)*100)}%"></b></i><em>${count}회</em></div>`).join('')}</section><section><h3>주고받은 칭찬</h3><p>지금까지 칭찬 ${received.length}건을 받고, ${sent.length}건을 보냈어요. 위 항목은 동료가 칭찬을 보낼 때 선택한 내용이에요.</p></section>`;}
function render(){
 const totalPoints=data.points;
 const received=data.received,sent=data.sentBoosters,unreplied=received.filter(item=>!item.replied).length,replyRewards=received.filter(item=>item.replyPointsAwarded).length;
 const remaining=remainingDailyBoosters();
 $('#inbox-count').textContent=unreplied;$('#point-total').textContent=totalPoints;$('#send-limit').textContent=`오늘 ${remaining}회 남음`;$('#open-composer').disabled=remaining===0;
 $('#point-breakdown').innerHTML=[['받은 부스터',`${received.length}건 · 20P/건`],['보낸 부스터',`${sent.length}건 · 10P/건`],['감사 답장',`${replyRewards}건 · +${replyRewards*5}P`]].map(([label,value])=>`<div><span>${label}</span><b>${value}</b></div>`).join('');
 $('#score-strip').innerHTML=`<div><small>받은 칭찬</small><b>${received.length}<em>건</em></b></div><div><small>전한 칭찬</small><b>${sent.length}<em>건</em></b></div><div><small>답장을 기다리는 칭찬</small><b>${unreplied}<em>건</em></b></div><div><small>답장 완료</small><b>${replyRewards}<em>건</em></b></div>`;

 $('#praise-briefing').innerHTML=briefingMarkup(received);
 const activity=[...received.map(item=>({...item,type:'받은'})),...sent.map(item=>({...item,from:item.recipient,type:'보낸'}))].slice(0,4);
 $('#recent-list').innerHTML=activity.map(item=>`<article class="activity-row"><span class="avatar">${initials(item.from)}</span><div><small>${item.type} 부스터 · ${escapeHtml(item.mission)}</small><b>${escapeHtml(item.from)}님${item.type==='받은'?'이 보낸 칭찬':'에게 보낸 칭찬'}</b><p>${escapeHtml(item.message)}</p></div><time>${escapeHtml(item.time)}</time></article>`).join('');
 $('#received-summary').innerHTML=summaryCards([[`${received.length}건`,'받은 부스터 · 전체'],[topOf(received,'mission'),'미션 레코드 · 가장 많이 받은 항목'],[topOf(received,'boost'),'부스트포인트 · 가장 많이 받은 항목'],[topOf(received,'impact'),'원팀 임팩트 · 가장 많이 받은 항목']]);
 $('#sent-summary').innerHTML=summaryCards([[`${sent.length}건`,'보낸 부스터 · 전체'],[topOf(sent,'mission'),'미션 레코드 · 가장 많이 선택한 항목'],[topOf(sent,'boost'),'부스트포인트 · 가장 많이 선택한 항목'],[topOf(sent,'impact'),'원팀 임팩트 · 가장 많이 선택한 항목']]);
 $('#received-list').innerHTML=received.map(receivedCard).join('');$('#sent-list').innerHTML=sent.length?sent.map(sentCard).join(''):'<p class="empty">보낸 부스터가 없습니다. 첫 칭찬을 전해보세요.</p>';
 renderReport();LeaderWorkspace.sync(data);HomeWorkspace.sync(data);
}
function showView(view){if(view==='insight'&&!LeaderWorkspace.isLeader()){toast('리더 전용 페이지입니다.');return;}$$('.view').forEach(element=>element.classList.toggle('active',element.id===view));$$('.nav-link').forEach(element=>element.classList.toggle('active',element.dataset.view===view));const title={home:'OneTeam(협업)에 대한 인정과 격려를 보냅니다',received:'나에게 온 칭찬',sent:'내가 보낸 칭찬',insight:'우리 그룹의 칭찬 현황'};$('#page-title').textContent=title[view];$('#eyebrow').textContent=view==='insight'?'LEADER VIEW · DEMO':'ONE TEAM BOOSTER';window.scrollTo({top:0,behavior:'smooth'});}
function updateSelectionCounter(group){group.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.classList.contains('selected'))));const name=group.dataset.name,count=group.querySelectorAll('.selected').length,counter=document.querySelector(`[data-counter="${name}"]`);if(!counter)return;if(group.dataset.mode==='multiple')counter.textContent=`${count} / 3`;if(group.dataset.mode==='rank')counter.textContent=count?`${count===1?'1순위':`${count}개 선택`}`:'선택하세요';}
function normalizeRanks(group){[...group.querySelectorAll('.selected')].sort((a,b)=>(Number(a.dataset.rank)||0)-(Number(b.dataset.rank)||0)).forEach((button,index)=>button.dataset.rank=String(index+1));}
function selectChoice(name,value){const group=$(`[data-name="${name}"]`);if(!group)return;[...group.children].forEach(button=>{const match=(button.dataset.value||button.textContent.trim())===value;button.classList.toggle('selected',match);if(group.dataset.mode==='rank')match?button.dataset.rank='1':delete button.dataset.rank;});normalizeRanks(group);updateSelectionCounter(group);}
function openComposer(reuse,isDemo=false){if(!isDemo&&remainingDailyBoosters()===0){toast('오늘은 부스터를 3회 모두 보냈어요. 내일 다시 보낼 수 있습니다.');return;}$('#modal').classList.add('open');$('#booster-form').classList.remove('hidden');$('#message-preview').classList.add('hidden');$('#booster-form').dataset.demo=String(isDemo);if(reuse){$('#project-name').value=reuse.projectName||'';$('#recipient').value=reuse.recipient;['partner','mission','boost','impact'].forEach(name=>selectChoice(name,reuse[name]));}else if(isDemo){$('#recipient').value=`시연 동료 ${data.sentBoosters.filter(item=>item.isDemo).length+1}`;}$('#project-name').focus();}
function closeModal(id){$(`#${id}`).classList.remove('open');}
function draftMessage(values){return PraiseCopy.draft(values);}
$$('.nav-link').forEach(button=>button.addEventListener('click',()=>showView(button.dataset.view)));$$('[data-view-target]').forEach(button=>button.addEventListener('click',()=>showView(button.dataset.viewTarget)));
$('#open-composer').onclick=()=>openComposer();$('#open-demo-composer').onclick=()=>openComposer(null,true);$('#add-demo-received').onclick=()=>{data.received.unshift({id:`demo-r${Date.now()}`,from:'시연 동료',team:'시연 그룹',partner:'동료',mission:'문서 작성',boost:'정보 공유',impact:'팀워크 강화',message:'[시연] 함께 정리해 주신 덕분에 다음 업무를 빠르게 이어갈 수 있었습니다. 고맙습니다!',time:'방금 전',replied:false,isDemo:true});save();render();showView('received');toast('시연용 받은 부스터를 추가했어요. 감사 답장을 골라 보내보세요.');};$('#close-composer').onclick=()=>closeModal('modal');$('#modal').addEventListener('click',event=>{if(event.target===event.currentTarget)closeModal('modal');});
$$('[data-close]').forEach(button=>button.addEventListener('click',()=>closeModal(button.dataset.close)));['report-modal','leader-modal','reply-modal'].forEach(id=>$(`#${id}`).addEventListener('click',event=>{if(event.target===event.currentTarget)closeModal(event.currentTarget.id);}));
$$('.choice-group').forEach(group=>group.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;const mode=group.dataset.mode||'single',selectedButtons=[...group.querySelectorAll('.selected')];if(mode==='single'){[...group.children].forEach(item=>item.classList.toggle('selected',item===button));}else if(mode==='multiple'){if(button.classList.contains('selected'))button.classList.remove('selected');else if(selectedButtons.length<3)button.classList.add('selected');else{toast('Mission Record는 최대 3개까지 선택할 수 있습니다.');return;}}else if(mode==='rank'){if(button.classList.contains('selected')){button.classList.remove('selected');delete button.dataset.rank;}else if(selectedButtons.length<3){button.classList.add('selected');button.dataset.rank=String(selectedButtons.length+1);}else{toast('핵심 항목은 최대 3개까지 순위를 정할 수 있습니다.');return;}normalizeRanks(group);}updateSelectionCounter(group);}));
$('#booster-form').addEventListener('submit',event=>{event.preventDefault();const missions=selectionList('mission'),boosts=selectionList('boost'),impacts=selectionList('impact');if(!missions.length||!boosts.length||!impacts.length){toast('Mission, Boost Point, Impact를 각각 선택해 주세요.');return;}const values={projectName:$('#project-name').value.trim(),recipient:$('#recipient').value.trim(),partner:selected('partner'),mission:missions.join(' · '),boost:boosts[0],impact:impacts[0],isDemo:$('#booster-form').dataset.demo==='true'};if(!values.projectName){toast('프로젝트 또는 업무명을 입력해 주세요.');$('#project-name').focus();return;}if(!values.recipient){toast('부스터를 받을 동료 이름을 입력해 주세요.');return;}const limitMessage=sendLimitMessage(values);if(limitMessage){toast(limitMessage);return;}$('#message-text').value=draftMessage(values);$('#message-preview').dataset.values=JSON.stringify(values);$('#booster-form').classList.add('hidden');$('#message-preview').classList.remove('hidden');});
$('#back-to-form').onclick=()=>{$('#booster-form').classList.remove('hidden');$('#message-preview').classList.add('hidden');};
$('#send-booster').onclick=()=>{const values=JSON.parse($('#message-preview').dataset.values),limitMessage=sendLimitMessage(values);if(!values.projectName){toast('프로젝트 또는 업무명을 입력해 주세요.');return;}if(limitMessage){toast(limitMessage);return;}data.sentBoosters.unshift({id:`s${Date.now()}`,...values,message:$('#message-text').value,time:'방금 전',sentAt:Date.now()});data.points+=10;save();render();closeModal('modal');$('#booster-form').reset();selectChoice('partner','동료');selectChoice('mission','문서 작성');selectChoice('boost','정보 공유');selectChoice('impact','품질 향상');toast('칭찬을 보냈어요. 내 포인트에 10P를 더했어요.');};
$('#received-list').addEventListener('click',event=>{const id=event.target.dataset.reply;if(id){const item=data.received.find(value=>value.id===id);if(item&&!item.replied){$('#reply-booster-id').value=id;$('#reply-template').value='따뜻한 칭찬 덕분에 힘이 났어요. 함께해 주셔서 고맙습니다.';$('#reply-modal').classList.add('open');}}if(event.target.classList.contains('report-from-card'))$('#report-modal').classList.add('open');});
$('#reply-form').addEventListener('submit',event=>{event.preventDefault();const item=data.received.find(value=>value.id===$('#reply-booster-id').value);if(!item||item.replied){closeModal('reply-modal');return;}item.replied=true;item.replyText=$('#reply-template').value;item.replyPointsAwarded=true;data.points+=5;save();render();closeModal('reply-modal');toast(`${item.from}님에게 감사 답장을 보냈어요. 내 포인트에 +5P가 반영됩니다.`);});
$('#sent-list').addEventListener('click',event=>{const item=data.sentBoosters.find(value=>value.id===event.target.dataset.reuse);if(item)openComposer(item);});
['open-report','open-report-inline'].forEach(id=>$(`#${id}`).onclick=()=>$('#report-modal').classList.add('open'));
HomeWorkspace.init({compose:openComposer,navigate:showView});
LeaderWorkspace.init(data);
window.addEventListener('storage',event=>{
 if(event.key!==STORE||!event.newValue)return;
 try{
   const incoming=JSON.parse(event.newValue);
   if(!Array.isArray(incoming.received)||!Array.isArray(incoming.sentBoosters)||!Number.isSafeInteger(incoming.points)||incoming.points<0)throw new Error();
   data=incoming;render();
 }catch{toast('다른 탭의 칭찬 기록을 확인할 수 없습니다.');}
});
$$('.choice-group').forEach(updateSelectionCounter);render();
