// Gemini live probe — reads GEMINI_API_KEY from .env and hits the real API.
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

const key = process.env.GEMINI_API_KEY ?? '';
console.log('GEMINI_API_KEY present:', Boolean(key), 'len=', key.length);

// Try the documented AI Studio REST endpoint with the key in the query string.
const model = 'gemini-2.5-pro';
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

try {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: GEMINI_OK' }] }] }),
  });
  const body = await res.json();
  console.log('HTTP', res.status);
  const msg = JSON.stringify(body);
  if (res.ok) {
    console.log('TEXT:', body?.candidates?.[0]?.content?.parts?.[0]?.text);
    console.log('TOKENS:', body?.usageMetadata?.promptTokenCount, body?.usageMetadata?.candidatesTokenCount);
  } else {
    const err = body?.error ?? body;
    console.log('error.message:', err?.message?.slice(0, 300));
    console.log('error.status:', err?.status, '| code:', err?.code);
    console.log('details:', JSON.stringify(err?.details ?? []).slice(0, 400));
  }
} catch (e) {
  console.error('NETWORK/fetch error:', e instanceof Error ? e.message : e);
}
process.exit(0);
