const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function browserClient(file,response){
  const context=vm.createContext({AbortController,setTimeout,clearTimeout,response});
  vm.runInContext(`
    globalThis.calls=[];
    globalThis.fetch=async function(url,options){
      if(this!==globalThis)throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      calls.push({url,options});
      return {ok:true,json:async()=>response};
    };
  `,context);
  if(file==='leaderboard-client.js')vm.runInContext(fs.readFileSync('home-domain.js','utf8'),context);
  vm.runInContext(fs.readFileSync(file,'utf8'),context);
  return context;
}

test('default API transport calls browser fetch with its Window receiver',async()=>{
  const context=browserClient('api-client.js',{mode:'preview'});
  const result=await vm.runInContext('new OTBApiClient().system()',context);
  assert.equal(result.mode,'preview');
  assert.equal(context.calls[0].url,'/api/system');
  assert.equal(context.calls[0].options.credentials,'same-origin');
});

test('default leaderboard transport calls browser fetch with its Window receiver',async()=>{
  const context=browserClient('leaderboard-client.js',{
    scope:'company',mode:'live',periodLabel:'test',asOf:new Date().toISOString(),leaders:[]
  });
  const client=vm.runInContext('new LeaderboardClient({url:"/api/leaderboard"})',context);
  await client.refresh();
  assert.equal(client.state.status,'current',client.state.error);
  assert.equal(context.calls[0].url,'/api/leaderboard');
  assert.equal(context.calls[0].options.credentials,'same-origin');
});
