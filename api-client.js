// Same-origin server requests only. The HR API key never reaches this client.
(function(root){
  class OTBApiClient {
    constructor(fetchFn=(...args)=>root.fetch(...args)){this.fetchFn=fetchFn;this.testUserId='';}
    setTestUser(id){this.testUserId=id||'';}
    async request(path,{method='GET',body,requestId,csrfToken,signal}={}){
      const response=await this.fetchFn('/api'+path,{method,credentials:'same-origin',cache:'no-store',signal,
        headers:{Accept:'application/json',...(this.testUserId?{'X-OTB-Test-User':this.testUserId}:{}),...(body?{'Content-Type':'application/json'}:{}),...(requestId?{'Idempotency-Key':requestId}:{}),...(csrfToken?{'X-CSRF-Token':csrfToken}:{})},
        ...(body?{body:JSON.stringify(body)}:{})});
      const value=await response.json();
      if(!response.ok){const error=new Error(value.error?.message||'요청을 처리하지 못했습니다.');error.code=value.error?.code;error.status=response.status;throw error;}
      return value;
    }
    employees(query,{page=1,department='',signal}={}){return this.request('/employees?q='+encodeURIComponent(query)+'&page='+page+'&DEPT_CD='+encodeURIComponent(department),{signal});}
    departments(options){return this.request('/departments',options);}
    system(){return this.request('/system');}
    testUsers(){return this.request('/test-users');}
    leaderboard(){return this.request('/leaderboard');}
    workspace(){return this.request('/workspace');}
    draft(values,{signal}={}){const {projectName,partner,recipientScope,missions,boosts,impacts}=values;return this.request('/drafts',{method:'POST',body:{projectName,partner,recipientScope,missions,boosts,impacts},signal});}
    send(values,requestId,csrfToken){return this.request('/boosters',{method:'POST',body:values,requestId,csrfToken});}
    reply(id,message,csrfToken){return this.request('/boosters/'+encodeURIComponent(id)+'/reply',{method:'POST',body:{message},csrfToken});}
    leader(memberId='',direction='received'){return this.request('/leader/records?memberId='+encodeURIComponent(memberId)+'&direction='+encodeURIComponent(direction));}
    adminRecords({userId='',direction='all',q='',page=1}={}){return this.request('/admin/records?userId='+encodeURIComponent(userId)+'&direction='+encodeURIComponent(direction)+'&q='+encodeURIComponent(q)+'&page='+page);}
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=OTBApiClient;
  else root.OTBApiClient=OTBApiClient;
})(globalThis);
