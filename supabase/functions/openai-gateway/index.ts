import { createGateway } from './handler.js';

Deno.serve(createGateway({
  token: Deno.env.get('OTB_GATEWAY_TOKEN'),
  apiKey: Deno.env.get('OPENAI_API_KEY'),
  model: Deno.env.get('OPENAI_MODEL') || 'gpt-5.6-luna',
}));
