// List available models on the Ollama Cloud endpoint.
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

const url = `${process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1'}/models`;
const key = process.env.OLLAMA_API_KEY;

try {
  const res = await fetch(url, { headers: key ? { Authorization: `Bearer ${key}` } : {} });
  console.log('HTTP', res.status);
  const body = await res.json();
  if (res.ok) {
    const ids = (body?.data ?? []).map((m: Record<string, unknown>) => m.id ?? m.model).filter(Boolean);
    console.log('MODELS:', JSON.stringify(ids));
  } else {
    console.log('error:', JSON.stringify(body).slice(0, 400));
  }
} catch (e) {
  console.error('network err:', e instanceof Error ? e.message : e);
}
process.exit(0);
