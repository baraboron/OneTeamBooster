// Read-only transport. The server, not the browser, owns company points.
(function(root){
  const domain=typeof module!=='undefined'&&module.exports?require('./home-domain.js'):root.HomeDomain;
  class LeaderboardClient {
    constructor({url,eventsUrl='',onChange=()=>{},fetchFn=root.fetch,EventSourceClass=root.EventSource,refreshMs=15000}){
      this.url=url;this.eventsUrl=eventsUrl;this.onChange=onChange;this.fetchFn=fetchFn;this.EventSourceClass=EventSourceClass;
      this.refreshMs=Math.max(5000,Number(refreshMs)||15000);
      this.state={status:'disconnected',snapshot:null,streamConnected:false};this.generation=0;
    }
    emit(update){this.state={...this.state,...update};this.onChange(this.state);}
    async refresh(){
      if(!this.url||this.pending)return;
      const generation=this.generation,controller=new AbortController();this.controller=controller;this.pending=true;
      const timeout=setTimeout(()=>controller.abort(),8000);
      this.emit({status:'loading'});
      try{
        const response=await this.fetchFn(this.url,{credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
        if(!response.ok)throw new Error(response.status===401||response.status===403?'사내 로그인과 조회 권한을 확인해 주세요.':'전사 순위를 불러오지 못했습니다.');
        const snapshot=domain.validateSnapshot(await response.json());
        if(generation===this.generation)this.emit({snapshot,status:snapshot.stale?'stale':'current',error:''});
      }catch(error){
        if(generation===this.generation)this.emit({status:'error',error:error.name==='AbortError'?'순위 요청 시간이 초과되었습니다.':error.message});
      }finally{
        clearTimeout(timeout);
        if(generation===this.generation){this.pending=false;this.controller=null;}
      }
    }
    start(){
      if(!this.url||this.timer)return;
      this.refresh();this.timer=setInterval(()=>this.refresh(),this.refreshMs);
      if(this.eventsUrl&&this.EventSourceClass){
        try{
          this.stream=new this.EventSourceClass(this.eventsUrl);
          this.stream.onopen=()=>this.emit({streamConnected:true});
          this.stream.onmessage=()=>this.refresh();
          this.stream.onerror=()=>this.emit({streamConnected:false});
        }catch{this.emit({streamConnected:false});}
      }
    }
    stop(){
      this.generation++;this.controller?.abort();this.controller=null;this.pending=false;
      clearInterval(this.timer);this.timer=null;this.stream?.close();this.stream=null;
      this.state={...this.state,streamConnected:false};
    }
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=LeaderboardClient;
  else root.LeaderboardClient=LeaderboardClient;
})(globalThis);
