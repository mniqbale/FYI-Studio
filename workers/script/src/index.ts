import { Worker, Queue, Job } from 'bullmq';
import { type TaskEnvelope, type WorkerResponse, WorkerStatus } from '@fyi/contracts';
import { createRedisConnection, createTaskLogger } from '@fyi/utils';

const QUEUE_NAME = 'script-queue';              // ADAPT
const COMPLETION_QUEUE = 'completion-queue';
const WORKER_ID = 'mock-script-v1';             // ADAPT
const WORKER_VERSION = '1.0.0';
const CAPABILITY = 'text-synthesis:script';     // ADAPT

function buildMockOutput(envelope: TaskEnvelope): Record<string, unknown> {
  const brief = (envelope.payload?.research_brief as string) ?? 'no research brief provided';
  return {
    script: `Mock script generated from research: ${brief}`,
    scenes: ['Scene 1', 'Scene 2', 'Scene 3'],
    hook: `Hook built from: ${brief}`,
    narration: 'Narration placeholder text.',
  };
}

async function processTask(job: Job<TaskEnvelope>): Promise<WorkerResponse> {
  const envelope = job.data;
  const taskLog = createTaskLogger({ job_id: envelope.job_id, execution_id: envelope.execution_id, step_id: envelope.step_id });
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  taskLog.info({ worker_id: WORKER_ID, capability: envelope.capability, attempt: envelope.attempt }, 'Worker started processing');

  // Simulate AI processing (~2s)
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const output = buildMockOutput(envelope);
  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - startTime;

  const response: WorkerResponse = {
    contract_version: '1.1',
    job_id: envelope.job_id,
    execution_id: envelope.execution_id,
    worker_id: WORKER_ID,
    worker_version: WORKER_VERSION,
    status: WorkerStatus.SUCCESS,
    output,
    new_references: {},
    usage: {
      tokens_in: 220,
      tokens_out: 410,
      cost_estimate: 0.0008,
    },
    performance: {
      duration_ms: durationMs,
      started_at: startedAt,
      finished_at: finishedAt,
    },
  };

  taskLog.info({ worker_id: WORKER_ID, duration_ms: durationMs, status: response.status }, 'Worker completed processing');
  return response;
}

const completionQueue = new Queue(COMPLETION_QUEUE, { connection: createRedisConnection() });

const worker = new Worker<TaskEnvelope>(QUEUE_NAME, processTask, {
  connection: createRedisConnection(),
  concurrency: 1,
});

worker.on('completed', (job, result) => {
  if (job.id) {
    void completionQueue.add(job.id, result, { removeOnComplete: true });
  }
});

worker.on('failed', (job, err) => {
  const envelope = job?.data;
  createTaskLogger({ job_id: envelope?.job_id ?? 'unknown', execution_id: envelope?.execution_id ?? 'unknown' })
    .error({ error_message: err.message, stack: err.stack }, 'Worker failed');
});

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  createTaskLogger({ job_id: 'none', execution_id: 'none' }).info({ signal }, 'Shutting down worker');
  await worker.close();
  await completionQueue.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

createTaskLogger({ job_id: 'none', execution_id: 'none' }).info({ queue: QUEUE_NAME }, 'Worker started, listening');
