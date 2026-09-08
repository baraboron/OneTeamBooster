(function(root){
  const templates=typeof module!=='undefined'&&module.exports?require('./motivation-templates.js'):root.MotivationTemplates;
  const safeCount=n=>Number.isSafeInteger(n)&&n>=0?n:0;
  function metrics(data={}){
    const received=Array.isArray(data.received)?data.received:[], sent=Array.isArray(data.sentBoosters)?data.sentBoosters:[];
    return {received:received.length,sent:sent.length,pending:received.filter(r=>!r.replied).length,replied:received.filter(r=>r.replied).length,cross:sent.filter(r=>r.recipientScope==='타팀').length,points:safeCount(data.points)};
  }
  function eligible(m){
    return [
      ['pending',m.pending>0],['milestone',m.sent>=5],
      ['crossTeam',m.cross>0],['gratitude',m.replied>0],['receiving',m.received>0],
      ['sending',m.sent>0],['beginning',m.sent===0&&m.received===0]
    ].filter(([,yes])=>yes).map(([key])=>key);
  }
  function preferred(m,previous){
    const choices=eligible(m);
    if(previous){
      for(const [metric,key] of [['replied','gratitude'],['sent','sending'],['received','receiving']]){
        if(m[metric]>previous[metric]&&choices.includes(key))return key;
      }
    }
    return choices[0];
  }
  function compose(m,key,variant=0){
    if(!eligible(m).includes(key))throw new Error('현재 상태에 맞지 않는 문구입니다.');
    const entry=templates[key],index=((Math.trunc(variant)||0)%96+96)%96;
    const fill=text=>text.replace(/\{(\w+)\}/g,(_,name)=>String(m[name]));
    return {key,label:entry.label,action:entry.action,cta:entry.cta,title:entry.titles[index%6],fact:fill(entry.facts[Math.floor(index/6)%4]),ending:entry.endings[Math.floor(index/24)%4],variant:index};
  }
  function rankLeaders(rows){
    const ids=new Set();
    for(const r of rows){
      if(!r||typeof r.userId!=='string'||!r.userId||ids.has(r.userId)||typeof r.displayName!=='string'||!r.displayName.trim()||!Number.isSafeInteger(r.points)||r.points<0)throw new Error('순위 데이터 형식 오류');
      ids.add(r.userId);
    }
    let last=null,rank=0;
    return [...rows].sort((a,b)=>b.points-a.points||(a.userId<b.userId?-1:1)).map((r,i)=>{
      if(r.points!==last)rank=i+1;
      last=r.points;return {...r,rank};
    }).filter(r=>r.rank<=10);
  }
  function validateSnapshot(value,now=Date.now()){
    if(!value||value.scope!=='company'||value.mode!=='live'||typeof value.asOf!=='string'||typeof value.periodLabel!=='string'||!value.periodLabel.trim()||!Array.isArray(value.leaders)||value.leaders.length>5000)throw new Error('전사 순위 응답을 확인할 수 없습니다.');
    const asOf=Date.parse(value.asOf);
    if(!Number.isFinite(asOf)||asOf>now+60000)throw new Error('순위 집계 시각이 올바르지 않습니다.');
    const leaders=rankLeaders(value.leaders);
    if(leaders.length!==value.leaders.length||leaders.some(r=>r.rank!==value.leaders.find(v=>v.userId===r.userId).rank))throw new Error('순위와 동점 집계를 확인해 주세요.');
    return {scope:'company',mode:'live',periodLabel:value.periodLabel,asOf:new Date(asOf).toISOString(),leaders,stale:now-asOf>60000};
  }
  const api={metrics,eligible,preferred,compose,rankLeaders,validateSnapshot};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.HomeDomain=api;
})(globalThis);
