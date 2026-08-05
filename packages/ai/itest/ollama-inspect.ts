// Inspect raw Ollama Cloud response structure for deepseek-v4-flash.
import { readFileSync } from 'node:fs';

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

const url = `${process.env.OLLAMA_BASE_URL}/chat/completions`;
const key = process.env.OLLAMA_API_KEY;
const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
  body: JSON.stringify({ model: 'deepseek-v4-flash', messages: [{ role: 'user', content: 'Reply with the single word: PONG' }], max_tokens: 100 }),
});
const body = await res.json();
console.log('HTTP', res.status);
console.log('KEYS:', Object.keys(body));
console.log('CHOICES[0] keys:', body?.choices?.[0] ? Object.keys(body.choices[0]) : 'none');
console.log('MESSAGE keys:', body?.choices?.[0]?.message ? Object.keys(body.choices[0].message) : 'none');
console.log('content:', JSON.stringify(body?.choices?.[0]?.message?.content));
console.log('full msg:', JSON.stringify(body?.choices?.[0]?.message).slice(0, 600));
process.exit(0);
