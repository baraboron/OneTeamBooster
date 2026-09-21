import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from './functions/openai-gateway/handler.js';
import { OPTIONS } from './functions/openai-gateway/options.js';
import { OPTIONS as backendOptions } from '../backend/domain.js';
import { PRAISE_INSTRUCTIONS } from './functions/openai-gateway/praise-prompt.js';
import { PRAISE_INSTRUCTIONS as backendInstructions } from '../backend/praise-prompt.js';
import { createDraftGenerator } from '../backend/drafts.js';
const token = 'synthetic-gateway-token-at-least-32-characters';
const value = () => ({ projectName: '가상 문서 검토', partner: '동료', recipientScope: '타팀', missions: ['문서 작성'], boosts: ['정보 공유'], impacts: ['품질 향상'] });
const request = (body = value(), headers = {}, suffix = '', method = 'POST') => new Request('https://example.invalid/functions/v1/openai-gateway' + suffix, {
  method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...headers },
  ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
});
const upstream = (message = '문서 검토에 필요한 정보를 공유해 주셔서 감사합니다.') => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ message }) }] }] });
test('gateway mirrors existing product choices and Korean writing instructions', () => {
  assert.deepEqual(OPTIONS, backendOptions); assert.equal(PRAISE_INSTRUCTIONS, backendInstructions);
});
test('missing configuration and unauthenticated callers never reach OpenAI', async () => {
  let calls = 0; const fetchFn = async () => { calls++; return upstream(); };
  assert.equal((await createGateway({ fetchFn })(request())).status, 503);
  const handler = createGateway({ token, apiKey: 'secret', fetchFn });
  for (const authorization of ['', 'Bearer public-key', 'Bearer ' + 'x'.repeat(600)]) assert.equal((await handler(request(value(), { Authorization: authorization }))).status, 401);
  assert.equal((await handler(request({}, {}, '/health', 'GET'))).status, 200);
  assert.equal(calls, 0);
});
test('invalid routes, methods, content types, JSON, selections and oversized streamed input are rejected', async () => {
  let calls = 0; const handler = createGateway({ token, apiKey: 'secret', fetchFn: async () => { calls++; return upstream(); } });
  for (const [req, status] of [
    [request({}, {}, '/other'), 404], [request({}, {}, '', 'GET'), 405],
    [request(value(), { 'Content-Type': 'text/plain' }), 415], [request('{broken'), 400],
    [request(null), 400], [request({ ...value(), recipientScope: 'private-department' }), 400], [request({ ...value(), boosts: ['invented'] }), 400],
    [request({ ...value(), projectName: 'x'.repeat(6000) }), 413],
  ]) assert.equal((await handler(req)).status, status);
  assert.equal(calls, 0);
});
test('gateway allows only a fixed OpenAI request and strips HR data and caller overrides', async () => {
  let observed; const handler = createGateway({ token, apiKey: 'private-api-key', fetchFn: async (url, options) => { observed = { url, ...options, body: JSON.parse(options.body) }; return upstream(); } });
  const result = await handler(request({ ...value(), USER_EMAIL: 'private@example.invalid', actorId: 'private-actor', instructions: 'override', model: 'override', url: 'https://other.invalid' }));
  assert.equal(result.status, 200); assert.equal((await result.json()).source, 'openai');
  assert.equal(observed.url, 'https://api.openai.com/v1/responses'); assert.equal(observed.redirect, 'error');
  assert.equal(observed.body.store, false); assert.equal(observed.body.max_output_tokens, 700);
  assert.deepEqual(JSON.parse(observed.body.input[0].content), value());
  assert.doesNotMatch(JSON.stringify(observed.body), /private-|override|other.invalid/);
});

test('all six relationship and scope combinations survive backend and gateway validation', async () => {
  const inputs=[];
  const handler=createGateway({token,apiKey:'private-key',fetchFn:async(_,options)=>{
    const body=JSON.parse(options.body);inputs.push(JSON.parse(body.input[0].content));
    assert.equal(body.instructions,PRAISE_INSTRUCTIONS);
    return upstream();
  }});
  const generator=createDraftGenerator({gatewayUrl:'https://uadmxxpoxaukuwwvfdpr.supabase.co/functions/v1/openai-gateway',gatewayToken:token,
    fetchFn:(url,options)=>handler(new Request(url,options))});
  for(const partner of ['동료','상사 / 선배','후배 / 신입'])for(const recipientScope of ['같은팀','타팀']){
    const input={...value(),partner,recipientScope};
    const result=await generator.generate(partner+recipientScope,{...input,DEPT_NM:'private-department',recipientId:'private-id'});
    assert.deepEqual(inputs.at(-1),input);assert.equal(result.promptVersion,'praise-ko-v2');
  }
  const legacy={...value()};delete legacy.recipientScope;
  await generator.generate('legacy',legacy);assert.deepEqual(inputs.at(-1),legacy);
});
test('upstream errors and invalid responses never expose secrets or become successful drafts', async () => {
  for (const response of [new Response('private-api-key', { status: 401 }), new Response('private-api-key', { status: 429 }), new Response('broken'), upstream('<script>안녕</script>'), upstream('')]) {
    const result = await createGateway({ token, apiKey: 'private-api-key', fetchFn: async () => response })(request());
    assert.notEqual(result.status, 200); assert.doesNotMatch(await result.text(), /private-api-key|script|broken/);
  }
});
test('local concurrency, rate and timeout guards release slots', async () => {
  let releases = []; const handler = createGateway({ token, apiKey: 'secret', fetchFn: () => new Promise(resolve => releases.push(resolve)) });
  const a = handler(request()), b = handler(request());
  while (releases.length < 2) await new Promise(resolve => setImmediate(resolve));
  assert.equal((await handler(request())).status, 429);
  releases.forEach(resolve => resolve(upstream())); await Promise.all([a, b]);
  let time = 1000; const limited = createGateway({ token, apiKey: 'secret', now: () => time, fetchFn: async () => upstream() });
  for (let i = 0; i < 20; i++) assert.equal((await limited(request())).status, 200);
  assert.equal((await limited(request())).status, 429); time += 60000;
  assert.equal((await limited(request())).status, 200);
  const timed = createGateway({ token, apiKey: 'secret', timeoutMs: 5, fetchFn: async (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('secret')), { once: true })) });
  assert.equal((await (await timed(request())).json()).error, 'AI_TIMEOUT');
});
