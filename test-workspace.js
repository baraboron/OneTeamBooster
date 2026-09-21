(function(root){
  const empty=()=>({points:0,received:[],sentBoosters:[],remainingToday:3,weeklyRecipientIds:[]});
  function create({api,onData=()=>{},onState=()=>{},onRanking=()=>{},storage=root.sessionStorage}={}){
    let state={checked:false,enabled:false,ready:false,busy:false,employee:null,users:[],error:''},version=0,timer,refreshing=false;
    const notify=()=>onState({...state});
    const remember=id=>{try{storage?.setItem('otb-test-user',id);}catch{}};
    function stored(){try{return storage?.getItem('otb-test-user')||'';}catch{return '';}}
    async function refresh(force=false){
      if(!state.enabled||!state.employee||refreshing||(state.busy&&!force))return;
      const current=version;refreshing=true;
      try{
        const data=await api.workspace();
        if(current!==version)return;
        if(data.mode!=='test'||data.employee?.USER_ID!==state.employee.USER_ID||!Array.isArray(data.received)||!Array.isArray(data.sentBoosters))throw new Error('서버 사용자 정보를 확인할 수 없습니다.');
        state.ready=true;state.error='';onData(data);notify();
        try {const ranking=await api.leaderboard();if(current===version)onRanking(ranking);}catch{if(current===version)onRanking(null,'테스트 순위를 불러오지 못했습니다.');}
      }catch(error){if(current===version){state.ready=false;state.error=error.message||'서버 연결을 확인해 주세요.';notify();}}
      finally{if(current===version)refreshing=false;}
    }
    async function select(id){
      if(state.busy)return false;
      version++;refreshing=false;state.employee=state.users.find(user=>user.USER_ID===id)||null;
      state.ready=false;state.error='';api.setTestUser(state.employee?.USER_ID);remember(state.employee?.USER_ID||'');
      onData(empty());onRanking(null);notify();await refresh();return true;
    }
    async function init(){
      clearInterval(timer);
      notify();
      try{
        const system=await api.system();state.checked=true;state.enabled=system.testUserMode===true;
        if(!state.enabled){notify();return;}
        onData(empty());notify();
        const users=await api.testUsers();if(users.mode!=='test'||!Array.isArray(users.data))throw new Error('테스트 사용자를 불러오지 못했습니다.');
        state.users=users.data;notify();await select(stored());
        timer=setInterval(()=>{if(!root.document?.hidden)refresh();},15000);
        timer.unref?.();
      }catch(error){state.error=error.message||'서버 연결을 확인해 주세요.';notify();}
    }
    async function mutate(fn){
      if(!state.ready||state.busy)throw new Error('테스트 사용자와 서버 연결 상태를 확인해 주세요.');
      version++;refreshing=false;state.busy=true;notify();
      try{const result=await fn();await refresh(true);return result;}
      finally{state.busy=false;notify();}
    }
    return {init,select,refresh,getState:()=>({...state}),
      send:(values,requestId)=>mutate(()=>api.send(values,requestId)),
      reply:(id,message)=>mutate(()=>api.reply(id,message)),
      stop(){clearInterval(timer);version++;refreshing=false;}
    };
  }
  const api={create,empty};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OTBTestWorkspace=api;
})(globalThis);
