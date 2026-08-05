// M3 Gemini real call test — loads GEMINI_API_KEY from .env robustly (ignores malformed lines).
import { readFileSync } from 'node:fs';
import { AiClient, AiClientError } from '@fyi/ai';

function loadEnv(path: string): void {
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx <= 0) continue; // skip malformed lines (no '=' or empty key)
    const k = t.slice(0, idx).trim();
    if (!process.env[k]) process.env[k] = t.slice(idx + 1).trim();
  }
}
loadEnv('/workspaces/FYI-Studio/.env');

const key = process.env.GEMINI_API_KEY;
console.log('GEMINI_API_KEY present:', Boolean(key), 'len=', key?.length ?? 0);
if (!key) {
  console.log('NO GEMINI KEY — abort');
  process.exit(1);
}

const client = new AiClient();
try {
  const res = await client.complete({
    provider: 'gemini',
    model: 'gemini-2.5-pro',
    messages: [{ role: 'user', content: 'Reply with exactly: GEMINI_OK' }],
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
