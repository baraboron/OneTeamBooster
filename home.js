(function(){
  const el=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let currentMetrics,previous,signature='',selectedKey,sequence=0,variant=Math.floor(Math.random()*96),action='compose';
  let openCompose=()=>{},navigate=()=>{},sample=false,client,transport={status:'disconnected',snapshot:null};
  function drawMotivation(){
    if(!currentMetrics)return;
    const keys=HomeDomain.eligible(currentMetrics);
    const offset=Math.max(0,keys.indexOf(selectedKey));
    const key=keys[(offset+sequence)%keys.length];
    const copy=HomeDomain.compose(currentMetrics,key,variant+Math.floor(sequence/keys.length));
    el('motivation-label').textContent=copy.label;
    el('motivation-title').textContent=copy.title;
    el('home-brief').textContent=copy.fact+' '+copy.ending;
    el('motivation-evidence').textContent='내 칭찬 기준 · 받은 '+currentMetrics.received+'건 / 보낸 '+currentMetrics.sent+'건';
    el('motivation-action').textContent=copy.cta+' →';
    action=copy.action;
  }
  function sampleRows(){
    return HomeDomain.rankLeaders([
      {userId:'demo-a',displayName:'시연 구성원 A',groupName:'가상 그룹',points:150},
      {userId:'demo-b',displayName:'시연 구성원 B',groupName:'가상 그룹',points:125},
      {userId:'demo-c',displayName:'시연 구성원 C',groupName:'가상 그룹',points:100},
      {userId:'demo-d',displayName:'시연 구성원 D',groupName:'가상 그룹',points:90},
      {userId:'demo-e',displayName:'시연 구성원 E',groupName:'가상 그룹',points:85},
      {userId:'demo-f',displayName:'시연 구성원 F',groupName:'가상 그룹',points:80},
      {userId:'demo-g',displayName:'시연 구성원 G',groupName:'가상 그룹',points:75},
      {userId:'demo-h',displayName:'시연 구성원 H',groupName:'가상 그룹',points:70},
      {userId:'demo-i',displayName:'시연 구성원 I',groupName:'가상 그룹',points:65},
      {userId:'local-self',displayName:'나 · 로컬 시연',groupName:'이 브라우저의 기록',points:currentMetrics?.points||0}
    ]);
  }
  function drawRanking(){
    const snapshot=transport.snapshot,rows=sample?sampleRows():snapshot?.leaders;
    const badge=el('leaderboard-status'),note=el('leaderboard-note'),list=el('leaderboard-list');
    const labels={disconnected:'연결 대기',loading:'갱신 중',error:'연결 오류',stale:'지난 집계',current:transport.streamConnected?'실시간 연결':'자동 갱신'};
    badge.textContent=sample?'시연 데이터':labels[transport.status];
    badge.dataset.state=sample?'sample':transport.status;
    el('leaderboard-sample').textContent=sample?'전사 순위로 돌아가기':'시연 순위 보기';
    el('leaderboard-refresh').hidden=sample||!client?.url;
    el('leaderboard-refresh').disabled=transport.status==='loading';
    if(sample)note.textContent='전사 순위가 아닙니다. 가상 점수와 내 로컬 점수로 계산하며, 내 점수가 변하면 즉시 다시 정렬됩니다.';
    else if(snapshot){
      const time=new Date(snapshot.asOf).toLocaleString('ko-KR');
      const interval=Math.round((client?.refreshMs||15000)/1000);
      note.textContent=snapshot.periodLabel+' · '+time+' 집계. '+(transport.status==='error'?'연결이 끊겨 마지막 집계를 표시합니다.':transport.status==='stale'?'집계 시각이 오래되어 최신 순위로 볼 수 없습니다.':interval+'초마다 확인하며 서버 변경 알림 수신 시 바로 갱신합니다.');
    }else note.textContent=transport.status==='error'?(transport.error||'전사 순위를 불러오지 못했습니다.'):'전사 포인트 데이터 연결 후 TOP 10을 표시합니다. 개인 로컬 기록으로 전사 순위를 만들지 않습니다.';
    if(rows){
      list.innerHTML=rows.length?rows.map(row=>'<li class="leaderboard-row"><span class="rank-medal rank-'+row.rank+'">'+row.rank+'<small>위</small></span><div><b>'+esc(row.displayName)+'</b><small>'+esc(row.groupName||'')+'</small></div><strong>'+row.points.toLocaleString('ko-KR')+'<small>P</small></strong></li>').join(''):'<li class="empty">해당 집계 기간의 포인트 기록이 없습니다.</li>';
    }else list.innerHTML=Array.from({length:10},(_,index)=>index+1).map(rank=>'<li class="leaderboard-row rank-waiting"><span class="rank-medal">'+rank+'<small>위</small></span><div><b>집계 연결 대기</b><small>전사 포인트 기준</small></div><strong>—</strong></li>').join('');
  }
  function sameOriginUrl(value){
    if(!value)return '';
    const url=new URL(value,location.href);
    if(url.origin!==location.origin||!['http:','https:'].includes(url.protocol))throw new Error('전사 순위는 같은 사이트의 인증된 API로 연결해야 합니다.');
    return url.href;
  }
  window.HomeWorkspace={
    sync(data){
      currentMetrics=HomeDomain.metrics(data);
      const next=JSON.stringify(currentMetrics);
      if(next!==signature){
        selectedKey=HomeDomain.preferred(currentMetrics,previous);sequence=0;variant=(variant+1)%96;
        previous={...currentMetrics};signature=next;
        if(client?.url&&!document.hidden)client.refresh();
      }
      drawMotivation();drawRanking();
    },
    init({compose,navigate:go}){
      openCompose=compose;navigate=go;
      el('motivation-next').onclick=()=>{sequence++;drawMotivation();};
      el('motivation-action').onclick=()=>action==='compose'?openCompose():navigate(action);
      el('leaderboard-sample').onclick=()=>{sample=!sample;drawRanking();};
      el('leaderboard-refresh').onclick=()=>client?.refresh();
      const config=window.OTBHomeConfig||{};
      try{
        client=new LeaderboardClient({url:sameOriginUrl(config.leaderboardUrl),eventsUrl:sameOriginUrl(config.leaderboardEventsUrl),refreshMs:config.refreshMs,onChange:state=>{transport=state;drawRanking();}});
        if(!document.hidden)client.start();
        document.addEventListener('visibilitychange',()=>document.hidden?client.stop():client.start());
        window.addEventListener('online',()=>{if(!document.hidden)client.refresh();});
        window.addEventListener('pagehide',()=>client.stop());
        window.addEventListener('pageshow',()=>{if(!document.hidden)client.start();});
      }catch(error){transport={status:'error',snapshot:null,error:error.message};}
      drawMotivation();drawRanking();
    }
  };
})();
