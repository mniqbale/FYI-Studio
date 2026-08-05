// Supervisor entrypoint — starts the kernel + completion worker via the shared
// bootstrap. See bootstrap.ts for wiring.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTaskLogger } from '@fyi/utils';
import { createSupervisor } from './bootstrap.js';

// Load .env so the supervisor runs standalone (node dist/index.js) without
// requiring the shell to have sourced DATABASE_URL/REDIS_URL/etc.
(function loadEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx <= 0) continue;
    const k = t.slice(0, idx).trim();
    if (!process.env[k]) process.env[k] = t.slice(idx + 1).trim();
  }
})();

const supervisor = createSupervisor();
supervisor.start();

// Graceful shutdown
const shutdown = async (signal: string): Promise<void> => {
  createTaskLogger({ job_id: 'supervisor', execution_id: 'none' }).info({ signal }, 'Shutting down');
  await supervisor.stop();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

export { createSupervisor };
