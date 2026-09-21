import { PRAISE_INSTRUCTIONS, PROMPT_VERSION } from './praise-prompt.js';
import { OPTIONS } from './options.js';

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});
class GatewayError extends Error {
  constructor(status, code) { super(code); this.status = status; }
}
async function boundedText(stream, limit) {
  const reader = stream?.getReader();
  if (!reader) return '';
  const parts = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new GatewayError(413, 'PAYLOAD_TOO_LARGE'); }
      parts.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    return new TextDecoder().decode(bytes);
  } finally { reader.releaseLock(); }
}
function validate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new GatewayError(400, 'INVALID_INPUT');
  if (typeof value.projectName !== 'string' || !value.projectName.trim() || value.projectName.trim().length > 100) throw new GatewayError(400, 'INVALID_INPUT');
  const clean = { projectName: value.projectName.trim(), partner: value.partner };
  if (!OPTIONS.partner.includes(clean.partner)) throw new GatewayError(400, 'INVALID_PARTNER');
  if (value.recipientScope !== undefined && value.recipientScope !== null) {
    if (!OPTIONS.recipientScope.includes(value.recipientScope)) throw new GatewayError(400, 'INVALID_RECIPIENT_SCOPE');
    clean.recipientScope = value.recipientScope;
  }
  for (const field of ['missions', 'boosts', 'impacts']) {
    const list = value[field];
    if (!Array.isArray(list) || list.length < 1 || list.length > 3 || new Set(list).size !== list.length || list.some(item => !OPTIONS[field].includes(item))) throw new GatewayError(400, 'INVALID_SELECTION');
    clean[field] = [...list];
  }
  return clean;
}
async function equalSecret(expected, supplied) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([expected, supplied].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))));
  const left = new Uint8Array(a), right = new Uint8Array(b); let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

// Local guards supplement the caller's limits; Edge isolates do not share counters.
// No HR lookup, database writes, arbitrary upstream URL or arbitrary prompt is exposed.
export function createGateway({ token, apiKey, model = 'gpt-5.6-luna', fetchFn = fetch, now = Date.now, timeoutMs = 20000 } = {}) {
  let active = 0, windowStart = 0, count = 0;
  return async request => {
    let timer;
    try {
      if (!token || token.length < 32) return json(503, { error: 'GATEWAY_NOT_CONFIGURED' });
      const supplied = request.headers.get('authorization') || '';
      if (supplied.length > 512 || !await equalSecret('Bearer ' + token, supplied)) return json(401, { error: 'UNAUTHORIZED' });
      const path = new URL(request.url).pathname;
      if (request.method === 'GET' && path.endsWith('/openai-gateway/health')) return json(200, { service: 'otb-openai-gateway', configured: Boolean(apiKey), promptVersion: PROMPT_VERSION });
      if (!path.endsWith('/openai-gateway')) return json(404, { error: 'NOT_FOUND' });
      if (request.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });
      if (!apiKey) return json(503, { error: 'AI_NOT_CONFIGURED' });
      if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) return json(415, { error: 'JSON_REQUIRED' });
      if (Number(request.headers.get('content-length')) > 4096) return json(413, { error: 'PAYLOAD_TOO_LARGE' });
      let value;
      const body = await boundedText(request.body, 4096);
      try { value = JSON.parse(body); } catch { throw new GatewayError(400, 'INVALID_JSON'); }
      const clean = validate(value);
      const time = now();
      if (time - windowStart >= 60000) { windowStart = time; count = 0; }
      if (active >= 2 || count >= 20) return json(429, { error: 'AI_RATE_LIMIT' });
      active++; count++;
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchFn('https://api.openai.com/v1/responses', {
          method: 'POST', redirect: 'error', signal: controller.signal,
          headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, store: false, instructions: PRAISE_INSTRUCTIONS,
            input: [{ role: 'user', content: JSON.stringify(clean) }], reasoning: { effort: 'none' }, max_output_tokens: 700,
            text: { format: { type: 'json_schema', name: 'praise_draft', strict: true,
              schema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'], additionalProperties: false } } },
          }),
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new GatewayError(503, response.status === 429 ? 'AI_QUOTA' : [401, 403].includes(response.status) ? 'AI_CREDENTIALS' : 'AI_UNAVAILABLE');
        }
        let result;
        try { result = JSON.parse(await boundedText(response.body, 65536)); } catch { throw new GatewayError(503, 'AI_INVALID_RESPONSE'); }
        const content = (result.output || []).filter(item => item.type === 'message').flatMap(item => item.content || []);
        if (content.some(item => item.type === 'refusal')) throw new GatewayError(422, 'AI_REFUSED');
        if (result.status !== 'completed') throw new GatewayError(503, 'AI_INCOMPLETE');
        let parsed;
        try { parsed = JSON.parse(content.filter(item => item.type === 'output_text').map(item => item.text).join('')); } catch { throw new GatewayError(503, 'AI_INVALID_RESPONSE'); }
        const message = typeof parsed?.message === 'string' ? parsed.message.trim() : '';
        if (!message) throw new GatewayError(422, 'AI_REFUSED');
        if (message.length > 500 || !/[가-힣]/.test(message) || /[<>]|sk-[a-zA-Z0-9_-]{12,}/.test(message)) throw new GatewayError(503, 'AI_INVALID_RESPONSE');
        return json(200, { message, source: 'openai', model, promptVersion: PROMPT_VERSION });
      } catch (error) {
        if (controller.signal.aborted) throw new GatewayError(503, 'AI_TIMEOUT');
        throw error;
      } finally { active--; }
    } catch (error) {
      // Never log or return upstream payloads, credentials, or exception strings.
      return json(error instanceof GatewayError ? error.status : 503, { error: error instanceof GatewayError ? error.message : 'AI_UNAVAILABLE' });
    } finally { clearTimeout(timer); }
  };
}
