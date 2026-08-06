// Load .env into process.env so the dashboard runs standalone
// (node dist/index.js) without requiring the shell to have sourced env vars.
// Follows the same pattern as services/supervisor/src/index.ts.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadEnv(envPath = '.env'): void {
  const abs = resolve(process.cwd(), envPath);
  if (!existsSync(abs)) return;
  for (const line of readFileSync(abs, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx <= 0) continue;
    const k = t.slice(0, idx).trim();
    if (!process.env[k]) process.env[k] = t.slice(idx + 1).trim();
  }
}
