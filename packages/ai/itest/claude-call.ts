// Claude real call test — loads CLAUDE_API_KEY from .env and hits Anthropic /messages.
import { readFileSync } from 'node:fs';
import { AiClient, AiClientError } from '@fyi/ai';

function loadEnv(path: string): void {
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx <= 0) continue;
    const k = t.slice(0, idx).trim();
    if (!process.env[k]) process.env[k] = t.slice(idx + 1).trim();
  }
}
loadEnv('/workspaces/FYI-Studio/.env');

const key = process.env.CLAUDE_API_KEY;
console.log('CLAUDE_API_KEY present:', Boolean(key), 'len=', key?.length ?? 0);
if (!key) { console.log('NO CLAUDE KEY'); process.exit(1); }

const client = new AiClient();
try {
  const res = await client.complete({
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
    messages: [{ role: 'user', content: 'Reply with exactly: CLAUDE_OK' }],
    max_tokens: 20,
  });
  console.log('TEXT:', JSON.stringify(res.text));
  console.log('TOKENS:', res.tokens_in, res.tokens_out);
} catch (e) {
  if (e instanceof AiClientError) {
    console.error('AiClientError code=', e.code, 'retryable=', e.retryable);
    console.error('message=', e.message.slice(0, 500));
  } else {
    console.error('unknown err', e);
  }
}
process.exit(0);
