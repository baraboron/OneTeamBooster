(function(){
  const el=id=>document.getElementById(id);
  let currentMetrics,previous,signature='',selectedKey,sequence=0,variant=Math.floor(Math.random()*96),action='compose';
  let openCompose=()=>{},navigate=()=>{};
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
  window.HomeWorkspace={
    sync(data){
      currentMetrics=HomeDomain.metrics(data);
      const next=JSON.stringify(currentMetrics);
      if(next!==signature){
        selectedKey=HomeDomain.preferred(currentMetrics,previous);sequence=0;variant=(variant+1)%96;
        previous={...currentMetrics};signature=next;
      }
      drawMotivation();
    },
    init({compose,navigate:go}){
      openCompose=compose;navigate=go;
      el('motivation-next').onclick=()=>{sequence++;drawMotivation();};
      el('motivation-action').onclick=()=>action==='compose'?openCompose():navigate(action);
      drawMotivation();
    }
  };
})();
