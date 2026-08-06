// BullMQ repeatable ingestion scheduler (ADR-0004 thin orchestrator, ADR-0009).
// Registers a repeatable job that fires every INGEST_INTERVAL_MS (default 1 day).
import { Queue, Worker, type Job } from 'bullmq';
import { createRedisConnection, logger } from '@fyi/utils';
import { runIngestionCycle } from './ingest.js';

const QUEUE_NAME = 'analytics-ingestion-queue';
const JOB_NAME = 'analytics-ingest-cycle';

export const INGEST_INTERVAL_MS = Number(process.env.INGEST_INTERVAL_MS ?? 86_400_000);

/** Configure the repeatable ingestion job on the queue. Returns the Queue. */
export async function setupRepeatableJob(): Promise<Queue> {
  const queue = new Queue(QUEUE_NAME, { connection: createRedisConnection() });
  await queue.upsertJobScheduler(JOB_NAME, { every: INGEST_INTERVAL_MS }, { name: JOB_NAME });
  logger.info({ interval_ms: INGEST_INTERVAL_MS, queue: QUEUE_NAME }, 'Analytics ingestion repeatable job scheduled');
  return queue;
}

/** Start a BullMQ worker that runs the ingestion cycle on each job. */
export function startIngestionWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      logger.info({ job_id: job.id }, 'Ingestion cycle started');
      const result = await runIngestionCycle();
      logger.info({ job_id: job.id, ...result }, 'Ingestion cycle finished');
    },
    { connection: createRedisConnection(), concurrency: 1 },
  );

  worker.on('error', (err) => logger.error({ err: err.message }, 'Analytics ingestion worker error'));
  return worker;
}

/** Run a single cycle immediately (CLI `--once` mode) and disconnect. */
export async function runOnce(): Promise<void> {
  const queue = new Queue(QUEUE_NAME, { connection: createRedisConnection() });
  try {
    const result = await runIngestionCycle();
    logger.info(result, 'Analytics ingestion cycle (once)');
  } finally {
    await queue.close();
  }
}
