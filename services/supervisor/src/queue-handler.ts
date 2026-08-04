// BullMQ queue factories for the Supervisor. Encapsulates the Redis connection
// and default job options so callers stay thin.

import { Queue, Worker, type Job } from 'bullmq';
import { createRedisConnection } from '@fyi/utils';
import { COMPLETION_QUEUE } from './config.js';

export interface CompletionResult {
  job_id: string;
  [key: string]: unknown;
}

/** Queue used to dispatch a step to a specific worker queue. */
export function createWorkerQueue(queueName: string): Queue {
  return new Queue(queueName, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });
}

/** Queue used by workers to publish their WorkerResponse. */
export function createCompletionQueue(): Queue {
  return new Queue(COMPLETION_QUEUE, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });
}

/** Worker listening on the completion queue; invokes `processor` per completed step. */
export function createCompletionWorker(
  processor: (job: Job<CompletionResult>) => Promise<void>,
): Worker {
  return new Worker(COMPLETION_QUEUE, processor, {
    connection: createRedisConnection(),
    concurrency: 5,
  });
}
