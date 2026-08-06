// Publish scheduler (Issue 9.4 / ADR-0008). Registers a BullMQ repeatable job
// on the publish-queue that runs the sweep on an interval. Each tick finds due
// scheduled_publishes, marks them 'publishing', and enqueues them to the
// publish-queue (the worker then uploads and writes results back).

import { Queue } from 'bullmq';
import { createRedisConnection, createTaskLogger } from '@fyi/utils';
import { sweepDuePublishes, PUBLISH_QUEUE_NAME } from '@fyi/publish';

export const SWEEP_JOB_ID = 'publish-sweep';

/**
 * Register the repeatable sweep job on the publish-queue. Returns the queue so
 * callers can close it on shutdown.
 */
export async function registerScheduler(
  intervalMs: number = Number(process.env.SCHEDULER_INTERVAL_MS ?? 60_000),
): Promise<Queue> {
  const publishQueue = new Queue(PUBLISH_QUEUE_NAME, { connection: createRedisConnection() });
  await publishQueue.add(
    SWEEP_JOB_ID,
    {},
    { repeat: { every: intervalMs }, jobId: SWEEP_JOB_ID },
  );
  createTaskLogger({ job_id: 'publish-scheduler', execution_id: 'none' }).info(
    { interval_ms: intervalMs, queue: PUBLISH_QUEUE_NAME },
    'Repeatable publish sweep scheduler registered',
  );
  return publishQueue;
}

/**
 * Run the sweep once (used by the repeatable job and by an immediate run at
 * startup). Returns the number of publishes enqueued.
 */
export async function runSweep(now = new Date()): Promise<number> {
  const queue = new Queue(PUBLISH_QUEUE_NAME, { connection: createRedisConnection() });
  try {
    const enqueued = await sweepDuePublishes(queue, now);
    createTaskLogger({ job_id: SWEEP_JOB_ID, execution_id: `sweep-${Date.now()}` }).info(
      { enqueued },
      'Publish sweep completed',
    );
    return enqueued;
  } finally {
    await queue.close();
  }
}

export { sweepDuePublishes };
