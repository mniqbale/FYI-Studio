// Real video worker — Capability-Only (ADR-0011, third implementation).
//
// Mirrors the voice/subtitle workers: it does NOT know any vendor/engine.
//   1. resolves "video:compose" via ModelGate → { provider, model }
//   2. asks the VideoEngine adapter layer (@fyi/media) for the matching engine
//   3. delegates video composition to that engine
//
// Stress test for a future MediaEngine: video has a MULTI-ASSET payload
// (audio + subtitles + title + resolution), unlike voice/subtitle (single text).

import { Worker, Queue, Job } from 'bullmq';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { type TaskEnvelope, type WorkerResponse, WorkerStatus } from '@fyi/contracts';
import { createRedisConnection, createTaskLogger } from '@fyi/utils';
import { seedRegistries, ModelGate, loadModelPolicy } from '@fyi/platform';
import { getVideoEngine, runMediaEngine } from '@fyi/media';

const QUEUE_NAME = 'video-real-queue';
const COMPLETION_QUEUE = 'completion-queue';
const WORKER_ID = 'real-video-v1';
const WORKER_VERSION = '1.0.0';
const CAPABILITY = 'video:compose';

// tsx does not auto-load .env; worker runs standalone as `node dist/index.js`.
(function loadEnvIfPresent(): void {
  try {
    const envPath = resolve(process.cwd(), '.env');
    if (!existsSync(envPath)) return;
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      if (key && !(key in process.env)) process.env[key] = trimmed.slice(idx + 1).trim();
    }
  } catch {
    // Ignore — env is optional (policy comes from model_policy.yaml).
  }
})();

async function processTask(job: Job<TaskEnvelope>): Promise<WorkerResponse> {
  const envelope = job.data;
  const taskLog = createTaskLogger({ job_id: envelope.job_id, execution_id: envelope.execution_id, step_id: envelope.step_id });

  taskLog.info({ worker_id: WORKER_ID, capability: envelope.capability, attempt: envelope.attempt }, 'Real video worker started');

  // Multi-asset input comes from prior steps' new_references or payload.
  const narration_wav = (envelope.payload?.narration_wav as string | undefined) ?? (envelope.references?.voice_output as string | undefined);
  const subtitles_srt = (envelope.payload?.subtitles_srt as string | undefined) ?? (envelope.references?.subtitles as string | undefined);
  if (!narration_wav || !subtitles_srt) {
    return failure(envelope, taskLog, 'Real video worker: missing narration_wav and/or subtitles_srt (from references or payload)');
  }

  // 1. Resolve the capability to an engine identity via ModelGate (ADR-0011).
  const gate = new ModelGate(loadModelPolicy());
  const resolved = await gate.resolve(CAPABILITY, { scope: envelope.tenant_id });
  if (!resolved.ok) {
    taskLog.warn({ error: resolved.error?.message }, 'ModelGate could not resolve video:compose; falling back to default engine');
  }

  // 2. Select the engine adapter + build its typed MULTI-ASSET input.
  const engine = getVideoEngine(resolved.model?.provider, resolved.model?.model);

  // 3. Delegate the whole lifecycle to the shared runner (ADR-0012).
  const outcome = await runMediaEngine(engine, { execution_id: envelope.execution_id, job_id: envelope.job_id, tenant_id: envelope.tenant_id }, {
    narration_wav,
    subtitles_srt,
    title: envelope.payload?.title as string | undefined,
    resolution: envelope.payload?.resolution as string | undefined,
  });

  // 4. Surface engine-specific metadata as output (NOT standardized by MediaEngine).
  const meta = (outcome.metadata ?? {}) as import('@fyi/media').VideoEngineMeta;
  if (outcome.error) {
    taskLog.error({ worker_id: WORKER_ID, error_message: outcome.error.message }, 'Real video worker failed');
    return failure(envelope, taskLog, outcome.error.message);
  }

  taskLog.info({ worker_id: WORKER_ID, engine: engine.provider, model: engine.model, video: meta.video_path }, 'Video engine composed MP4');

  const response: WorkerResponse = {
    contract_version: '1.1',
    job_id: envelope.job_id,
    execution_id: envelope.execution_id,
    worker_id: WORKER_ID,
    worker_version: WORKER_VERSION,
    status: WorkerStatus.SUCCESS,
    output: {
      video_path: meta.video_path,
      duration_seconds: meta.duration_seconds,
      resolution: meta.resolution,
      format: meta.format,
      provider: engine.provider,
      model: engine.model,
    },
    new_references: outcome.refs,
    usage: {
      seconds: meta.duration_seconds as number,
      cost_estimate: outcome.cost_estimate ?? 0,
    },
    performance: outcome.telemetry,
  };
  taskLog.info({ worker_id: WORKER_ID, duration_ms: response.performance.duration_ms, status: response.status }, 'Real video worker completed');
  return response;
}

function failure(envelope: TaskEnvelope, taskLog: ReturnType<typeof createTaskLogger>, message: string): WorkerResponse {
  taskLog.error({ worker_id: WORKER_ID, error_message: message }, 'Real video worker failed');
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
    performance: { duration_ms: 0, started_at: new Date().toISOString(), finished_at: new Date().toISOString() },
    error: { code: 'MEDIA_ERROR', message, retryable: false },
  };
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

// Seed registries on startup so ModelGate has data.
void seedRegistries().catch((e) => createTaskLogger({ job_id: 'none', execution_id: 'none' }).error({ error_message: e.message }, 'Registry seed failed'));

createTaskLogger({ job_id: 'none', execution_id: 'none' }).info({ queue: QUEUE_NAME, capability: CAPABILITY }, 'Real video worker started, listening');
