// services/publish entrypoint — registers the repeatable sweep job and runs a
// worker that executes the sweep each tick. Standalone: `node dist/index.js`
// (loads .env inline, per tsx/no-auto-env convention).

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Worker } from 'bullmq';
import { createRedisConnection, createTaskLogger } from '@fyi/utils';
import { PUBLISH_QUEUE_NAME } from '@fyi/publish';
import { registerScheduler, runSweep, SWEEP_JOB_ID } from './scheduler.js';

// Load .env so the service runs standalone without the shell sourcing it.
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

const taskLog = createTaskLogger({ job_id: 'publish-scheduler', execution_id: 'none' });

async function main(): Promise<void> {
  const publishQueue = await registerScheduler();

  // Process the repeatable sweep job; also runs an immediate sweep at startup.
  const worker = new Worker(
    PUBLISH_QUEUE_NAME,
    async (job) => {
      if (job.name === SWEEP_JOB_ID || job.name === 'publish-sweep') {
        await runSweep();
      }
    },
    { connection: createRedisConnection(), concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    taskLog.error(
      { job_id: job?.name ?? 'unknown', error_message: err.message },
      'Publish sweep job failed',
    );
  });

  await runSweep();
  taskLog.info({ queue: PUBLISH_QUEUE_NAME }, 'Publish scheduler started');

  const shutdown = async (signal: string): Promise<void> => {
    taskLog.info({ signal }, 'Shutting down publish scheduler');
    await worker.close();
    await publishQueue.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  taskLog.error({ error_message: err instanceof Error ? err.message : String(err) }, 'Publish scheduler failed to start');
  process.exit(1);
});
