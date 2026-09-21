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
const initials=name=>escapeHtml(name.slice(0,1));
const escapeHtml=value=>String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
function save(){if(!remoteWorkspace?.getState().enabled)localStorage.setItem(STORE,JSON.stringify(data));}
function localDayStart(date=Date.now()){const start=new Date(date);start.setHours(0,0,0,0);return start.getTime();}
function mondayStart(date=Date.now()){const start=new Date(date);start.setHours(0,0,0,0);start.setDate(start.getDate()-(start.getDay()+6)%7);return start.getTime();}
function sentSince(start){return data.sentBoosters.filter(item=>!item.isDemo&&Number.isFinite(item.sentAt)&&item.sentAt>=start);}
function remainingDailyBoosters(){if(remoteWorkspace?.getState().enabled)return data.remainingToday??3;return Math.max(0,DAILY_BOOST_LIMIT-sentSince(localDayStart()).length);}
function isRecipientWeeklyLimited(recipient){const name=recipient.trim();return Boolean(name)&&sentSince(mondayStart()).some(item=>item.recipient===name);}
function sendLimitMessage(values){if(remoteWorkspace?.getState().enabled){if(!remoteWorkspace.getState().ready)return '테스트 사용자를 선택하고 서버 연결을 확인해 주세요.';if((data.weeklyRecipientIds||[]).includes(values.recipientId))return '같은 동료에게는 월요일 기준 주 1회만 보낼 수 있습니다.';if(remainingDailyBoosters()===0)return '오늘은 부스터를 3회 모두 보냈어요.';return '';}if(values.isDemo||values.directoryDraft)return '';if(remainingDailyBoosters()===0)return '오늘은 부스터를 3회 모두 보냈어요. 내일 다시 보낼 수 있습니다.';if(isRecipientWeeklyLimited(values.recipient))return '같은 동료에게는 월요일 기준으로 주 1회만 부스터를 보낼 수 있습니다.';return '';}
function toast(message){const element=$('#toast');element.textContent=message;element.classList.add('show');setTimeout(()=>element.classList.remove('show'),2800);}
function storedSelections(item,key){const plural={mission:'missions',boost:'boosts',impact:'impacts'}[key];const values=Array.isArray(item[plural])?item[plural]:(key==='mission'?String(item[key]||'').split(' · '):[item[key]]);return values.filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim());}
function countBy(list,key){return list.reduce((all,item)=>{for(const value of new Set(storedSelections(item,key)))all[value]=(all[value]||0)+1;return all;},Object.create(null));}
function topOf(list,key,fallback='아직 기록 없음'){return Object.entries(countBy(list,key)).sort((a,b)=>b[1]-a[1])[0]?.[0]||fallback;}
function scopeLabel(value){return {'같은팀':'같은 팀/그룹','타팀':'타 팀/그룹'}[value]||'';}
function formatSelections(item){return `<div class="meta-tags"><span>${escapeHtml(item.partner)}</span>${scopeLabel(item.recipientScope)?`<span>${scopeLabel(item.recipientScope)}</span>`:''}<span>${escapeHtml(storedSelections(item,'mission').join(' · '))}</span><span>${escapeHtml(storedSelections(item,'boost').join(' → '))}</span><span>${escapeHtml(storedSelections(item,'impact').join(' → '))}</span></div>`;}
function summaryCards(items){return items.map(([value,label])=>`<article class="summary-card"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></article>`).join('');}
function receivedCard(item){return `<article class="booster-card"><div class="card-top"><span class="avatar">${initials(item.from)}</span><div><b>${escapeHtml(item.from)}</b><small>${escapeHtml(item.team||'소속 정보 없음')} · ${escapeHtml(item.time)}</small></div><span class="state received-state">${item.isDemo?'시연 받음':'받음'}</span></div>${formatSelections(item)}<p class="message">${escapeHtml(item.message)}</p><div class="card-bottom">${item.replied?`<div><span class="replied">✓ 감사 답장을 보냈어요${item.replyPointsAwarded?' · 내 포인트 +5P':''}</span>${item.replyText?`<small class="reply-text">${escapeHtml(item.replyText)}</small>`:''}</div>`:`<button class="reply" data-reply="${item.id}">감사 답장 고르기 · 내 포인트 +5P</button>`}<button class="text-button report-from-card">분석 보기</button></div></article>`;}
function sentCard(item){const reply=item.recipientReply?`<div class="recipient-reply"><b>받은 감사 답장</b><p>${escapeHtml(item.recipientReply)}</p>${item.recipientReplyAt?`<small>${escapeHtml(item.recipientReplyAt)}</small>`:''}</div>`:'<p class="recipient-reply-empty">감사 답장이 아직 오지 않았습니다.</p>';return `<article class="booster-card"><div class="card-top"><span class="avatar sent-avatar">${initials(item.recipient)}</span><div><b>${escapeHtml(item.recipient)}</b><small>${escapeHtml(item.time)}</small></div><span class="state sent-state">${item.isDemo?'시연 보냄':'보냄'}</span></div>${formatSelections(item)}<p class="message">${escapeHtml(item.message)}</p>${reply}<div class="card-bottom"><button class="secondary reuse" data-reuse="${item.id}">이 내용 재사용</button></div></article>`;}
function pieChartMarkup(label,key,received,colors,description){
 const entries=Object.entries(countBy(received,key)).sort((a,b)=>b[1]-a[1]),total=entries.reduce((sum,[,count])=>sum+count,0);
 const heading=`<h4>${escapeHtml(label)}</h4><p class="praise-chart-description">${escapeHtml(description)}</p>`;
 if(!total)return `<section class="praise-chart">${heading}<p class="chart-empty">선택된 항목이 없습니다.</p></section>`;
 let offset=0;
 const slices=entries.map(([name,count],index)=>{const start=offset,end=offset+count/total*100,color=colors[index%colors.length];offset=end;return `${color} ${start}% ${end}%`;}).join(',');
 const detail=entries.map(([name,count])=>`${name} ${count}건`).join(', ');
 return `<section class="praise-chart">${heading}<div class="pie-chart" style="--pie-slices:${slices}" role="img" aria-label="${escapeHtml(label)} 선택 횟수 기준: ${escapeHtml(detail)}"><span>${total}<small>회</small></span></div><ul>${entries.map(([name,count],index)=>`<li><i style="--legend-color:${colors[index%colors.length]}"></i><span>${escapeHtml(name)}</span><b>${count}건</b></li>`).join('')}</ul></section>`;
}
const analysisDimensions=[
 {key:'partner',label:'OneTeam Partner',description:'메시지를 전달받을 상대방과의 관계'},
 {key:'mission',label:'Mission Record',description:'상대방과 함께한 협업업무의 종류'},
 {key:'boost',label:'Boost Point',description:'협업과정에서 보여준 상대방의 핵심 협업역량'},
 {key:'impact',label:'OneTeam Impact',description:'원팀이 되어 만들어낸 긍정적인 변화와 결실'}
];
function analysisScope(){
 const state=remoteWorkspace?.getState();
 if(state&&!state.checked)return '서버 연결 확인 중입니다.';
 if(state?.enabled){
   if(!state.employee)return '테스트 사용자를 선택하면 받은 칭찬을 분석합니다.';
   if(state.error)return '연결 오류 · 마지막으로 불러온 테스트 기록입니다. 다시 연결해 주세요.';
   if(!state.ready)return '선택한 사용자의 받은 칭찬을 불러오는 중입니다.';
   return `테스트 기록 · 내가 받은 칭찬 ${data.received.length}건 · 전체 기간`;
 }
 return `로컬 시연 기록 · 내가 받은 칭찬 ${data.received.length}건 · 전체 저장 기록`;
}
function briefingMarkup(received){
 const emptyNote=!received.length?'<p class="helper">아직 받은 칭찬이 없어요. 칭찬이 도착하면 항목별 통계를 보여드릴게요.</p>':'';
 const colors=['var(--blue)','var(--orange)','var(--teal)','var(--violet)','var(--amber)','var(--green)','var(--muted)'];
 return `${emptyNote}<div class="praise-charts">${analysisDimensions.map(({label,key,description})=>pieChartMarkup(label,key,received,colors,description)).join('')}</div><p class="data-note">각 차트는 항목이 선택된 횟수 기준입니다. 복수 선택을 포함합니다.</p>`;
}
function renderReport(){
 const received=data.received;
 $('#report-content').innerHTML=`<p>${escapeHtml(analysisScope())}</p><p>칭찬을 보낸 사람이 선택한 내용을 집계합니다. 관계는 발신자가 나를 바라본 기준이며, 반대 관계로 바꾸지 않습니다.</p><p>비율은 전체 받은 칭찬 ${received.length}건 중 해당 항목이 선택된 칭찬의 비율입니다. 복수 선택과 2·3순위를 각각 포함하므로 비율의 합은 100%를 넘을 수 있습니다. 순위별 가중치는 적용하지 않습니다.</p>${!received.length?'<p class="empty">아직 받은 칭찬이 없습니다.</p>':''}${analysisDimensions.map(({key,label,description})=>{
   const entries=Object.entries(countBy(received,key)).sort((a,b)=>b[1]-a[1]);
   const missing=received.filter(item=>!storedSelections(item,key).length).length;
   return `<section><h3>${label}</h3><p>${description}</p>${entries.length?entries.map(([name,count])=>{
     const percent=Math.round(count/received.length*100);
     return `<div class="report-bar"><span>${escapeHtml(name)}</span><i aria-hidden="true"><b style="width:${percent}%"></b></i><em>${count}건 · ${percent}%</em></div>`;
   }).join(''):'<p class="helper">선택된 항목이 없습니다.</p>'}${missing?`<p class="helper">항목이 기록되지 않은 칭찬 ${missing}건</p>`:''}</section>`;
 }).join('')}`;
}
function render(){
 const totalPoints=data.points;
 const received=data.received,sent=data.sentBoosters,unreplied=received.filter(item=>!item.replied).length,replyRewards=received.filter(item=>item.replyPointsAwarded).length;
 const remaining=remainingDailyBoosters();
 $('#inbox-count').textContent=unreplied;$('#point-total').textContent=totalPoints;$('#send-limit').textContent=`오늘 ${remaining}회 남음`;$('#open-composer').disabled=remaining===0||Boolean(remoteWorkspace&&(!remoteWorkspace.getState().checked||(remoteWorkspace.getState().enabled&&(!remoteWorkspace.getState().ready||remoteWorkspace.getState().busy))));
 $('#point-breakdown').innerHTML=[['받은 부스터',`${received.length}건 · 20P/건`],['보낸 부스터',`${sent.length}건 · 10P/건`],['감사 답장',`${replyRewards}건 · +${replyRewards*5}P`]].map(([label,value])=>`<div><span>${label}</span><b>${value}</b></div>`).join('');
 $('#score-strip').innerHTML=`<div><small>받은 칭찬</small><b>${received.length}<em>건</em></b></div><div><small>전한 칭찬</small><b>${sent.length}<em>건</em></b></div><div><small>답장을 기다리는 칭찬</small><b>${unreplied}<em>건</em></b></div><div><small>답장 완료</small><b>${replyRewards}<em>건</em></b></div>`;

 $('#analysis-scope').textContent=analysisScope();$('#praise-briefing').innerHTML=briefingMarkup(received);
 const activity=[...received.map(item=>({...item,type:'받은'})),...sent.map(item=>({...item,from:item.recipient,type:'보낸'}))].slice(0,4);
 $('#recent-list').innerHTML=activity.map(item=>`<article class="activity-row"><span class="avatar">${initials(item.from)}</span><div><small>${item.type} 부스터 · ${escapeHtml(item.mission)}</small><b>${escapeHtml(item.from)}님${item.type==='받은'?`(${escapeHtml(item.team||'소속 정보 없음')})이 보낸 칭찬`:'에게 보낸 칭찬'}</b><p>${escapeHtml(item.message)}</p></div><time>${escapeHtml(item.time)}</time></article>`).join('');
 $('#received-summary').innerHTML=summaryCards([[`${received.length}건`,'받은 부스터 · 전체'],[topOf(received,'mission'),'미션 레코드 · 가장 많이 받은 항목'],[topOf(received,'boost'),'부스트포인트 · 가장 많이 받은 항목'],[topOf(received,'impact'),'원팀 임팩트 · 가장 많이 받은 항목']]);
 $('#sent-summary').innerHTML=summaryCards([[`${sent.length}건`,'보낸 부스터 · 전체'],[topOf(sent,'mission'),'미션 레코드 · 가장 많이 선택한 항목'],[topOf(sent,'boost'),'부스트포인트 · 가장 많이 선택한 항목'],[topOf(sent,'impact'),'원팀 임팩트 · 가장 많이 선택한 항목']]);
 $('#received-list').innerHTML=received.map(receivedCard).join('');$('#sent-list').innerHTML=sent.length?sent.map(sentCard).join(''):'<p class="empty">보낸 부스터가 없습니다. 첫 칭찬을 전해보세요.</p>';
 renderReport();LeaderWorkspace.sync(data);HomeWorkspace.sync(data);
}
function showView(view){if(view==='insight'&&!LeaderWorkspace.isLeader()){toast('리더 전용 페이지입니다.');return;}$$('.view').forEach(element=>element.classList.toggle('active',element.id===view));$$('.nav-link').forEach(element=>element.classList.toggle('active',element.dataset.view===view));const title={home:'OneTeam(협업)에 대한 인정과 격려를 보냅니다',received:'나에게 온 칭찬',sent:'내가 보낸 칭찬',insight:'우리 그룹의 칭찬 현황'};$('#page-title').textContent=title[view];$('#eyebrow').textContent=view==='insight'?'LEADER VIEW · DEMO':'ONE TEAM BOOSTER';window.scrollTo({top:0,behavior:'smooth'});}
function updateSelectionCounter(group){group.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.classList.contains('selected'))));const name=group.dataset.name,count=group.querySelectorAll('.selected').length,counter=document.querySelector(`[data-counter="${name}"]`);if(!counter)return;if(group.dataset.mode==='multiple')counter.textContent=`${count} / 3`;if(group.dataset.mode==='rank')counter.textContent=count?`${count===1?'1순위':`${count}개 선택`}`:'선택하세요';}
function normalizeRanks(group){[...group.querySelectorAll('.selected')].sort((a,b)=>(Number(a.dataset.rank)||0)-(Number(b.dataset.rank)||0)).forEach((button,index)=>button.dataset.rank=String(index+1));}
function selectChoices(name,values){const group=$('[data-name="'+name+'"]');if(!group)return;[...group.children].forEach(button=>{const rank=values.indexOf(button.dataset.value||button.textContent.trim());button.classList.toggle('selected',rank>=0);if(group.dataset.mode==='rank'){if(rank>=0)button.dataset.rank=String(rank+1);else delete button.dataset.rank;}});normalizeRanks(group);updateSelectionCounter(group);}
function selectChoice(name,value){selectChoices(name,[value]);}
const apiClient=window.OTBApiClient?new window.OTBApiClient():null;
let draftGeneration=null;
const remoteWorkspace=window.OTBTestWorkspace?.create({api:apiClient,onData:value=>{data=value;render();},onState:renderTestSession});
function renderTestSession(state){
 $('#test-user-panel').hidden=state.checked&&!state.enabled;
 $('#test-user-status').textContent=state.error||(!state.checked?'서버 연결 확인 중':state.busy?'저장 중':!state.employee?'테스트 사용자를 선택하세요.':state.ready?'테스트 사용자 · 서버 연결됨':'불러오는 중');
 $('#test-user-refresh').hidden=!state.error;
 $('#test-user-refresh').disabled=state.busy;
 $('#test-user').disabled=state.busy;
 $('#test-user').innerHTML='<option value="">사용자를 선택하세요</option>'+state.users.map(user=>'<option value="'+escapeHtml(user.USER_ID)+'">'+escapeHtml(user.USER_NM)+' · '+escapeHtml(user.DEPT_NM)+'</option>').join('');
 $('#test-user').value=state.employee?.USER_ID||'';
 $('#test-mode-notice').hidden=!state.enabled;
 $('#recipient-source-field').hidden=state.enabled;
 $('#draft-guide').textContent=state.enabled?'업무명·관계·소속 구분·선택 항목을 OpenAI에 보내 칭찬 초안을 만듭니다. 업무명에는 기밀이나 개인정보를 넣지 마세요. 직원 이름·부서·이메일은 보내지 않으며, 초안은 확인하고 수정한 뒤 전송합니다.':'함께한 업무와 고마웠던 점, 도움이 된 결과를 골라주세요. 현재는 템플릿 기반 시연입니다. 초안을 확인하고 수정한 뒤 저장합니다.';
 if(state.enabled){
   $('#demo-role').hidden=true;$('#demo-role-label').hidden=true;$('#local-demo-actions').hidden=true;
   LeaderWorkspace.testMode=true;$('[data-view="insight"]').hidden=true;
   $('#current-user-name').textContent=state.employee?.USER_NM||'테스트 사용자 미선택';
   $('#current-user-department').textContent=state.employee?.DEPT_NM||'';$('#current-user-avatar').textContent=state.employee?.USER_NM?.slice(0,1)||'—';
   $('#recipient-source').value='directory';$('#recipient-source').disabled=true;
   $('#employee-directory-note').textContent='실제 임직원 검색입니다. 선택한 직원에게 보낸 칭찬과 포인트는 테스트 기록으로만 저장됩니다.';
   $('#open-employee-search').disabled=!state.ready||state.busy;
   $('#send-booster').disabled=!state.ready||state.busy;
 }
 render();
}
$('#test-user').addEventListener('change',async event=>{closeModal('modal');closeModal('reply-modal');showView('home');employeePicker?.reset();await remoteWorkspace.select(event.target.value);});
$('#test-user-refresh').onclick=()=>remoteWorkspace?.getState().users.length?remoteWorkspace.refresh():remoteWorkspace?.init();
const employeePicker=window.EmployeePicker?.mount({api:apiClient,onChange:employee=>{$('#recipient').value=employee?.USER_NM||'';}});
function setRecipientSource(source){
 if(remoteWorkspace?.getState().enabled)source='directory';
 $('#recipient-source').value=source;const actual=source==='directory';
 $('#employee-directory').hidden=!actual;$('#recipient').readOnly=actual;$('#recipient').required=!actual;
 $('#recipient-name-field').hidden=actual;$('#employee-query-field').hidden=!actual;
 employeePicker?.reset();$('#recipient').value='';
 if(actual)employeePicker?.open();
}
$('#recipient-source').addEventListener('change',event=>setRecipientSource(event.target.value));
function openComposer(reuse,isDemo=false,source='demo'){cancelDraftGeneration();if(remoteWorkspace?.getState().enabled){if(!remoteWorkspace.getState().ready||remoteWorkspace.getState().busy){toast('테스트 사용자를 선택하고 서버 연결을 확인해 주세요.');return;}source='directory';isDemo=false;}if(source!=='directory'&&!isDemo&&remainingDailyBoosters()===0){toast('오늘은 부스터를 3회 모두 보냈어요. 내일 다시 보낼 수 있습니다.');return;}$('#modal').classList.add('open');$('#booster-form').classList.remove('hidden');$('#message-preview').classList.add('hidden');$('#booster-form').dataset.demo=String(isDemo);setRecipientSource(source);if(reuse){$('#project-name').value=reuse.projectName||'';if(!remoteWorkspace?.getState().enabled)$('#recipient').value=reuse.recipient;selectChoice('partner',reuse.partner);selectChoices('recipientScope',reuse.recipientScope?[reuse.recipientScope]:[]);['mission','boost','impact'].forEach(name=>selectChoices(name,storedSelections(reuse,name)));}else if(isDemo){$('#recipient').value='시연 동료 '+(data.sentBoosters.filter(item=>item.isDemo).length+1);}if(!reuse)selectChoices('recipientScope',[]);$('#project-name').focus();}
$('#open-employee-search').onclick=()=>openComposer(null,false,'directory');
function closeModal(id){$('#'+id).classList.remove('open');if(id==='modal'){cancelDraftGeneration();employeePicker?.reset();if($('#recipient-source').value==='directory'){$('#recipient').value='';$('#message-text').value='';delete $('#message-preview').dataset.values;}}}
function draftMessage(values){return PraiseCopy.draft(values);}
$$('.nav-link').forEach(button=>button.addEventListener('click',()=>showView(button.dataset.view)));$$('[data-view-target]').forEach(button=>button.addEventListener('click',()=>showView(button.dataset.viewTarget)));
$('#open-composer').onclick=()=>openComposer();$('#open-demo-composer').onclick=()=>openComposer(null,true);$('#add-demo-received').onclick=()=>{data.received.unshift({id:`demo-r${Date.now()}`,from:'시연 동료',team:'시연 그룹',partner:'동료',mission:'문서 작성',boost:'정보 공유',impact:'팀워크 강화',message:'[시연] 함께 정리해 주신 덕분에 다음 업무를 빠르게 이어갈 수 있었습니다. 고맙습니다!',time:'방금 전',replied:false,isDemo:true});save();render();showView('received');toast('시연용 받은 부스터를 추가했어요. 감사 답장을 골라 보내보세요.');};$('#close-composer').onclick=()=>closeModal('modal');$('#modal').addEventListener('click',event=>{if(event.target===event.currentTarget)closeModal('modal');});
$$('[data-close]').forEach(button=>button.addEventListener('click',()=>closeModal(button.dataset.close)));['report-modal','leader-modal','reply-modal'].forEach(id=>$(`#${id}`).addEventListener('click',event=>{if(event.target===event.currentTarget)closeModal(event.currentTarget.id);}));
$$('.choice-group').forEach(group=>group.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;const mode=group.dataset.mode||'single',selectedButtons=[...group.querySelectorAll('.selected')];if(mode==='single'){[...group.children].forEach(item=>item.classList.toggle('selected',item===button));}else if(mode==='multiple'){if(button.classList.contains('selected'))button.classList.remove('selected');else if(selectedButtons.length<3)button.classList.add('selected');else{toast('Mission Record는 최대 3개까지 선택할 수 있습니다.');return;}}else if(mode==='rank'){if(button.classList.contains('selected')){button.classList.remove('selected');delete button.dataset.rank;}else if(selectedButtons.length<3){button.classList.add('selected');button.dataset.rank=String(selectedButtons.length+1);}else{toast('핵심 항목은 최대 3개까지 순위를 정할 수 있습니다.');return;}normalizeRanks(group);}updateSelectionCounter(group);}));
function setDraftStatus(message){$('#draft-status').textContent=message;$('#draft-status').hidden=!message;}
function finishDraftGeneration(request){
 if(draftGeneration!==request)return;
 draftGeneration=null;request.controls.forEach(([control,disabled])=>{control.disabled=disabled;});
 $('#generate-draft').disabled=false;$('#generate-draft').textContent='메시지 초안 만들기 →';
 $('#booster-form').setAttribute('aria-busy','false');
}
function cancelDraftGeneration(){
 if(draftGeneration){const request=draftGeneration;request.controller.abort();finishDraftGeneration(request);}
 setDraftStatus('');
}
$('#booster-form').addEventListener('submit',async event=>{
 event.preventDefault();if(draftGeneration)return;
 const missions=selectionList('mission'),boosts=selectionList('boost'),impacts=selectionList('impact');
 if(!missions.length||!boosts.length||!impacts.length){toast('Mission, Boost Point, Impact를 각각 선택해 주세요.');return;}
 const values={projectName:$('#project-name').value.trim(),recipient:$('#recipient').value.trim(),partner:selected('partner'),recipientScope:selected('recipientScope'),mission:missions.join(' · '),boost:boosts[0],impact:impacts[0],missions,boosts,impacts,directoryDraft:$('#recipient-source').value==='directory',recipientId:employeePicker?.getSelected()?.USER_ID,isDemo:$('#booster-form').dataset.demo==='true'};
 if(!values.recipientScope){toast('같은 팀/그룹 또는 타 팀/그룹을 선택해 주세요.');return;}
 if(!values.projectName){toast('프로젝트 또는 업무명을 입력해 주세요.');$('#project-name').focus();return;}
 if(values.directoryDraft&&!employeePicker?.getSelected()){toast('검색 결과에서 임직원을 선택해 주세요.');return;}
 if(!values.recipient){toast('부스터를 받을 동료 이름을 입력해 주세요.');return;}
 const limitMessage=sendLimitMessage(values);if(limitMessage){toast(limitMessage);return;}
 const live=remoteWorkspace?.getState().enabled;
 let message;
 if(live){
   if(!remoteWorkspace.getState().ready||remoteWorkspace.getState().busy){toast('테스트 사용자와 서버 연결 상태를 확인해 주세요.');return;}
   const request={controller:new AbortController(),controls:[...$('#booster-form').querySelectorAll('input,select,button,textarea')].map(control=>[control,control.disabled])};
   draftGeneration=request;request.controls.forEach(([control])=>{control.disabled=true;});
   $('#generate-draft').disabled=true;$('#generate-draft').textContent='칭찬 문장 작성 중…';
   $('#booster-form').setAttribute('aria-busy','true');setDraftStatus('선택한 내용을 바탕으로 칭찬 문장을 작성하고 있어요.');
   try{
     const result=await apiClient.draft(values,{signal:request.controller.signal});
     if(draftGeneration!==request)return;
     if(result.source!=='openai'||typeof result.message!=='string'||!result.message.trim())throw new Error('INVALID_DRAFT');
     message=values.recipient+'님, '+result.message.trim();values.draftSource='openai';setDraftStatus('');
   }catch(error){
     if(draftGeneration===request&&error.name!=='AbortError')setDraftStatus(error.code?error.message:'AI 연결이 원활하지 않습니다. 다시 시도해 주세요.');
     return;
   }finally{finishDraftGeneration(request);}
 }else{message=draftMessage(values);setDraftStatus('');}
 $('#send-booster').disabled=values.directoryDraft&&!live;
 $('#message-preview-note').textContent=live?'AI가 만든 초안입니다. 업무 내용과 표현을 확인하고 수정한 뒤 전송하세요. 칭찬과 포인트는 테스트용으로 저장됩니다.':values.directoryDraft?'임직원 검색 초안입니다. 실제 전송은 로그인 연결 후 사용할 수 있습니다.':'템플릿 시연 초안입니다. 저장해도 실제 직원에게 전달되지 않습니다.';
 $('#message-text').value=message;if(live)values.requestId=createRequestId();
 $('#message-preview').dataset.values=JSON.stringify(values);
 $('#booster-form').classList.add('hidden');$('#message-preview').classList.remove('hidden');$('#message-text').focus();
});
$('#back-to-form').onclick=()=>{$('#booster-form').classList.remove('hidden');$('#message-preview').classList.add('hidden');};
$('#send-booster').onclick=async()=>{const values=JSON.parse($('#message-preview').dataset.values),limitMessage=sendLimitMessage(values);if(remoteWorkspace?.getState().enabled){if(limitMessage){toast(limitMessage);return;}try{await remoteWorkspace.send({...values,message:$('#message-text').value},values.requestId);closeModal('modal');toast('테스트 칭찬을 저장했습니다. 발신 10P·수신 20P가 반영됩니다.');}catch(error){toast(error.message);}return;}if(values.directoryDraft){toast('실제 칭찬 전송은 로그인 연결 후 사용할 수 있습니다.');return;}if(!values.projectName){toast('프로젝트 또는 업무명을 입력해 주세요.');return;}if(limitMessage){toast(limitMessage);return;}data.sentBoosters.unshift({id:`s${Date.now()}`,...values,message:$('#message-text').value,time:'방금 전',sentAt:Date.now()});data.points+=10;save();render();closeModal('modal');$('#booster-form').reset();selectChoice('partner','동료');selectChoices('recipientScope',[]);selectChoice('mission','문서 작성');selectChoice('boost','정보 공유');selectChoice('impact','품질 향상');toast('칭찬을 보냈어요. 내 포인트에 10P를 더했어요.');};
$('#received-list').addEventListener('click',event=>{const id=event.target.dataset.reply;if(id){const item=data.received.find(value=>value.id===id);if(item&&!item.replied){$('#reply-booster-id').value=id;$('#reply-template').value='따뜻한 칭찬 덕분에 힘이 났어요. 함께해 주셔서 고맙습니다.';$('#reply-modal').classList.add('open');}}if(event.target.classList.contains('report-from-card'))$('#report-modal').classList.add('open');});
$('#reply-form').addEventListener('submit',async event=>{event.preventDefault();const item=data.received.find(value=>value.id===$('#reply-booster-id').value);if(!item||item.replied){closeModal('reply-modal');return;}if(remoteWorkspace?.getState().enabled){try{await remoteWorkspace.reply(item.id,$('#reply-template').value);closeModal('reply-modal');toast('테스트 답장을 저장했습니다. 답장자에게 5P가 반영됩니다.');}catch(error){toast(error.message);}return;}item.replied=true;item.replyText=$('#reply-template').value;item.replyPointsAwarded=true;data.points+=5;save();render();closeModal('reply-modal');toast(`${item.from}님에게 감사 답장을 보냈어요. 내 포인트에 +5P가 반영됩니다.`);});
$('#sent-list').addEventListener('click',event=>{const item=data.sentBoosters.find(value=>value.id===event.target.dataset.reuse);if(item)openComposer(item);});
['open-report','open-report-inline'].forEach(id=>$(`#${id}`).onclick=()=>$('#report-modal').classList.add('open'));
HomeWorkspace.init({compose:openComposer,navigate:showView});
LeaderWorkspace.init(data);
window.addEventListener('storage',event=>{
 if(remoteWorkspace?.getState().enabled)return;
 if(event.key!==STORE||!event.newValue)return;
 try{
   const incoming=JSON.parse(event.newValue);
   if(!Array.isArray(incoming.received)||!Array.isArray(incoming.sentBoosters)||!Number.isSafeInteger(incoming.points)||incoming.points<0)throw new Error();
   data=incoming;render();
 }catch{toast('다른 탭의 칭찬 기록을 확인할 수 없습니다.');}
});
$$('.choice-group').forEach(updateSelectionCounter);render();

if(remoteWorkspace){remoteWorkspace.init();window.addEventListener('pagehide',()=>remoteWorkspace.stop());}
function createRequestId(){if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();const bytes=globalThis.crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const text=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');return text.slice(0,8)+'-'+text.slice(8,12)+'-'+text.slice(12,16)+'-'+text.slice(16,20)+'-'+text.slice(20);}
