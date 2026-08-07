import { Worker, Queue, Job } from 'bullmq';
import { type TaskEnvelope, type WorkerResponse, WorkerStatus } from '@fyi/contracts';
import { createRedisConnection, createTaskLogger } from '@fyi/utils';
import { seedRegistries, ModelGate, loadModelPolicy, parseContentBrief, briefToPrompt } from '@fyi/platform';
import { AiClient } from '@fyi/ai';
import { assembleContext, type AssembledContext } from '@fyi/knowledge';

const QUEUE_NAME = 'script-real-queue';
const COMPLETION_QUEUE = 'completion-queue';
const WORKER_ID = 'real-script-v1';
const WORKER_VERSION = '1.0.0';
const CAPABILITY = 'text-synthesis:script:real';

const aiClient = new AiClient();

/**
 * Build a compact script system prompt injecting tenant context
 * (brand voice, style guide, constraints, forbidden terms, verified facts, memory)
 * plus the Content Brief that governs this piece of content.
 */
function buildScriptSystemPrompt(ctx: AssembledContext, briefText: string): string {
  const lines: string[] = [
    'You are the FYI Studio Script Worker. Write a video script based on the research brief and the Content Brief below.',
    '',
    'CONTENT BRIEF (the contract for this content):',
    briefText,
    '',
    'Keep the script aligned with the brief: objective, audience, angle, success metric, and distribution target.',
  ];
  if (ctx.brand_voice) lines.push(`Follow the brand voice: ${ctx.brand_voice}`);
  if (ctx.language) lines.push(`Write in this language: ${ctx.language}`);
  if (ctx.style_guide) lines.push(`Follow the style guide: ${ctx.style_guide}`);
  if (ctx.forbidden_terms.length) lines.push(`AVOID these terms: ${ctx.forbidden_terms.join(', ')}`);
  if (Object.keys(ctx.constraints).length) {
    lines.push(`Respect these constraints: ${JSON.stringify(ctx.constraints)}`);
  }
  if (ctx.verified_facts.length) {
    lines.push(`Keep the script consistent with these verified facts: ${ctx.verified_facts.join(' | ')}`);
  }
  if (ctx.memory.length) {
    const mem = ctx.memory.map((m: Record<string, unknown>) => `${String(m.kind)}: ${String(m.content)}`).join(' | ');
    lines.push(`Context from past output: ${mem}`);
  }
  return lines.join('\n');
}

async function buildOutput(envelope: TaskEnvelope): Promise<Record<string, unknown>> {
  const researchBrief = (envelope.payload?.research_brief as string) ?? 'no research brief provided';
  const brief = parseContentBrief(envelope.payload?.content_brief);
  const briefText = brief ? briefToPrompt(brief) : 'no content brief provided';

  // Assemble tenant context (knowledge + memory) for prompt injection.
  const ctx = await assembleContext(envelope.tenant_id);

  const gate = new ModelGate(loadModelPolicy());
  const resolved = await gate.resolve(CAPABILITY, { scope: envelope.tenant_id });
  if (!resolved.ok) {
    throw new Error(resolved.error?.message ?? 'Model resolution failed');
  }
  const { provider, model } = resolved.model!;

  const system = buildScriptSystemPrompt(ctx, briefText);

  const result = await aiClient.complete({
    provider,
    model,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: `Research brief:\n${researchBrief}\n\nReturn JSON with keys: script (string, the full script), scenes (array of strings), hook (string), narration (string). Only valid JSON.`,
      },
    ],
    temperature: envelope.policy?.temperature,
    max_tokens: envelope.policy?.max_tokens ?? 4096,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(result.text.replace(/```json|```/g, '').trim()) as Record<string, unknown>;
  } catch {
    parsed = { script: result.text, scenes: [], hook: '', narration: result.text };
  }

  return {
    script: parsed.script ?? result.text,
    scenes: parsed.scenes ?? [],
    hook: parsed.hook ?? '',
    narration: parsed.narration ?? '',
    // Carry the Content Brief forward so downstream workers consume the same artifact.
    content_brief: brief ?? undefined,
    _usage: { tokens_in: result.tokens_in, tokens_out: result.tokens_out },
  };
}

async function processTask(job: Job<TaskEnvelope>): Promise<WorkerResponse> {
  const envelope = job.data;
  const taskLog = createTaskLogger({ job_id: envelope.job_id, execution_id: envelope.execution_id, step_id: envelope.step_id });
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  taskLog.info({ worker_id: WORKER_ID, capability: envelope.capability, attempt: envelope.attempt }, 'Real script worker started');

  try {
    const output = await buildOutput(envelope);
    const finishedAt = new Date().toISOString();
    const usage = output._usage as { tokens_in?: number; tokens_out?: number };

    const response: WorkerResponse = {
      contract_version: '1.1',
      job_id: envelope.job_id,
      execution_id: envelope.execution_id,
      worker_id: WORKER_ID,
      worker_version: WORKER_VERSION,
      status: WorkerStatus.SUCCESS,
      output: { script: output.script, scenes: output.scenes, hook: output.hook, narration: output.narration },
      new_references: {},
      usage: {
        tokens_in: usage.tokens_in,
        tokens_out: usage.tokens_out,
        cost_estimate: ((usage.tokens_in ?? 0) + (usage.tokens_out ?? 0)) * 0.00001,
      },
      performance: { duration_ms: Date.now() - startTime, started_at: startedAt, finished_at: finishedAt },
    };
    taskLog.info({ worker_id: WORKER_ID, duration_ms: response.performance.duration_ms, status: response.status }, 'Real script worker completed');
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    taskLog.error({ worker_id: WORKER_ID, error_message: msg }, 'Real script worker failed');
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
    { error_message: err.message }, 'Real script worker job failed');
});

async function shutdown(signal: string): Promise<void> {
  createTaskLogger({ job_id: 'none', execution_id: 'none' }).info({ signal }, 'Shutting down real script worker');
  await worker.close();
  await completionQueue.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

void seedRegistries().catch((e) => createTaskLogger({ job_id: 'none', execution_id: 'none' }).error({ error_message: e.message }, 'Registry seed failed'));

createTaskLogger({ job_id: 'none', execution_id: 'none' }).info({ queue: QUEUE_NAME, capability: CAPABILITY }, 'Real script worker started, listening');
