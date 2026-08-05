import { Worker, Queue, Job } from 'bullmq';
import { type TaskEnvelope, type WorkerResponse, WorkerStatus } from '@fyi/contracts';
import { createRedisConnection, createTaskLogger } from '@fyi/utils';
import { composeVideo, toReference } from '@fyi/media';

const QUEUE_NAME = 'video-real-queue';
const COMPLETION_QUEUE = 'completion-queue';
const WORKER_ID = 'real-video-v1';
const WORKER_VERSION = '1.0.0';
const CAPABILITY = 'video:compose:real';

async function processTask(job: Job<TaskEnvelope>): Promise<WorkerResponse> {
  const envelope = job.data;
  const taskLog = createTaskLogger({ job_id: envelope.job_id, execution_id: envelope.execution_id, step_id: envelope.step_id });
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  taskLog.info({ worker_id: WORKER_ID, capability: envelope.capability, attempt: envelope.attempt }, 'Real video worker started');

  try {
    // Paths come from previous steps' new_references (file paths) via references or payload.
    const narration_wav = (envelope.payload?.narration_wav as string | undefined) ?? (envelope.references?.voice_output as string | undefined);
    const subtitles_srt = (envelope.payload?.subtitles_srt as string | undefined) ?? (envelope.references?.subtitles as string | undefined);
    const title = envelope.payload?.title as string | undefined;

    if (!narration_wav || !subtitles_srt) {
      throw new Error('Real video worker: missing narration_wav and/or subtitles_srt (from references or payload)');
    }

    const composed = await composeVideo({ execution_id: envelope.execution_id, narration_wav, subtitles_srt, title });
    const finishedAt = new Date().toISOString();

    const response: WorkerResponse = {
      contract_version: '1.1',
      job_id: envelope.job_id,
      execution_id: envelope.execution_id,
      worker_id: WORKER_ID,
      worker_version: WORKER_VERSION,
      status: WorkerStatus.SUCCESS,
      output: {
        video_path: composed.video_path,
        duration_seconds: composed.duration_seconds,
        resolution: composed.resolution,
        format: composed.format,
      },
      new_references: { video: toReference(composed.video_path) },
      usage: {
        seconds: composed.duration_seconds,
        cost_estimate: 0,
      },
      performance: { duration_ms: Date.now() - startTime, started_at: startedAt, finished_at: finishedAt },
    };
    taskLog.info({ worker_id: WORKER_ID, duration_ms: response.performance.duration_ms, status: response.status }, 'Real video worker completed');
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    taskLog.error({ worker_id: WORKER_ID, error_message: msg }, 'Real video worker failed');
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
    { error_message: err.message }, 'Real video worker job failed');
});

async function shutdown(signal: string): Promise<void> {
  createTaskLogger({ job_id: 'none', execution_id: 'none' }).info({ signal }, 'Shutting down real video worker');
  await worker.close();
  await completionQueue.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

createTaskLogger({ job_id: 'none', execution_id: 'none' }).info({ queue: QUEUE_NAME, capability: CAPABILITY }, 'Real video worker started, listening');
