import { AppError, OPTIONS, text } from './domain.js';
import { PRAISE_INSTRUCTIONS, PROMPT_VERSION } from './praise-prompt.js';

export function validateDraft(input){
  const value={projectName:text(input.projectName,100,'업무명'),partner:input.partner};
  if(!OPTIONS.partner.includes(value.partner))throw new AppError(400,'INVALID_PARTNER','상대방과의 관계를 선택해 주세요.');
  for(const field of ['missions','boosts','impacts']){
    const selected=input[field];
    if(!Array.isArray(selected)||selected.length<1||selected.length>3||new Set(selected).size!==selected.length||selected.some(item=>!OPTIONS[field].includes(item)))throw new AppError(400,'INVALID_SELECTION','업무·협업 역량·효과를 각각 1~3개 선택해 주세요.');
    value[field]=[...selected];
  }
  return value;
}

// Bounds cost in the current single-replica preview. Counters reset on process restart.
export function createDraftGenerator({apiKey,gatewayUrl,gatewayToken,model='gpt-5.6-luna',fetchFn=fetch,now=Date.now,timeoutMs=25000}={}){
  const useGateway=Boolean(gatewayUrl||gatewayToken);
  if(useGateway && (gatewayUrl!=='https://uadmxxpoxaukuwwvfdpr.supabase.co/functions/v1/openai-gateway'||!gatewayToken||gatewayToken.length<32))throw new Error('INVALID_AI_GATEWAY_CONFIGURATION');
  const users=new Map();let globalWindow={start:0,count:0},active=0;
  return {enabled:useGateway||Boolean(apiKey),async generate(actorId,input){
    const value=validateDraft(input);
    if(!useGateway&&!apiKey)throw new AppError(503,'AI_NOT_CONFIGURED','AI 초안 연결을 준비 중입니다. 잠시 후 다시 시도해 주세요.');
    const time=now();
    for(const [id,item] of users)if(!item.active&&time-item.start>=60000)users.delete(id);
    const user=users.get(actorId)||{start:time,count:0,active:false};
    if(time-globalWindow.start>=3600000)globalWindow={start:time,count:0};
    if(user.active||active>=2)throw new AppError(429,'AI_BUSY','초안을 작성 중입니다. 잠시 후 다시 시도해 주세요.');
    if(user.count>=5||globalWindow.count>=100)throw new AppError(429,'AI_RATE_LIMIT','초안 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
    user.count++;user.active=true;users.set(actorId,user);globalWindow.count++;active++;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetchFn(useGateway?gatewayUrl:'https://api.openai.com/v1/responses',{
        method:'POST',redirect:'error',signal:controller.signal,
        headers:{Authorization:'Bearer '+(useGateway?gatewayToken:apiKey),'Content-Type':'application/json'},
        body:JSON.stringify(useGateway?value:{model,store:false,instructions:PRAISE_INSTRUCTIONS,
          input:[{role:'user',content:JSON.stringify(value)}],reasoning:{effort:'none'},max_output_tokens:700,
          text:{format:{type:'json_schema',name:'praise_draft',strict:true,schema:{type:'object',properties:{message:{type:'string'}},required:['message'],additionalProperties:false}}}})
      });
      if(!response.ok){
        // Never relay upstream bodies, URLs, headers or secrets to browsers/logs.
        if(response.status===429)throw new AppError(503,'AI_QUOTA','AI 사용 한도에 도달했습니다. 관리자에게 확인해 주세요.');
        if(response.status===401||response.status===403)throw new AppError(503,'AI_CREDENTIALS','AI 연결 설정을 확인해야 합니다. 관리자에게 알려 주세요.');
        throw new AppError(503,'AI_UNAVAILABLE','AI 초안을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
      const result=await response.json();
      if(useGateway){
        const message=typeof result?.message==='string'?result.message.trim():'';
        if(result.source!=='openai'||typeof result.model!=='string'||!/^gpt-[a-z0-9.-]{1,60}$/.test(result.model)||result.promptVersion!==PROMPT_VERSION||!message||message.length>500||!/[가-힣]/.test(message)||/[<>]|sk-[a-zA-Z0-9_-]{12,}/.test(message))throw new AppError(503,'AI_INVALID_RESPONSE','초안을 확인하지 못했습니다. 다시 시도해 주세요.');
        return {message,source:'openai',model:result.model,promptVersion:result.promptVersion};
      }
      const content=(result.output||[]).filter(item=>item.type==='message').flatMap(item=>item.content||[]);
      if(content.some(item=>item.type==='refusal'))throw new AppError(422,'AI_REFUSED','입력한 업무명을 확인하고 다시 시도해 주세요.');
      if(result.status!=='completed')throw new AppError(503,'AI_INCOMPLETE','초안 작성을 끝내지 못했습니다. 다시 시도해 주세요.');
      let parsed;try{parsed=JSON.parse(content.filter(item=>item.type==='output_text').map(item=>item.text).join(''));}catch{throw new AppError(503,'AI_INVALID_RESPONSE','초안을 확인하지 못했습니다. 다시 시도해 주세요.');}
      const message=typeof parsed?.message==='string'?parsed.message.trim():'';
      if(!message)throw new AppError(422,'AI_REFUSED','입력한 업무명을 확인하고 다시 시도해 주세요.');
      if(message.length>500||!/[가-힣]/.test(message)||/[<>]|sk-[a-zA-Z0-9_-]{12,}/.test(message))throw new AppError(503,'AI_INVALID_RESPONSE','초안을 확인하지 못했습니다. 다시 시도해 주세요.');
      return {message,source:'openai',model,promptVersion:PROMPT_VERSION};
    }catch(error){
      if(error instanceof AppError)throw error;
      throw new AppError(503,controller.signal.aborted?'AI_TIMEOUT':'AI_UNAVAILABLE',controller.signal.aborted?'초안 작성이 지연되고 있습니다. 다시 시도해 주세요.':'AI 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.');
    }finally{clearTimeout(timer);user.active=false;active--;}
  }};
}
