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
 * Try to extract a JSON object from a model response that may be wrapped in
 * prose (e.g. "Here is the JSON: {...}"). Returns the parsed object, or null
 * when no valid JSON object can be found. Used as a robust fallback when the
 * model does not return pure JSON.
 */
function extractJsonObject(text: string): Record<string, unknown> | null {
  // Find the first '{' and try to match a balanced JSON object from there.
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

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
  // Channel DNA (CHANNEL_CONSTITUTION §4) — makes script Business-Unit-aware.
  if (ctx.identity) lines.push(`Channel identity: ${JSON.stringify(ctx.identity)}`);
  if (ctx.audience) lines.push(`Write for this channel audience: ${ctx.audience}`);
  if (ctx.content_pillars?.length) lines.push(`Channel content pillars: ${ctx.content_pillars.join(', ')}`);
  if (ctx.visual_identity) lines.push(`Channel visual identity: ${JSON.stringify(ctx.visual_identity)}`);
  if (ctx.production_preferences) lines.push(`Channel production preferences: ${JSON.stringify(ctx.production_preferences)}`);
  if (ctx.target_duration_seconds) lines.push(`Target duration: ${ctx.target_duration_seconds} seconds. Aim the narration to land near this target.`);
  if (ctx.success_metrics?.length) lines.push(`Channel success metrics: ${ctx.success_metrics.join(', ')}`);
  if (ctx.guardrails?.length) lines.push(`Channel guardrails (do not violate): ${ctx.guardrails.join(', ')}`);
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

  // Ask the model for a strict JSON object. If it returns prose instead of
  // valid JSON (a known reliability gap on some models), retry with a firmer
  // instruction rather than degrading to garbage narration.
  const userPrompt = `Research brief:\n${researchBrief}\n\nReturn ONLY a valid JSON object with keys: title (string, a compelling, non-generic title aligned with the Channel DNA and Content Brief), hook (string, the opening hook), script (string, the full script), scenes (array of strings), narration (string), caption (string, a short platform-ready caption derived from the Channel DNA, Content Brief, and research — punchy and shareable, NOT generic), description (string, a fuller platform-ready description derived from the Channel DNA, Content Brief, and research — informative and on-brand, NOT generic). Do not include any text outside the JSON object.`;

  let result = await aiClient.complete({
    provider,
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userPrompt },
    ],
    temperature: envelope.policy?.temperature,
    max_tokens: envelope.policy?.max_tokens ?? 4096,
  });

  let parsed = parseScriptJson(result.text);
  if (!parsed) {
    // Retry once with an explicit correction — the model may have drifted into
    // prose. This keeps the worker robust without a separate worker/capability.
    const retry = await aiClient.complete({
      provider,
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
        {
          role: 'assistant',
          content: result.text,
        },
        {
          role: 'user',
          content:
            'That was not valid JSON. Respond again with ONLY a valid JSON object containing the keys: title, hook, script, scenes, narration, caption, description. No prose, no markdown fences.',
        },
      ],
      temperature: envelope.policy?.temperature,
      max_tokens: envelope.policy?.max_tokens ?? 4096,
    });
    result = retry;
    parsed = parseScriptJson(retry.text);
  }

  if (!parsed) {
    // Do NOT fabricate content to hide an LLM failure. Surface it as a worker
    // failure so the Supervisor can retry/backoff and the operator sees the
    // real problem (structured-output reliability), not a silently-broken script.
    throw new Error(
      `Script worker: model returned invalid structured output after retry (no valid JSON with title/hook/script/narration/caption/description).`,
    );
  }

  return {
    title: parsed.title,
    script: parsed.script,
    scenes: parsed.scenes,
    hook: parsed.hook,
    narration: parsed.narration,
    caption: parsed.caption,
    description: parsed.description,
    // Source-of-truth target duration (seconds) resolved from Channel DNA.
    target_duration_seconds: ctx.target_duration_seconds,
    // Carry the Content Brief forward so downstream workers consume the same artifact.
    content_brief: brief ?? undefined,
    _usage: { tokens_in: result.tokens_in, tokens_out: result.tokens_out },
  };
}

/** The structured fields the Script worker must produce (schema validation). */
interface ScriptOutput {
  title: string;
  hook: string;
  script: string;
  scenes: string[];
  narration: string;
  caption: string;
  description: string;
}

/**
 * Parse a model response as a script JSON object and validate it against the
 * required schema. Returns a fully-typed ScriptOutput when the response is a
 * valid JSON object with all required non-empty string fields, or null when the
 * response is prose / invalid JSON / missing required fields. Tolerates markdown
 * fences and JSON wrapped in a little surrounding prose.
 */
function parseScriptJson(text: string): ScriptOutput | null {
  const candidates: string[] = [text.replace(/```json|```/g, '').trim()];
  const embedded = extractJsonObject(text);
  if (embedded) candidates.push(JSON.stringify(embedded));
  for (const candidate of candidates) {
    try {
      const obj = JSON.parse(candidate) as Record<string, unknown>;
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue;
      const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
      const title = str(obj.title);
      const hook = str(obj.hook);
      const script = str(obj.script);
      const narration = str(obj.narration);
      const caption = str(obj.caption);
      const description = str(obj.description);
      // Required: title, script, narration must be non-empty. hook/caption/
      // description may be empty but must be strings (schema-typed).
      if (!title || !script || !narration) continue;
      const scenes = Array.isArray(obj.scenes) ? obj.scenes.filter((s): s is string => typeof s === 'string') : [];
      return { title, hook: hook ?? '', script, scenes, narration, caption: caption ?? '', description: description ?? '' };
    } catch {
      // try next candidate
    }
  }
  return null;
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
      output: { title: output.title, script: output.script, scenes: output.scenes, hook: output.hook, narration: output.narration, caption: output.caption, description: output.description, target_duration_seconds: output.target_duration_seconds },
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
