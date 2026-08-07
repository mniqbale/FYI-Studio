// Real voice worker — Capability-Only (ADR-0011 reference implementation).
//
// This worker does NOT know any vendor/engine. It:
//   1. resolves the "voice:tts" capability via ModelGate → { provider, model }
//   2. asks the VoiceEngine adapter layer (@fyi/media) for the matching engine
//   3. delegates synthesis to that engine
//
// Adding a new voice engine (ElevenLabs, Azure, Kokoro, ...) = add an adapter in
// @fyi/media + a registry entry. This worker is NOT modified.

import { Worker, Queue, Job } from 'bullmq';
import { type TaskEnvelope, type WorkerResponse, WorkerStatus } from '@fyi/contracts';
import { createRedisConnection, createTaskLogger } from '@fyi/utils';
import { seedRegistries, ModelGate, loadModelPolicy } from '@fyi/platform';
import { getVoiceEngine, toReference } from '@fyi/media';

const QUEUE_NAME = 'voice-real-queue';
const COMPLETION_QUEUE = 'completion-queue';
const WORKER_ID = 'real-voice-v1';
const WORKER_VERSION = '1.0.0';
const CAPABILITY = 'voice:tts';

async function processTask(job: Job<TaskEnvelope>): Promise<WorkerResponse> {
  const envelope = job.data;
  const taskLog = createTaskLogger({ job_id: envelope.job_id, execution_id: envelope.execution_id, step_id: envelope.step_id });
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  taskLog.info({ worker_id: WORKER_ID, capability: envelope.capability, attempt: envelope.attempt }, 'Real voice worker started');

  try {
    const narration = (envelope.payload?.narration as string | undefined) ?? (envelope.payload?.script as string | undefined);
    if (!narration || !narration.trim()) {
      throw new Error('Real voice worker: no narration or script text provided in payload');
    }

    // 1. Resolve the capability to an engine identity via ModelGate (ADR-0011).
    const gate = new ModelGate(loadModelPolicy());
    const resolved = await gate.resolve(CAPABILITY, { scope: envelope.tenant_id });
    if (!resolved.ok) {
      taskLog.warn({ error: resolved.error?.message }, 'ModelGate could not resolve voice:tts; falling back to default engine');
    }
    const provider = resolved.model?.provider;
    const model = resolved.model?.model;

    // 2. Get the engine adapter (voice-engine.ts is the only vendor-aware layer).
    const engine = getVoiceEngine(provider, model);

    // 3. Delegate synthesis to the adapter.
    const tts = await engine.synthesize(envelope.execution_id, narration, {
      voice: typeof envelope.payload?.voice === 'string' ? envelope.payload.voice : undefined,
    });
    const finishedAt = new Date().toISOString();

    taskLog.info(
      { worker_id: WORKER_ID, engine: engine.provider, model: engine.model, audio: tts.audio_path },
      'Voice engine synthesized audio',
    );

    const response: WorkerResponse = {
      contract_version: '1.1',
      job_id: envelope.job_id,
      execution_id: envelope.execution_id,
      worker_id: WORKER_ID,
      worker_version: WORKER_VERSION,
      status: WorkerStatus.SUCCESS,
      output: {
        audio_path: tts.audio_path,
        duration_seconds: tts.duration_seconds,
        voice_id: tts.voice_id,
        provider: tts.provider,
        model: tts.model,
      },
      new_references: { voice_output: toReference(tts.audio_path) },
      usage: {
        seconds: tts.duration_seconds,
        cost_estimate: tts.cost_estimate ?? 0,
      },
      performance: { duration_ms: Date.now() - startTime, started_at: startedAt, finished_at: finishedAt },
    };
    taskLog.info({ worker_id: WORKER_ID, duration_ms: response.performance.duration_ms, status: response.status }, 'Real voice worker completed');
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    taskLog.error({ worker_id: WORKER_ID, error_message: msg }, 'Real voice worker failed');
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
    { error_message: err.message }, 'Real voice worker job failed');
});

async function shutdown(signal: string): Promise<void> {
  createTaskLogger({ job_id: 'none', execution_id: 'none' }).info({ signal }, 'Shutting down real voice worker');
  await worker.close();
  await completionQueue.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// Seed registries on startup so ModelGate has data.
void seedRegistries().catch((e) => createTaskLogger({ job_id: 'none', execution_id: 'none' }).error({ error_message: e.message }, 'Registry seed failed'));

createTaskLogger({ job_id: 'none', execution_id: 'none' }).info({ queue: QUEUE_NAME, capability: CAPABILITY }, 'Real voice worker started, listening');
