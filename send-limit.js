(function(root){
 const DAY=86400000,KST=9*3600000;
 function resetTimes(now=Date.now()){
  const seoul=new Date(now+KST);
  const today=Date.UTC(seoul.getUTCFullYear(),seoul.getUTCMonth(),seoul.getUTCDate())-KST;
  return {daily:today+DAY,weekly:today+((8-seoul.getUTCDay())%7||7)*DAY};
 }
 function countdown(until,now=Date.now()){
  const seconds=Math.max(0,Math.ceil((until-now)/1000));
  const days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60);
  return `${days?days+'일 ':''}${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
 }
 function init(doc,onReset=()=>{}){
  const wrap=doc.getElementById('send-limit-wrap'),button=doc.getElementById('send-limit'),tip=doc.getElementById('send-limit-rules');
  if(!wrap||!button||!tip)return;
  let timer,hover=false,focus=false,pinned=false,dismissed=false,nextReset=resetTimes().daily;
  function tick(){
   const now=Date.now(),reset=resetTimes(now);
   doc.getElementById('daily-reset-countdown').textContent=countdown(reset.daily,now);
   doc.getElementById('weekly-reset-countdown').textContent=countdown(reset.weekly,now);
  }
  function update(){
   const open=!dismissed&&(hover||focus||pinned);
   tip.hidden=!open;button.setAttribute('aria-expanded',String(open));clearInterval(timer);
   if(open){tick();timer=setInterval(tick,1000);timer.unref?.();}
  }
  wrap.addEventListener('mouseenter',()=>{hover=true;dismissed=false;update();});
  wrap.addEventListener('mouseleave',()=>{hover=false;update();});
  button.addEventListener('focus',()=>{focus=true;dismissed=false;update();});
  button.addEventListener('blur',()=>{focus=false;update();});
  button.addEventListener('click',()=>{pinned=!pinned;dismissed=!pinned;update();});
  doc.addEventListener('keydown',event=>{if(event.key==='Escape'){pinned=false;dismissed=true;update();}});
  doc.addEventListener('click',event=>{if(!wrap.contains(event.target)){pinned=false;dismissed=true;update();}});
  const resetTimer=setInterval(()=>{const now=Date.now();if(now>=nextReset){nextReset=resetTimes(now).daily;onReset();}},1000);resetTimer.unref?.();
  root.addEventListener?.('pagehide',()=>{clearInterval(timer);clearInterval(resetTimer);});
  return ()=>{clearInterval(timer);clearInterval(resetTimer);};
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={resetTimes,countdown,init};
 else root.OTBSendLimit={resetTimes,countdown,init};
})(globalThis);
