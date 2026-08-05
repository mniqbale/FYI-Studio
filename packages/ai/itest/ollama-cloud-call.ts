// Ollama Cloud real call test — loads OLLAMA_API_KEY + OLLAMA_BASE_URL from .env.
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

console.log('OLLAMA_API_KEY present:', Boolean(process.env.OLLAMA_API_KEY), 'len=', process.env.OLLAMA_API_KEY?.length ?? 0);
console.log('OLLAMA_BASE_URL:', process.env.OLLAMA_BASE_URL ?? '(default localhost)');

const client = new AiClient();
try {
  const res = await client.complete({
    provider: 'ollama',
    model: 'deepseek-v4-flash',
    messages: [{ role: 'user', content: 'Reply with exactly: OLLAMA_CLOUD_OK' }],
    max_tokens: 200,
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
