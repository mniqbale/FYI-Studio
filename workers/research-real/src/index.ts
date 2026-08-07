import { Worker, Queue, Job } from 'bullmq';
import { type TaskEnvelope, type WorkerResponse, WorkerStatus } from '@fyi/contracts';
import { createRedisConnection, createTaskLogger } from '@fyi/utils';
import { seedRegistries, ModelGate, loadModelPolicy, parseContentBrief, briefToPrompt } from '@fyi/platform';
import { AiClient } from '@fyi/ai';
import { assembleContext, type AssembledContext } from '@fyi/knowledge';

const QUEUE_NAME = 'research-real-queue';
const COMPLETION_QUEUE = 'completion-queue';
const WORKER_ID = 'real-research-v1';
const WORKER_VERSION = '1.0.0';
const CAPABILITY = 'research:real';

const aiClient = new AiClient();

/**
 * Build a compact research system prompt injecting tenant context
 * (brand voice, style guide, constraints, forbidden terms, verified facts, memory)
 * and the Content Brief (the primary input driving research).
 */
function buildResearchSystemPrompt(ctx: AssembledContext, briefText: string): string {
  const lines: string[] = [
    'You are the FYI Studio Research Worker. Produce a research brief for the content described in the Content Brief below.',
    '',
    'CONTENT BRIEF (the contract for this content):',
    briefText,
    '',
    'Research the topic grounded in this brief. Align the research with the objective, audience, angle, and success metric stated.',
  ];
  if (ctx.brand_voice) lines.push(`Follow the brand voice: ${ctx.brand_voice}`);
  if (ctx.language) lines.push(`Write in this language: ${ctx.language}`);
  if (ctx.style_guide) lines.push(`Follow the style guide: ${ctx.style_guide}`);
  if (ctx.forbidden_terms.length) lines.push(`AVOID these terms: ${ctx.forbidden_terms.join(', ')}`);
  if (Object.keys(ctx.constraints).length) {
    lines.push(`Respect these constraints: ${JSON.stringify(ctx.constraints)}`);
  }
  if (ctx.verified_facts.length) {
    lines.push(`Ground your research in these verified facts: ${ctx.verified_facts.join(' | ')}`);
  }
  if (ctx.memory.length) {
    const mem = ctx.memory.map((m: Record<string, unknown>) => `${String(m.kind)}: ${String(m.content)}`).join(' | ');
    lines.push(`Context from past output: ${mem}`);
  }
  return lines.join('\n');
}

async function buildOutput(envelope: TaskEnvelope): Promise<Record<string, unknown>> {
  // Primary input: a Content Brief (manual in Phase 2.1). Fall back to a plain
  // topic string for backward compatibility with existing jobs.
  const brief = parseContentBrief(envelope.payload?.content_brief);
  const topic = brief?.topic ?? ((envelope.payload?.topic as string) ?? 'unknown topic');
  const briefText = brief ? briefToPrompt(brief) : `Topic: ${topic}`;

  // Assemble tenant context (knowledge + memory) for prompt injection.
  const ctx = await assembleContext(envelope.tenant_id);

  const gate = new ModelGate(loadModelPolicy());
  const resolved = await gate.resolve(CAPABILITY, { scope: envelope.tenant_id });
  if (!resolved.ok) {
    throw new Error(resolved.error?.message ?? 'Model resolution failed');
  }
  const { provider, model } = resolved.model!;

  const system = buildResearchSystemPrompt(ctx, briefText);

  const result = await aiClient.complete({
    provider,
    model,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content:
          'Return JSON with keys: research_brief (string), sources (array of strings), key_findings (array of strings), summary (string). Only valid JSON.',
      },
    ],
    temperature: envelope.policy?.temperature,
    max_tokens: envelope.policy?.max_tokens ?? 2048,
  });

  // Best-effort parse; fall back to raw text in research_brief.
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(result.text.replace(/```json|```/g, '').trim()) as Record<string, unknown>;
  } catch {
    parsed = { research_brief: result.text, sources: [], key_findings: [] };
  }

  return {
    research_brief: parsed.research_brief ?? result.text,
    sources: parsed.sources ?? [],
    key_findings: parsed.key_findings ?? [],
    summary: parsed.summary ?? '',
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

  taskLog.info({ worker_id: WORKER_ID, capability: envelope.capability, attempt: envelope.attempt }, 'Real research worker started');

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
      output: { research_brief: output.research_brief, sources: output.sources, key_findings: output.key_findings, summary: output.summary },
      new_references: {},
      usage: {
        tokens_in: usage.tokens_in,
        tokens_out: usage.tokens_out,
        cost_estimate: ((usage.tokens_in ?? 0) + (usage.tokens_out ?? 0)) * 0.00001,
      },
      performance: { duration_ms: Date.now() - startTime, started_at: startedAt, finished_at: finishedAt },
    };
    taskLog.info({ worker_id: WORKER_ID, duration_ms: response.performance.duration_ms, status: response.status }, 'Real research worker completed');
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    taskLog.error({ worker_id: WORKER_ID, error_message: msg }, 'Real research worker failed');
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
    { error_message: err.message }, 'Real research worker job failed');
});

async function shutdown(signal: string): Promise<void> {
  createTaskLogger({ job_id: 'none', execution_id: 'none' }).info({ signal }, 'Shutting down real research worker');
  await worker.close();
  await completionQueue.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// Seed registries on startup so ModelGate has data.
void seedRegistries().catch((e) => createTaskLogger({ job_id: 'none', execution_id: 'none' }).error({ error_message: e.message }, 'Registry seed failed'));

createTaskLogger({ job_id: 'none', execution_id: 'none' }).info({ queue: QUEUE_NAME, capability: CAPABILITY }, 'Real research worker started, listening');
