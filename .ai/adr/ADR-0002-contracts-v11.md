---
id: ADR-0002-contracts-v11
title: "Freeze Contracts v1.1 with Strict Enums & Execution Tracking"
status: "Accepted"
date: "2026-08-04"
deciders: ["Principal Architect", "Lead Engineer", "CTO"]
tags: [contracts, interfaces, types, versioning, task-envelope, worker-response]
source_conversation: "Concept-6.md, Concept-8.md, Concept-9.md Part 1"
---

# ADR-0002: Freeze Contracts v1.1 with Strict Enums & Execution Tracking

## Context

Contracts are the "Law" of FYI Studio — the structural boundaries governing all communication between Supervisor and Workers. Concept-6 established v1.0 contracts (TaskEnvelope, WorkerResponse, Job Ledger SQL, Production Recipe, Telemetry SQL). Concept-8/9 revised to v1.1 to be more defensive, traceable, and SRE-ready.

**Key v1.0 → v1.1 Changes Required:**
1. **Strict Enums** — Replace string literals with Enums to prevent "magic string" bugs
2. **Idempotency & Retries** — Add `execution_id` (unique per attempt) and `attempt` count
3. **Safer Typing** — Replace `any` with `Record<string, unknown>` to force validation/casting
4. **Telemetry Separation** — Separate `usage` (cost/tokens) from `performance` (latency/timestamps)
5. **Versioning** — Add `contract_version` field for future-proofing
6. **Worker Identity** — Add `worker_id` and `worker_version` for observability

## Decision

**Freeze Contracts v1.1 as the definitive contract version for MVP.** All Workers and Supervisor must implement exactly these interfaces.

### Core TypeScript Enums (v1.1)
```typescript
export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  WAITING_APPROVAL = 'waiting_approval',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum WorkerStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
}
```

### TaskEnvelope v1.1 (Input to Worker)
```typescript
export interface TaskEnvelope {
  contract_version: '1.1';
  job_id: string;           // UUID for whole production
  execution_id: string;     // UUID for THIS specific attempt
  tenant_id: string;
  step_id: string;
  capability: string;
  attempt: number;          // Starts at 1
  policy: ModelPolicy;
  context: TenantContext;
  payload: Record<string, unknown>;
  references: Record<string, string>;
  started_at: string;       // ISO-8601
}
```

### WorkerResponse v1.1 (Output from Worker)
```typescript
export interface WorkerResponse {
  contract_version: '1.1';
  job_id: string;
  execution_id: string;     // Must match input envelope
  worker_id: string;        // e.g., "script-worker-v2"
  worker_version: string;   // Semver
  status: WorkerStatus;
  output: Record<string, unknown>;
  new_references: Record<string, string>;
  usage: UsageMetrics;      // Cost/tokens only
  performance: PerformanceMetrics; // Latency/timing
  error?: WorkerError;      // Only when status === FAILURE
}
```

### Supporting Types
```typescript
export interface ModelPolicy {
  provider: string;
  model: string;
  temperature?: number;
  max_tokens?: number;
}

export interface TenantContext {
  brand_voice: string;
  language: string;
  forbidden_terms: string[];
  [key: string]: unknown;
}

export interface UsageMetrics {
  tokens_in?: number;
  tokens_out?: number;
  seconds?: number;
  cost_estimate: number;  // USD
}

export interface PerformanceMetrics {
  duration_ms: number;
  started_at: string;
  finished_at: string;
}

export interface WorkerError {
  code: string;
  message: string;
  retryable: boolean;
  stack?: string;
}
```

### Database Schema (PostgreSQL)

**Jobs Table (Job Ledger):**
```sql
CREATE TABLE jobs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    recipe_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    current_step_index INTEGER DEFAULT 0,
    recipe_snapshot JSONB NOT NULL,
    artifacts JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Telemetry Table:**
```sql
CREATE TABLE telemetry (
    id SERIAL PRIMARY KEY,
    job_id UUID REFERENCES jobs(id),
    execution_id VARCHAR(255) NOT NULL,
    worker_id VARCHAR(255) NOT NULL,
    worker_version VARCHAR(50) NOT NULL,
    provider VARCHAR(50),
    model VARCHAR(50),
    tokens_in INTEGER,
    tokens_out INTEGER,
    seconds INTEGER,
    cost NUMERIC(10, 6),
    duration_ms INTEGER,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Package Definition: `@fyi/contracts`
- **Responsibility:** Source of Truth for entire ecosystem
- **Contents:** TypeScript interfaces only — NO executable logic
- **Consumers:** Supervisor, All Workers, Database Layer
- **Build:** `tsc` → `dist/index.js` + `dist/index.d.ts`
- **Version:** 1.1.0 (matches `contract_version` field)

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **JSON Schema** | More verbose; requires compilation step to TS types; TS interfaces faster for MVP |
| **Protobuf/gRPC** | High setup overhead; difficult to inspect in logs/DB; JSON readability > micro-latency for MVP |
| **String Unions instead of Enums** | Enums provide single place to change value that ripples through system — safer for microkernel |
| **Keep `any` for payload** | `Record<string, unknown>` forces validation/casting — intentional friction prevents silent type assumptions |

## Consequences

### Positive
- **Compile-time schema validation** — Schema drift = build error, not runtime crash
- **Traceability** — `execution_id` + `attempt` enables exact retry tracking
- **SRE Observability** — Separated `usage` (cost) from `performance` (latency)
- **Worker Identity** — `worker_id` + `worker_version` enables debugging specific deployments
- **Future-Proof** — `contract_version` field enables runtime validation and graceful degradation

### Negative
- **Breaking change from v1.0** — All workers must be rebuilt (acceptable: no workers exist yet)
- **Verbose envelopes** — More fields per request (acceptable: observability value > payload size)
- **`unknown` requires casting** — Intentional friction; use Zod for runtime validation at boundaries

## Implementation Notes

1. **Package Location:** `/packages/contracts/` with `package.json`, `tsconfig.json`, `src/index.ts`
2. **Naming Convention:** All contract fields use `snake_case` (consistent with JSON/DB and external AI APIs)
3. **Version Policy:** Semantic versioning; `contract_version` field in envelope/response enables runtime checks
4. **Migration v1.0 → v1.1:** Not needed — v1.0 was design-only, no implementation exists yet
5. **Cross-References:** 
   - Engineering Standards v1.0 (ADR-0005) governs how workers implement these contracts
   - Supervisor Design (architecture/supervisor-design.md) implements the logic flow using these contracts

---

**Approval:** Principal Architect (defined), Lead Engineer (implemented v1.1), CTO (approved for MVP)