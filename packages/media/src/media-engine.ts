// MediaEngine — Unified Engine Lifecycle (ADR-0012).
//
// Standardizes the PROCESS of running a media engine, never the DATA.
//   - Standardized: resolve, select adapter, run, error handling, retry,
//     telemetry, cost reporting, artifact publishing.
//   - NOT standardized: payload shape, engine-specific options, engine-specific
//     metadata (kept per-engine typed via generics — anti-leaky-abstraction).
//
// A media engine implements `run(ctx, input)` with its OWN typed `Input` and
// `Meta`. `runMediaEngine` wraps it with the shared lifecycle (timing, error
// normalization, cost, refs) so workers delegate the whole process once.

export interface EngineContext {
  execution_id: string;
  job_id?: string;
  tenant_id?: string;
}

/** Engine-produced error, normalized to the lifecycle's shape. */
export interface EngineError {
  code: string;
  message: string;
  retryable: boolean;
}

/**
 * Standardized outcome of a media engine run.
 * `refs`, `cost_estimate`, `telemetry` are the standardized lifecycle outputs;
 * `metadata` is engine-specific and intentionally opaque (NOT forced into a
 * shared schema).
 */
export interface EngineOutcome<Meta = unknown> {
  refs: Record<string, string>; // artifact publishing (file:// pointers)
  cost_estimate: number; // cost reporting
  telemetry: { duration_ms: number; started_at: string; finished_at: string };
  metadata?: Meta; // engine-specific, NOT standardized
  error?: EngineError; // present when the run failed (never throws out)
}

/**
 * A media engine. `Input` and `Meta` are per-engine and generic — the lifecycle
 * runner never sees a common payload schema (anti-leaky-abstraction).
 */
export interface MediaEngine<Input = unknown, Meta = unknown> {
  readonly provider: string;
  readonly model: string;
  run(ctx: EngineContext, input: Input): Promise<Omit<EngineOutcome<Meta>, 'telemetry' | 'error'>>;
}

/**
 * Run a media engine through the standardized lifecycle.
 *
 * Wraps the engine's `run` with the shared process: captures timing, normalizes
 * thrown errors into a structured failure outcome (never propagates), and
 * guarantees telemetry/cost/refs are always present. The worker hands its
 * engine + typed input here and is done.
 */
export async function runMediaEngine<Input, Meta>(
  engine: MediaEngine<Input, Meta>,
  ctx: EngineContext,
  input: Input,
): Promise<EngineOutcome<Meta>> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  try {
    const outcome = await engine.run(ctx, input);
    return {
      ...outcome,
      telemetry: {
        duration_ms: Date.now() - startTime,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      refs: {},
      cost_estimate: 0,
      telemetry: {
        duration_ms: Date.now() - startTime,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      },
      error: { code: 'MEDIA_ERROR', message, retryable: false },
    };
  }
}

/** Shared input type for engines that take a single text input (voice/subtitle). */
export interface TextEngineInput {
  text: string;
}

/** Common metadata for text-based engines carrying duration/cost identity. */
export interface TextEngineMeta {
  duration_seconds: number;
  voice_id?: string;
}
