// M3 real call smoke with full error detail.
import { AiClient, AiClientError } from '@fyi/ai';

const client = new AiClient();
try {
  const res = await client.complete({
    provider: 'openai',
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Reply with exactly the word OK.' }],
    max_tokens: 20,
  });
  console.log('TEXT:', JSON.stringify(res.text));
  console.log('TOKENS:', res.tokens_in, res.tokens_out);
} catch (e) {
  if (e instanceof AiClientError) {
    console.error('AiClientError code=', e.code, 'retryable=', e.retryable);
    console.error('message=', e.message);
  } else {
    console.error('unknown err', e);
  }
}
process.exit(0);
