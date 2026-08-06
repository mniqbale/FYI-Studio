// Prisma singleton + .env loader for the analytics ingestion service.
// tsx does NOT auto-load .env (monorepo convention), so we load it here before
// any prisma query, following the services/dashboard/src/utils/env.ts pattern.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '@fyi/database';

/** Load `.env` into process.env (only fills unset keys, ignores malformed lines). */
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

export { prisma };
