import { Worker, Queue, Job } from 'bullmq';
import { type TaskEnvelope, type WorkerResponse, WorkerStatus } from '@fyi/contracts';
import { createRedisConnection, createTaskLogger } from '@fyi/utils';

const QUEUE_NAME = 'voice-queue';               // ADAPT
const COMPLETION_QUEUE = 'completion-queue';
const WORKER_ID = 'mock-voice-v1';              // ADAPT
const WORKER_VERSION = '1.0.0';
const CAPABILITY = 'speech-synthesis:voice';    // ADAPT

function buildMockOutput(envelope: TaskEnvelope): Record<string, unknown> {
  const narration = (envelope.payload?.script as string) ?? 'no script provided';
  const execId = envelope.execution_id;
  return {
    audio_url: `/tmp/fyi-studio/${execId}/voice-output.mp3`,
    duration_seconds: 45,
    voice_id: 'mock-voice-1',
    script_preview: narration.slice(0, 80),
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
    new_references: {
      voice_output: (output.audio_url as string),
    },
    usage: {
      tokens_in: 0,
      tokens_out: 0,
      seconds: 45,
      cost_estimate: 0.0012,
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
  void completionQueue.add(job.id as string, result, { removeOnComplete: true });
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
