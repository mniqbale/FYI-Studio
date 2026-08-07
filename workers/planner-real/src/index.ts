// Real Planner worker — Phase 2.2.
//
// The simplest possible Business Actor -> Business Artifact transition:
//   Content Initiative  -->  Content Brief
//
// Planner v1 does ONLY this one thing. It does NOT: pick the best model,
// schedule, build a calendar, run A/B tests, produce multiple briefs,
// optimize cost, learn, or make autonomous decisions.
//
// It resolves the "content:brief" capability via ModelGate, asks an LLM to turn
// the Content Initiative into a Content Brief, validates the brief against the
// Product Constitution vocabulary, and emits it as the artifact for Research.
//
// Capability-Only (ADR-0011): this worker knows the capability "content:brief",
// NOT any vendor/engine.

import { Worker, Queue, Job } from 'bullmq';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { type TaskEnvelope, type WorkerResponse, WorkerStatus } from '@fyi/contracts';
import { createRedisConnection, createTaskLogger } from '@fyi/utils';
import {
  seedRegistries,
  ModelGate,
  loadModelPolicy,
  parseContentInitiative,
  initiativeToPrompt,
  parseContentBrief,
} from '@fyi/platform';
import { AiClient } from '@fyi/ai';

const QUEUE_NAME = 'planner-queue';
const COMPLETION_QUEUE = 'completion-queue';
const WORKER_ID = 'real-planner-v1';
const WORKER_VERSION = '1.0.0';
const CAPABILITY = 'content:brief';

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
    // Ignore — env is optional for the planner (policy comes from model_policy.yaml).
  }
})();

const aiClient = new AiClient();

/**
 * Turn a Content Initiative into a Content Brief via the resolved LLM.
 * Returns null if the model output does not produce a valid Content Brief.
 */
async function generateBrief(envelope: TaskEnvelope, initiativeText: string): Promise<Record<string, unknown> | null> {
  const gate = new ModelGate(loadModelPolicy());
  const resolved = await gate.resolve(CAPABILITY, { scope: envelope.tenant_id });
  if (!resolved.ok) {
    throw new Error(resolved.error?.message ?? 'Model resolution failed');
  }
  const { provider, model } = resolved.model!;

  const system = [
    'You are the FYI Studio Planner. Turn a Content Initiative into a Content Brief.',
    'The Content Brief is the contract for ONE piece of content.',
    'Return ONLY valid JSON with exactly these keys:',
    '  brief_id, objective, audience, topic, angle, success_metric, constraints, distribution_target',
    'Do not add extra keys. constraints is an object.',
  ].join('\n');

  const user = `Content Initiative:\n${initiativeText}\n\nProduce the Content Brief JSON.`;

  const result = await aiClient.complete({
    provider,
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: envelope.policy?.temperature ?? 0.3,
    max_tokens: envelope.policy?.max_tokens ?? 1200,
  });

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(result.text.replace(/```json|```/g, '').trim()) as Record<string, unknown>;
  } catch {
    return null;
  }
  return raw;
}

async function buildOutput(envelope: TaskEnvelope): Promise<Record<string, unknown>> {
  // Input: a Content Initiative (provided by Founder/Operator).
  const initiative = parseContentInitiative(envelope.payload?.content_initiative);
  if (!initiative) {
    throw new Error('Planner requires a valid Content Initiative input (initiative_id, objective, audience, topic_area)');
  }

  const initiativeText = initiativeToPrompt(initiative);
  const raw = await generateBrief(envelope, initiativeText);
  if (!raw) throw new Error('Planner model did not return valid JSON');

  // Validate the produced Brief against the Product Constitution vocabulary.
  const brief = parseContentBrief(raw);
  if (!brief) {
    throw new Error('Planner produced an invalid Content Brief (missing required fields)');
  }

  return {
    content_brief: {
      brief_id: brief.brief_id,
      objective: brief.objective,
      audience: brief.audience,
      topic: brief.topic,
      angle: brief.angle,
      success_metric: brief.success_metric,
      constraints: brief.constraints,
      distribution_target: brief.distribution_target,
      _origin: 'planner',
    },
    _usage: { tokens_in: 0, tokens_out: 0 },
  };
}

async function processTask(job: Job<TaskEnvelope>): Promise<WorkerResponse> {
  const envelope = job.data;
  const taskLog = createTaskLogger({ job_id: envelope.job_id, execution_id: envelope.execution_id, step_id: envelope.step_id });
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  taskLog.info({ worker_id: WORKER_ID, capability: envelope.capability, attempt: envelope.attempt }, 'Real planner worker started');

  try {
    const output = await buildOutput(envelope);
    const finishedAt = new Date().toISOString();

    const response: WorkerResponse = {
      contract_version: '1.1',
      job_id: envelope.job_id,
      execution_id: envelope.execution_id,
      worker_id: WORKER_ID,
      worker_version: WORKER_VERSION,
      status: WorkerStatus.SUCCESS,
      output: { content_brief: output.content_brief },
      new_references: {},
      usage: { cost_estimate: 0 },
      performance: { duration_ms: Date.now() - startTime, started_at: startedAt, finished_at: finishedAt },
    };
    taskLog.info({ worker_id: WORKER_ID, duration_ms: response.performance.duration_ms, status: response.status }, 'Real planner worker completed');
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    taskLog.error({ worker_id: WORKER_ID, error_message: msg }, 'Real planner worker failed');
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
      error: { code: 'PROVIDER_ERROR', message: msg, retryable: false },
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
    { error_message: err.message }, 'Real planner worker job failed');
});

async function shutdown(signal: string): Promise<void> {
  createTaskLogger({ job_id: 'none', execution_id: 'none' }).info({ signal }, 'Shutting down real planner worker');
  await worker.close();
  await completionQueue.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

void seedRegistries().catch((e) => createTaskLogger({ job_id: 'none', execution_id: 'none' }).error({ error_message: e.message }, 'Registry seed failed'));

createTaskLogger({ job_id: 'none', execution_id: 'none' }).info({ queue: QUEUE_NAME, capability: CAPABILITY }, 'Real planner worker started, listening');
