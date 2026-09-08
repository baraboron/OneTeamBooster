// Local prototype only. Production must derive identity and scope on a server.
(function () {
  const members = [
    { id: 'self', name: '김원익', groupId: 'education' },
    { id: 'haneul', name: '정하늘', groupId: 'education' },
    { id: 'demo-a', name: '구성원 A', groupId: 'education' },
    { id: 'demo-b', name: '구성원 B', groupId: 'education' }
  ];
  const examples = [
    { id:'group-demo-1', recipientId:'demo-a', senderId:'haneul', from:'정하늘', mission:'프로세스 개선', boost:'정보 공유', impact:'일정 단축', message:'변경된 절차와 유의사항을 미리 정리해 공유해 주셔서, 팀에서 같은 기준으로 준비할 수 있었습니다.', time:'예시 기록', replied:true },
    { id:'group-demo-2', recipientId:'haneul', senderId:'demo-a', from:'구성원 A', mission:'문서 작성', boost:'적극적 경청', impact:'품질 향상', message:'여러 의견을 끝까지 듣고 공통된 요청을 자료에 반영해 주셨습니다. 덕분에 이해하기 쉬운 문서를 함께 완성했습니다.', time:'예시 기록', replied:false }
  ];
  let session = { role:'member', userId:'self', groupId:'education', name:'김원익' };
  let appData;
  let filterMember = 'all', direction = 'received';
  const el = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const memberName = id => members.find(m => m.id === id)?.name || '외부 구성원';
  function records() {
    if (!appData) return [];
    return [
      ...appData.received.map(r => ({...r, id:`received:${r.id}`, recipientId:'self', senderId:members.find(m => m.name === r.from)?.id || 'external'})),
      ...appData.sentBoosters.map(r => ({...r, id:`sent:${r.id}`, from:'김원익', recipientId:members.find(m => m.name === r.recipient)?.id || 'external', senderId:'self'})),
      ...examples
    ];
  }
  function allowed() {
    if (session.role !== 'leader') return [];
    const memberIds = new Set(members.filter(member => member.groupId === session.groupId).map(member => member.id));
    return records().filter(record => memberIds.has(record.recipientId));
  }
  function topCollaboratingDepartments(items) {
    const counts = items.reduce((all, item) => {
      if (!item.team || item.isDemo) return all;
      all[item.team] = (all[item.team] || 0) + 1;
      return all;
    }, {});
    return Object.entries(counts).sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0],'ko')).slice(0,3);
  }
  function setRole(value) {
    session = value === 'leader' ? {role:'leader',userId:'demo-leader',groupId:'education',name:'교육G 리더 (시연)'} : {role:'member',userId:'self',groupId:'education',name:'김원익'};
    document.querySelector('[data-view="insight"]').hidden = session.role !== 'leader';
    if (session.role !== 'leader') {
      document.querySelector('[data-view="home"]').click();
    }
    render();
  }
  function render() {
    const host = el('insight');
    if (session.role !== 'leader') { host.innerHTML = '<p class="empty">리더 전용 페이지입니다.</p>'; return; }
    const all = records(), incoming = allowed();
    const departments = topCollaboratingDepartments(incoming);
    host.innerHTML = `
      <div class="leader-heading"><div><p class="leader-kicker">LEADER WORKSPACE</p><h2>그룹원들이 주고받은 칭찬을<br>모아서 확인하세요.</h2><p>인사팀 교육G · 담당 그룹원 ${members.length}명</p></div><span class="leader-access">리더 전용 · 시연</span></div>
      <p class="leader-demo-note">가상 그룹·예시 기록을 포함한 로컬 시연입니다. 구성원 A·B는 가상 인물입니다. 실제 접근 제한은 사내 로그인 연결 후 적용됩니다.</p>
      <div class="leader-metrics"><div class="leader-metric"><strong>${incoming.length}</strong><span>그룹원이 받은 칭찬</span></div><div class="leader-metric"><strong>${all.filter(r=>members.some(m=>m.id===r.senderId)).length}</strong><span>그룹원이 보낸 칭찬</span></div><section class="leader-collaboration"><div><p>COLLABORATION DEPARTMENTS</p><h3>협업이 많은 부서 TOP 3</h3><small>받은 칭찬에 기록된 발신 부서 기준</small></div><ol>${departments.length?departments.map(([name,count],index)=>`<li><b>${index+1}</b><span>${esc(name)}</span><em>${count}건</em></li>`).join(''):'<li class="empty-department">부서 정보가 있는 칭찬이 아직 없습니다.</li>'}</ol></section></div>
      <section class="panel"><div class="panel-title"><div><p>GROUP MEMBERS</p><h3>그룹원별 칭찬 현황</h3></div><span class="data-note">전체 저장 기록 기준</span></div><div class="leader-table-wrap"><table class="leader-table"><thead><tr><th>그룹원</th><th>받은 칭찬</th><th>보낸 칭찬</th><th>상세</th></tr></thead><tbody>${members.map(m=>{const list=incoming.filter(r=>r.recipientId===m.id);return `<tr class="${filterMember===m.id?'member-selected':''}"><th>${esc(m.name)}</th><td>${list.length}건</td><td>${all.filter(r=>r.senderId===m.id).length}건</td><td><button class="text-button" data-member="${m.id}" aria-label="${esc(m.name)} 칭찬 보기">보기 →</button></td></tr>`;}).join('')}</tbody></table></div></section>
      <section class="panel leader-record-panel" id="leader-record-panel"><div class="panel-title"><div><p>PRAISE RECORDS</p><h3>그룹원의 칭찬 내용</h3></div></div>
      <div class="leader-filters"><label>그룹원<select id="leader-member"><option value="all">전체 그룹원</option>${members.map(m=>`<option value="${m.id}" ${filterMember===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label><label>칭찬 구분<select id="leader-direction"><option value="received" ${direction==='received'?'selected':''}>받은 칭찬</option><option value="sent" ${direction==='sent'?'selected':''}>보낸 칭찬</option></select></label></div>
      <div class="leader-records">${all.filter(r=>direction==='received'?incoming.some(i=>i.id===r.id)&&(filterMember==='all'||r.recipientId===filterMember):members.some(m=>m.id===r.senderId)&&(filterMember==='all'||r.senderId===filterMember)).map(card).join('')||'<p class="empty">선택한 조건에 해당하는 칭찬이 없습니다.</p>'}</div></section>`;
    el('leader-member').onchange=e=>{filterMember=e.target.value;render();};
    el('leader-direction').onchange=e=>{direction=e.target.value;render();};
  }
  function card(r,incoming) {
    const recipient=members.some(m=>m.id===r.recipientId)?memberName(r.recipientId):r.recipient||'외부 구성원';
    return `<article class="leader-record-card"><div class="leader-card-heading"><b>${esc(r.from)} <span>→</span> ${esc(recipient)}</b><small>${esc(r.time)}</small></div><div class="meta-tags">${[r.mission,r.boost,r.impact].map(v=>`<span>${esc(v)}</span>`).join('')}</div><blockquote>${esc(r.message)}</blockquote></article>`;
  }
  window.LeaderWorkspace = {
    isLeader:()=>session.role==='leader',
    sync(value){appData=value;render();},
    init(value){appData=value;
      el('demo-role').onchange=e=>setRole(e.target.value);
      el('insight').addEventListener('click',e=>{const member=e.target.closest('[data-member]');if(member){filterMember=member.dataset.member;direction='received';render();el('leader-record-panel').scrollIntoView({behavior:'smooth'});}});
      setRole(el('demo-role').value);
    }
  };
})();
