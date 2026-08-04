---
title: "FYI Studio Engineering Standards"
version: "1.0"
status: "approved"
description: "Engineering standards ensuring uniform, predictable quality across all FYI Studio services. From Concept-9.md Part 2."
source_documents:
  - "Concept-9.md Part 2 (Engineering Standards v1.0: Naming Conventions, Error Handling, Idempotency, Logging, Testing, Dependency Management, PR Checklist)"
last_updated: "2026-08-04"
owner: "Lead Engineer"
---

# FYI Studio Engineering Standards v1.0

> **Design Philosophy**: These standards ensure that as we move from mock workers to real production code, the quality remains uniform and "boring" (predictable).

---

## 1. Naming Conventions

| Context | Convention | Examples |
|---------|------------|----------|
| **JSON / Database** | `snake_case` | `job_id`, `tenant_id`, `worker_version`, `cost_estimate` |
| **TypeScript Code** | `camelCase` for variables/functions | `buildEnvelope()`, `resolveInputMapping()`, `currentStepIndex` |
| **TypeScript Code** | `PascalCase` for Classes/Enums/Interfaces | `TaskEnvelope`, `WorkerResponse`, `JobStatus`, `ModelPolicy` |
| **Files** | `kebab-case.ts` | `script-worker.ts`, `supervisor-service.ts`, `contracts.ts` |
| **Environment Variables** | `UPPER_SNAKE_CASE` | `DATABASE_URL`, `REDIS_HOST`, `OPENAI_API_KEY` |
| **Git Branches** | `kebab-case` | `feature/script-worker`, `fix/telemetry-index`, `chore/deps-update` |

**Rationale**: 
- `snake_case` in JSON/DB ensures cross-language compatibility (Python, Go, Rust workers can consume without transformation)
- `camelCase`/`PascalCase` in TypeScript follows ecosystem conventions
- `kebab-case` files work consistently across all OSes and tooling

---

## 2. Error Handling Philosophy

### 2.1 Core Principles

| Principle | Description |
|-----------|-------------|
| **No Silent Failures** | Every `catch` block must log the error with the associated `job_id` and `execution_id`. |
| **Structured Errors** | Workers must never just "crash" (unhandled exception / process exit). They must catch their internal errors and return a `WorkerResponse` with `status: WorkerStatus.FAILURE` and a populated `WorkerError` object. |
| **Retry Logic Separation** | Workers do **not** retry themselves. They flag an error as `retryable: true`, and the Supervisor decides the backoff strategy (exponential backoff, max attempts, dead-letter queue). |

### 2.2 Worker Error Contract

```typescript
// From contracts.md - WorkerError interface
export interface WorkerError {
  code: string;           // Machine-readable error code (e.g., "RATE_LIMIT_EXCEEDED")
  message: string;        // Human-readable description
  retryable: boolean;     // Supervisor uses this to decide retry vs fail
  stack?: string;         // Optional: stack trace for debugging
}
```

### 2.3 Standard Error Codes

| Code | Category | Retryable | Description |
|------|----------|-----------|-------------|
| `RATE_LIMIT_EXCEEDED` | Provider | ✅ | Hit API rate limit; backoff and retry |
| `PROVIDER_UNAVAILABLE` | Provider | ✅ | 5xx from AI provider; retry with backoff |
| `INVALID_INPUT` | Input | ❌ | Payload validation failed; won't succeed on retry |
| `QUOTA_EXHAUSTED` | Provider | ❌ | Account limit reached; requires human intervention |
| `MODEL_ERROR` | Provider | ⚠️ | Model returned error; depends on specific error |
| `TIMEOUT` | Infrastructure | ✅ | Request timed out; retry may succeed |
| `SERIALIZATION_ERROR` | Internal | ❌ | Failed to serialize response; bug in worker |
| `UNKNOWN_ERROR` | Internal | ⚠️ | Catch-all; log and investigate |

### 2.4 Error Handling Pattern (Mandatory)

```typescript
// Every worker MUST follow this pattern
async function handleTask(envelope: TaskEnvelope): Promise<WorkerResponse> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();
  
  try {
    // 1. Validate input (optional but recommended)
    validateEnvelope(envelope);
    
    // 2. Do the work
    const result = await doWork(envelope);
    
    // 3. Build successful response
    return {
      contract_version: '1.1',
      job_id: envelope.job_id,
      execution_id: envelope.execution_id,
      worker_id: WORKER_ID,
      worker_version: WORKER_VERSION,
      status: WorkerStatus.SUCCESS,
      output: result.output,
      new_references: result.references,
      usage: result.usage,
      performance: {
        duration_ms: Date.now() - startTime,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    // 4. ALWAYS catch and return structured error response
    const workerError = normalizeError(error);
    
    logError(envelope.job_id, envelope.execution_id, workerError);
    
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
      performance: {
        duration_ms: Date.now() - startTime,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      },
      error: workerError,
    };
  }
}

function normalizeError(error: unknown): WorkerError {
  if (error instanceof ProviderRateLimitError) {
    return { code: 'RATE_LIMIT_EXCEEDED', message: error.message, retryable: true, stack: error.stack };
  }
  if (error instanceof ProviderUnavailableError) {
    return { code: 'PROVIDER_UNAVAILABLE', message: error.message, retryable: true, stack: error.stack };
  }
  if (error instanceof ValidationError) {
    return { code: 'INVALID_INPUT', message: error.message, retryable: false };
  }
  // ... other known errors
  
  // Unknown error - log fully, mark as potentially retryable
  return { 
    code: 'UNKNOWN_ERROR', 
    message: error instanceof Error ? error.message : String(error), 
    retryable: true, // Conservative default
    stack: error instanceof Error ? error.stack : undefined,
  };
}
```

---

## 3. Idempotency Rules

### 3.1 Core Rule

> **Every Worker execution must be idempotent based on the `execution_id`.**

### 3.2 Implementation Requirements

| Requirement | Implementation |
|-------------|----------------|
| **Deduplication** | If a worker receives an `execution_id` it has already processed, it must return the previous result instead of re-running expensive AI calls. |
| **Storage** | Workers must persist results keyed by `execution_id` (e.g., in Redis, local SQLite, or S3 metadata). |
| **Side Effects** | Any file written to S3/Local Storage must use a path containing the `execution_id` to prevent accidental overwrites. Example: `s3://bucket/jobs/{job_id}/{execution_id}/output.mp4` |
| **Deterministic Output** | Given the same `TaskEnvelope` (same `payload`, `references`, `policy`), the worker must produce the same `WorkerResponse.output`. |

### 3.3 Idempotency Pattern

```typescript
// Redis-backed idempotency check (example)
async function withIdempotency<T>(
  executionId: string,
  workFn: () => Promise<T>
): Promise<T> {
  const redisKey = `idempotency:${executionId}`;
  
  // Check for existing result
  const existing = await redis.get(redisKey);
  if (existing) {
    log.info({ executionId }, 'Returning cached idempotent result');
    return JSON.parse(existing);
  }
  
  // Execute work
  const result = await workFn();
  
  // Store result with TTL (e.g., 7 days)
  await redis.setex(redisKey, 60 * 60 * 24 * 7, JSON.stringify(result));
  
  return result;
}

// Usage in worker
const result = await withIdempotency(envelope.execution_id, async () => {
  // Actual AI call - only runs once per execution_id
  return await callAIProvider(envelope);
});
```

### 3.4 Supervisor Responsibility

- The Supervisor generates a new `execution_id` (UUID) for each attempt
- On retry, `attempt` increments but `execution_id` changes
- Workers treat each `execution_id` as a fresh request, but can optionally check for previous attempts of the same `job_id` + `step_id` for optimization

---

## 4. Logging Requirements

### 4.1 Structured Logging (Mandatory)

Every log message **must** include `job_id` and `execution_id` in a structured format (JSON logging).

```typescript
// Required fields in every log entry
interface LogEntry {
  timestamp: string;      // ISO-8601
  level: 'info' | 'warn' | 'error';
  message: string;
  job_id: string;
  execution_id: string;
  worker_id?: string;
  worker_version?: string;
  step_id?: string;
  capability?: string;
  duration_ms?: number;
  [key: string]: unknown; // Additional context
}
```

### 4.2 Log Levels

| Level | Use Case | Examples |
|-------|----------|----------|
| `INFO` | Standard lifecycle events | Worker started, Worker completed, Envelope received, Response sent |
| `WARN` | Non-fatal issues | High latency (> 5s), Retry attempt, Deprecated field used, Rate limit approaching |
| `ERROR` | Task failures | Worker returned failure, Unhandled exception caught, Database connection lost |

### 4.3 Logging Examples

```typescript
// Good: Structured with all required fields
logger.info({
  job_id: envelope.job_id,
  execution_id: envelope.execution_id,
  worker_id: WORKER_ID,
  worker_version: WORKER_VERSION,
  step_id: envelope.step_id,
  capability: envelope.capability,
  attempt: envelope.attempt,
}, 'Worker started processing');

// Good: Error with full context
logger.error({
  job_id: envelope.job_id,
  execution_id: envelope.execution_id,
  worker_id: WORKER_ID,
  error_code: error.code,
  error_message: error.message,
  retryable: error.retryable,
  stack: error.stack,
}, 'Worker failed');

// Bad: Missing job_id/execution_id
logger.info('Processing started'); // ❌ REJECTED
```

### 4.4 Implementation

Use a structured logger (e.g., `pino`, `winston` with JSON format). Configure once at worker startup:

```typescript
// logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
});

// Wrapper to enforce job_id/execution_id
export function createChildLogger(base: Record<string, unknown>) {
  return logger.child(base);
}
```

---

## 5. Testing Requirements

### 5.1 Contract Tests (Mandatory)

Every Worker must have a **Contract Test** that validates its output against the `@fyi/contracts` schema.

```typescript
// tests/contract.test.ts
import { WorkerResponse, WorkerStatus, TaskEnvelope } from '@fyi/contracts';
import { handleTask } from '../src/worker';

describe('Worker Contract Compliance', () => {
  const mockEnvelope: TaskEnvelope = {
    contract_version: '1.1',
    job_id: 'test-job-uuid',
    execution_id: 'test-exec-uuid',
    tenant_id: 'test-tenant',
    step_id: 'test-step',
    capability: 'text-synthesis:script',
    attempt: 1,
    policy: { provider: 'openai', model: 'gpt-4o', temperature: 0.7 },
    context: { brand_voice: 'professional', language: 'en', forbidden_terms: [] },
    payload: { topic: 'test' },
    references: {},
    started_at: new Date().toISOString(),
  };

  it('returns valid WorkerResponse on success', async () => {
    const response = await handleTask(mockEnvelope);
    
    // Validate required fields
    expect(response.contract_version).toBe('1.1');
    expect(response.job_id).toBe(mockEnvelope.job_id);
    expect(response.execution_id).toBe(mockEnvelope.execution_id);
    expect(response.worker_id).toBeDefined();
    expect(response.worker_version).toBeDefined();
    expect([WorkerStatus.SUCCESS, WorkerStatus.FAILURE]).toContain(response.status);
    expect(typeof response.output).toBe('object');
    expect(typeof response.new_references).toBe('object');
    expect(typeof response.usage.cost_estimate).toBe('number');
    expect(typeof response.performance.duration_ms).toBe('number');
    expect(response.performance.started_at).toBeDefined();
    expect(response.performance.finished_at).toBeDefined();
  });

  it('returns valid WorkerResponse with error on failure', async () => {
    // Mock a failure scenario
    const response = await handleTask({ ...mockEnvelope, payload: { invalid: true } });
    
    expect(response.status).toBe(WorkerStatus.FAILURE);
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBeDefined();
    expect(response.error?.message).toBeDefined();
    expect(typeof response.error?.retryable).toBe('boolean');
  });
});
```

### 5.2 Mocking External APIs

| Rule | Enforcement |
|------|-------------|
| **No real network calls** in unit tests | All external APIs (OpenAI, Anthropic, ElevenLabs, Perplexity, S3, Redis, PostgreSQL) must be mocked |
| **Use MSW or similar** for HTTP mocking | `msw` for REST APIs, custom mocks for SDKs |
| **Test latency simulation** | Mocks should simulate realistic latency and error rates |

```typescript
// tests/mocks/providers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // OpenAI chat completions
  http.post('https://api.openai.com/v1/chat/completions', () => {
    return HttpResponse.json({
      id: 'chatcmpl-test',
      choices: [{ message: { content: 'Test response' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });
  }),
  
  // ElevenLabs TTS
  http.post('https://api.elevenlabs.io/v1/text-to-speech/:voiceId', () => {
    return new HttpResponse(new Blob(['audio-data']), {
      headers: { 'Content-Type': 'audio/mpeg' },
    });
  }),
  
  // Rate limit simulation
  http.post('https://api.openai.com/v1/chat/completions', ({ request }) => {
    if (shouldSimulateRateLimit) {
      return new HttpResponse(JSON.stringify({ error: { message: 'Rate limit exceeded' } }), {
        status: 429,
        headers: { 'Retry-After': '60' },
      });
    }
  }),
];
```

### 5.3 Test Categories

| Category | Scope | Tools |
|----------|-------|-------|
| **Unit** | Single functions, pure logic | Vitest/Jest |
| **Contract** | Worker I/O matches `@fyi/contracts` | Vitest + schema validation |
| **Integration** | Worker + mocked external services | Vitest + MSW + Testcontainers (for DB/Redis) |
| **E2E** | Full pipeline: Supervisor → Queue → Worker → DB | Playwright / custom test harness |

### 5.4 Coverage Requirements

- **Minimum 80%** line coverage on worker code
- **100%** coverage on error handling paths (every `catch` block tested)
- **Contract tests** must pass in CI for every PR

---

## 6. Dependency Management

### 6.1 Minimalism

> **Question every new `npm install`. Prefer native Node.js capabilities where possible.**

| Prefer Native | Instead Of |
|---------------|------------|
| `fetch` (Node 18+) | `axios`, `node-fetch`, `got` |
| `crypto` | `uuid` (use `crypto.randomUUID()`) |
| `fs/promises` | `fs-extra` |
| `util.promisify` | `promisify` packages |
| `child_process` | `execa` (only if complex piping needed) |

### 6.2 Isolation

| Rule | Rationale |
|------|-----------|
| Workers should not share dependencies other than `@fyi/contracts` | Prevents version conflicts; each worker is independently deployable |
| Shared utilities → publish as `@fyi/utils` (if truly needed) | Explicit versioning, clear ownership |
| No monorepo `workspace:*` for runtime deps | Workers must be deployable as standalone containers |

### 6.3 Allowed Shared Dependencies

| Package | Purpose | Version Policy |
|---------|---------|----------------|
| `@fyi/contracts` | Type definitions | Pinned to exact version in each worker's `package.json` |
| `pino` | Structured logging | ^9.x (minor updates allowed) |
| `zod` | Runtime validation (optional) | ^3.x |
| `bullmq` | Queue client (Supervisor only) | ^5.x |

---

## 7. Pull Request (PR) Checklist

Every PR modifying a Worker or the Supervisor must satisfy:

```
- [ ] Does the code match the approved Contract version (currently v1.1)?
- [ ] Are all fields in the response following `snake_case` (JSON/DB)?
- [ ] Is there structured logging with `job_id` and `execution_id`?
- [ ] Is the worker stateless and idempotent (keyed by `execution_id`)?
- [ ] Is there a "Performance & Usage" report in the response (`usage` + `performance`)?
- [ ] Are all external API calls mocked in unit tests?
- [ ] Is there a Contract Test validating the WorkerResponse schema?
- [ ] Does the error handling follow the philosophy (no crashes, structured errors, retryable flag)?
- [ ] Are new dependencies justified and minimal?
- [ ] Is the worker version bumped (semver) in package.json?
- [ ] Does CI pass (lint, typecheck, unit, contract, integration tests)?
```

### 7.1 PR Review Focus Areas

| Reviewer | Focus |
|----------|-------|
| **Architect** | Contract compliance, schema changes, cross-worker compatibility |
| **SRE** | Logging, telemetry, idempotency, error handling, resource usage |
| **Peer** | Code clarity, test coverage, dependency choices, security |

---

## 8. Implementation Notes (Lead Engineer)

### 8.1 Why Enums Over String Unions?

> "I have intentionally used **Enums** in the contracts. While some prefer string unions, Enums provide a single place to change a value that ripples through the entire system, which is safer for a 'Microkernel' architecture."

### 8.2 TypeScript `unknown` vs `any`

- `Record<string, unknown>` forces consumers to validate/cast before use
- This is intentional friction—it prevents silent type assumptions
- Use Zod or similar for runtime validation at worker boundaries

### 8.3 Contract Version Field

The `contract_version: '1.1'` field on both `TaskEnvelope` and `WorkerResponse` enables:
- Runtime validation: Supervisor can reject incompatible envelopes
- Graceful degradation: Workers can handle multiple versions
- Migration path: v1.2 can be rolled out incrementally

---

## 9. Cross-References

| Document | Relation |
|----------|----------|
| `contracts.md` | TypeScript interfaces, SQL schemas, enums that these standards govern |
| `supervisor-design.md` | Supervisor implements retry logic, idempotency checks, logging standards |
| `sprint-planning.md` | Tickets for implementing each standard (linting, test templates, logging setup) |
| `worker-template.md` | Starter template for new workers with all standards built-in |