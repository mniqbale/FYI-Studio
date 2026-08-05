import { Worker, Queue, Job } from 'bullmq';
import { type TaskEnvelope, type WorkerResponse, WorkerStatus } from '@fyi/contracts';
import { createRedisConnection, createTaskLogger } from '@fyi/utils';
import { generateSubtitles, readTextAsset, toReference } from '@fyi/media';

const QUEUE_NAME = 'subtitle-real-queue';
const COMPLETION_QUEUE = 'completion-queue';
const WORKER_ID = 'real-subtitle-v1';
const WORKER_VERSION = '1.0.0';
const CAPABILITY = 'subtitle:generate:real';

async function processTask(job: Job<TaskEnvelope>): Promise<WorkerResponse> {
  const envelope = job.data;
  const taskLog = createTaskLogger({ job_id: envelope.job_id, execution_id: envelope.execution_id, step_id: envelope.step_id });
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  taskLog.info({ worker_id: WORKER_ID, capability: envelope.capability, attempt: envelope.attempt }, 'Real subtitle worker started');

  try {
    const narration = (envelope.payload?.narration as string | undefined) ?? (envelope.payload?.script as string | undefined);
    if (!narration || !narration.trim()) {
      throw new Error('Real subtitle worker: no narration or script text provided in payload');
    }

    const subs = generateSubtitles(envelope.execution_id, narration);
    const subtitle_text = readTextAsset(subs.srt_path) ?? '';
    const finishedAt = new Date().toISOString();

    const response: WorkerResponse = {
      contract_version: '1.1',
      job_id: envelope.job_id,
      execution_id: envelope.execution_id,
      worker_id: WORKER_ID,
      worker_version: WORKER_VERSION,
      status: WorkerStatus.SUCCESS,
      output: {
        srt_path: subs.srt_path,
        cues: subs.cues,
        total_duration: subs.total_duration,
        subtitle_text,
      },
      new_references: { subtitles: toReference(subs.srt_path) },
      usage: {
        seconds: Math.round(subs.total_duration),
        cost_estimate: 0,
      },
      performance: { duration_ms: Date.now() - startTime, started_at: startedAt, finished_at: finishedAt },
    };
    taskLog.info({ worker_id: WORKER_ID, duration_ms: response.performance.duration_ms, status: response.status }, 'Real subtitle worker completed');
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    taskLog.error({ worker_id: WORKER_ID, error_message: msg }, 'Real subtitle worker failed');
    return {
      contract_version: '1.1',
      job_id: envelope.job_id,
      execution_id: envelope.execution_id,
      worker_id: WORKER_ID,
      worker_version: WORKER_VERSION,
      status: WorkerStatus.FAILURE,
      output: {},
      new_references: {},
      usage: { cost_estimate: 0 },
      performance: { duration_ms: Date.now() - startTime, started_at: startedAt, finished_at: new Date().toISOString() },
      error: { code: 'MEDIA_ERROR', message: msg, retryable: false },
    };
  }
}

const completionQueue = new Queue(COMPLETION_QUEUE, { connection: createRedisConnection() });
const worker = new Worker<TaskEnvelope>(QUEUE_NAME, processTask, { connection: createRedisConnection(), concurrency: 1 });

worker.on('completed', (job, result) => {
  void completionQueue.add(job.id ?? 'unknown', result, { removeOnComplete: true });
});
worker.on('failed', (job, err) => {
  const envelope = job?.data;
  createTaskLogger({ job_id: envelope?.job_id ?? 'unknown', execution_id: envelope?.execution_id ?? 'unknown' }).error(
    { error_message: err.message }, 'Real subtitle worker job failed');
});

async function shutdown(signal: string): Promise<void> {
  createTaskLogger({ job_id: 'none', execution_id: 'none' }).info({ signal }, 'Shutting down real subtitle worker');
  await worker.close();
  await completionQueue.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

createTaskLogger({ job_id: 'none', execution_id: 'none' }).info({ queue: QUEUE_NAME, capability: CAPABILITY }, 'Real subtitle worker started, listening');
