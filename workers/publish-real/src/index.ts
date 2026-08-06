// workers/publish-real — BullMQ worker that consumes publish-queue and uploads
// via the platform adapter (YouTube-first). Uses the shared pipeline from
// @fyi/publish: resolve the adapter, execute the upload, and write the result
// back to scheduled_publishes + jobs.artifacts.published, with retry/backoff.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Worker, Queue, type Job } from 'bullmq';
import { createRedisConnection, createTaskLogger } from '@fyi/utils';
import {
  PUBLISH_QUEUE_NAME,
  requireAdapter,
  runPublish,
  type PublishTask,
  isYouTubeRealEnabled,
} from '@fyi/publish';

const WORKER_ID = 'publish-real-v1';

// Load .env so the worker runs standalone (node dist/index.js).
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

const taskLog = createTaskLogger({ job_id: 'publish-real', execution_id: 'none' });

// Prefer the real YouTube adapter only when a live credential is present;
// otherwise fall back to the mock (never consumes real quota, ADR-0009).
const preferReal = isYouTubeRealEnabled();

// A Queue for re-enqueueing retries (used by runPublish's backoff path).
const publishQueue = new Queue(PUBLISH_QUEUE_NAME, { connection: createRedisConnection() });

async function processTask(job: Job<PublishTask>): Promise<{ status: string }> {
  const task = job.data;
  const log = createTaskLogger({ job_id: task.jobId, execution_id: `publish-${task.scheduledPublishId}` });
  const adapter = requireAdapter(task.adapter, preferReal);
  log.info({ worker_id: WORKER_ID, adapter: adapter.platform, scheduled_publish_id: task.scheduledPublishId }, 'Publishing task started');
  const outcome = await runPublish(publishQueue, adapter, task);
  log.info({ scheduled_publish_id: task.scheduledPublishId, status: outcome.status }, 'Publish task finished');
  return { status: outcome.status };
}

const worker = new Worker<PublishTask>(PUBLISH_QUEUE_NAME, processTask, {
  connection: createRedisConnection(),
  concurrency: 2,
});

worker.on('failed', (job, err) => {
  const task = job?.data;
  createTaskLogger({ job_id: task?.jobId ?? 'unknown', execution_id: task ? `publish-${task.scheduledPublishId}` : 'unknown' }).error(
    { error_message: err.message },
    'Publish worker job failed',
  );
});

async function shutdown(signal: string): Promise<void> {
  taskLog.info({ signal }, 'Shutting down publish worker');
  await worker.close();
  await publishQueue.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

taskLog.info({ queue: PUBLISH_QUEUE_NAME, worker_id: WORKER_ID, prefer_real: preferReal }, 'Publish worker started, listening');
