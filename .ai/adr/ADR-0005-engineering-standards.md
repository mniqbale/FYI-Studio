---
id: ADR-0005-engineering-standards
title: "Adopt Engineering Standards v1.0"
status: "Accepted"
date: "2026-08-04"
deciders: ["Lead Engineer", "Principal Architect", "CTO"]
tags: [standards, engineering, naming, error-handling, idempotency, logging, testing, pr-checklist]
source_conversation: "Concept-9.md Part 2 (Engineering Standards v1.0)"
---

# ADR-0005: Adopt Engineering Standards v1.0

## Context

As we move from design to implementation (Milestone 1: Skeleton Run), we need uniform, predictable quality standards across all services. Concept-9 Part 2 established Engineering Standards v1.0 covering naming conventions, error handling philosophy, idempotency rules, logging requirements, testing requirements, dependency management, and PR checklist.

These standards ensure that as we move from mock workers to real production code, the quality remains uniform and "boring" (predictable).

## Decision

**Adopt Engineering Standards v1.0 as mandatory for all FYI Studio code.** Every PR must pass the PR Checklist.

---

## Standards Summary

### 1. Naming Conventions
| Context | Convention | Examples |
|---------|------------|----------|
| JSON / Database | `snake_case` | `job_id`, `tenant_id`, `worker_version`, `cost_estimate` |
| TypeScript variables/functions | `camelCase` | `buildEnvelope()`, `resolveInputMapping()`, `currentStepIndex` |
| TypeScript Classes/Enums/Interfaces | `PascalCase` | `TaskEnvelope`, `WorkerResponse`, `JobStatus`, `ModelPolicy` |
| Files | `kebab-case.ts` | `script-worker.ts`, `supervisor-service.ts`, `contracts.ts` |
| Environment Variables | `UPPER_SNAKE_CASE` | `DATABASE_URL`, `REDIS_HOST`, `OPENAI_API_KEY` |
| Git Branches | `kebab-case` | `feature/script-worker`, `fix/telemetry-index` |

**Rationale:** `snake_case` in JSON/DB ensures cross-language compatibility; `camelCase`/`PascalCase` in TS follows ecosystem conventions.

---

### 2. Error Handling Philosophy

#### Core Principles
| Principle | Description |
|-----------|-------------|
| **No Silent Failures** | Every `catch` block must log error with `job_id` and `execution_id` |
| **Structured Errors** | Workers never crash; return `WorkerResponse` with `status: FAILURE` and populated `WorkerError` |
| **Retry Logic Separation** | Workers flag `retryable: true`; Supervisor decides backoff strategy |

#### Standard Error Codes
| Code | Category | Retryable | Description |
|------|----------|-----------|-------------|
| `RATE_LIMIT_EXCEEDED` | Provider | ✅ | Hit API rate limit |
| `PROVIDER_UNAVAILABLE` | Provider | ✅ | 5xx from AI provider |
| `INVALID_INPUT` | Input | ❌ | Payload validation failed |
| `QUOTA_EXHAUSTED` | Provider | ❌ | Account limit reached |
| `MODEL_ERROR` | Provider | ⚠️ | Model returned error |
| `TIMEOUT` | Infrastructure | ✅ | Request timed out |
| `SERIALIZATION_ERROR` | Internal | ❌ | Failed to serialize response |
| `UNKNOWN_ERROR` | Internal | ⚠️ | Catch-all |

#### Mandatory Error Handling Pattern
```typescript
async function handleTask(envelope: TaskEnvelope): Promise<WorkerResponse> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();
  
  try {
    const result = await doWork(envelope);
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
```

---

### 3. Idempotency Rules

**Core Rule:** Every Worker execution must be idempotent based on `execution_id`.

| Requirement | Implementation |
|-------------|----------------|
| **Deduplication** | If worker receives `execution_id` already processed, return previous result |
| **Storage** | Persist results keyed by `execution_id` (Redis, SQLite, or S3 metadata) |
| **Side Effects** | S3 paths must include `execution_id`: `s3://bucket/jobs/{job_id}/{execution_id}/output.mp4` |
| **Deterministic Output** | Same `TaskEnvelope` → same `WorkerResponse.output` |

#### Redis-Backed Idempotency Pattern
```typescript
async function withIdempotency<T>(
  executionId: string,
  workFn: () => Promise<T>
): Promise<T> {
  const redisKey = `idempotency:${executionId}`;
  const existing = await redis.get(redisKey);
  if (existing) return JSON.parse(existing);
  
  const result = await workFn();
  await redis.setex(redisKey, 60 * 60 * 24 * 7, JSON.stringify(result)); // 7-day TTL
  return result;
}
```

**Supervisor Responsibility:** Generates new `execution_id` (UUID) for each attempt; increments `attempt` on retry.

---

### 4. Logging Requirements

#### Structured Logging (Mandatory)
Every log message **must** include `job_id` and `execution_id` in JSON format.

```typescript
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
  [key: string]: unknown;
}
```

#### Log Levels
| Level | Use Case | Examples |
|-------|----------|----------|
| `INFO` | Standard lifecycle | Worker started, completed, envelope received, response sent |
| `WARN` | Non-fatal issues | High latency (>5s), retry attempt, deprecated field, rate limit approaching |
| `ERROR` | Task failures | Worker returned failure, unhandled exception, DB connection lost |

#### Implementation: pino with Child Logger
```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: { level: (label) => ({ level: label }) },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
});

export function createChildLogger(base: Record<string, unknown>) {
  return logger.child(base);
}
```

---

### 5. Testing Requirements

#### Contract Tests (Mandatory)
Every Worker must have a Contract Test validating output against `@fyi/contracts` schema.

#### Mocking External APIs
| Rule | Enforcement |
|------|-------------|
| **No real network calls** in unit tests | All external APIs mocked (OpenAI, Anthropic, ElevenLabs, S3, Redis, Postgres) |
| **Use MSW** for HTTP mocking | `msw` for REST APIs, custom mocks for SDKs |
| **Test latency simulation** | Mocks simulate realistic latency and error rates |

#### Test Categories
| Category | Scope | Tools |
|----------|-------|-------|
| **Unit** | Single functions, pure logic | Vitest |
| **Contract** | Worker I/O matches `@fyi/contracts` | Vitest + schema validation |
| **Integration** | Worker + mocked external services | Vitest + MSW + Testcontainers |
| **E2E** | Full pipeline: Supervisor → Queue → Worker → DB | Vitest / custom harness |

#### Coverage Requirements
- **Minimum 80%** line coverage on worker code
- **100%** coverage on error handling paths (every `catch` block tested)
- **Contract tests** must pass in CI for every PR

---

### 6. Dependency Management

#### Minimalism
**Question every new `npm install`. Prefer native Node.js capabilities.**

| Prefer Native | Instead Of |
|---------------|------------|
| `fetch` (Node 18+) | `axios`, `node-fetch`, `got` |
| `crypto.randomUUID()` | `uuid` |
| `fs/promises` | `fs-extra` |
| `util.promisify` | `promisify` packages |

#### Isolation
| Rule | Rationale |
|------|-----------|
| Workers share only `@fyi/contracts` | Prevents version conflicts; independently deployable |
| Shared utilities → `@fyi/utils` package | Explicit versioning, clear ownership |
| No `workspace:*` for runtime deps | Workers deployable as standalone containers |

#### Allowed Shared Dependencies
| Package | Purpose | Version Policy |
|---------|---------|----------------|
| `@fyi/contracts` | Type definitions | Pinned exact version |
| `pino` | Structured logging | ^9.x |
| `zod` | Runtime validation (optional) | ^3.x |
| `bullmq` | Queue client (Supervisor only) | ^5.x |

---

### 7. Pull Request Checklist

Every PR modifying a Worker or Supervisor must satisfy:

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

#### PR Review Focus Areas
| Reviewer | Focus |
|----------|-------|
| **Architect** | Contract compliance, schema changes, cross-worker compatibility |
| **SRE** | Logging, telemetry, idempotency, error handling, resource usage |
| **Peer** | Code clarity, test coverage, dependency choices, security |

---

### 8. Implementation Notes

#### Why Enums Over String Unions?
> "Enums provide a single place to change a value that ripples through the entire system, which is safer for a 'Microkernel' architecture."

#### TypeScript `unknown` vs `any`
- `Record<string, unknown>` forces consumers to validate/cast before use
- Intentional friction — prevents silent type assumptions
- Use Zod for runtime validation at worker boundaries

#### Contract Version Field
The `contract_version: '1.1'` field enables:
- Runtime validation: Supervisor rejects incompatible envelopes
- Graceful degradation: Workers handle multiple versions
- Migration path: v1.2 rolled out incrementally

---

## Consequences

### Positive
- **Consistent quality** — "Boring" predictable code across all workers
- **Debuggable** — Structured logging + error codes = fast incident response
- **Safe retries** — Idempotency + Supervisor-controlled backoff = no duplicate costs
- **Testable** — Contract tests + mocking standards = reliable CI
- **Deployable** — Dependency isolation = independent container deployments

### Negative
- **Initial overhead** — Boilerplate for each worker (mitigated: worker template planned)
- **Strict friction** — `unknown` casting, enum usage (intentional: prevents bugs)
- **CI complexity** — Multiple test categories (mitigated: Vitest handles all)

---

## Cross-References
- [Contracts v1.1](../architecture/contracts.md) — Interfaces these standards govern
- [Supervisor Design](../architecture/supervisor-design.md) — Implements retry logic, idempotency checks
- [Sprint 1 Issues](../planning/sprints/Sprint-001/) — Tickets for implementing standards
- [Worker Template (Planned)](../prompts/roles/) — Starter template with all standards built-in