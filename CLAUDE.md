# FYI Studio — AI Operating System for Distributed Media Production

## Project Overview
Build an orchestration microkernel that abstracts LLMs, multi-modal generation engines, data stores, and distribution networks into a unified deterministic runtime for media production.

**Current Status:** Milestone 1 (Skeleton Run) — Sprint 1. All docs complete, ready for implementation.

## Tech Stack
- **Language:** TypeScript (ESM)
- **Runtime:** Node.js 20 LTS
- **Monorepo:** pnpm workspaces
- **Database:** PostgreSQL 15+ (via Prisma ORM)
- **Queue:** BullMQ + Redis 7+
- **Testing:** Vitest + MSW
- **Lint/Format:** Biome
- **Logging:** pino (JSON structured)

## Repository Structure (Target)
```
fyi-studio/
├── packages/
│   ├── contracts/     # @fyi/contracts (v1.1 frozen)
│   ├── database/      # @fyi/database (Prisma client)
│   ├── utils/         # @fyi/utils (shared: redis, logging)
│   └── cli/           # @fyi/cli (trigger-run)
├── services/
│   └── supervisor/    # Supervisor Kernel (Thin Orchestrator)
├── workers/
│   ├── research/      # Research Worker (mock → real)
│   ├── script/        # Script Worker (mock → real)
│   ├── voice/         # Voice Worker (mock → real)
│   ├── video/         # Video Composer (future)
│   └── subtitle/      # Subtitle Worker (future)
├── tests/
│   └── e2e/           # E2E test suite
├── docker-compose.yml # Postgres 15+ + Redis 7+
└── package.json       # Root workspace
```

## Architecture: MVP v1.0 (Thin Orchestrator)
- **Supervisor (Kernel):** Node.js + BullMQ (Redis) — job state machine, queue dispatching, context assembly
- **Workers (Sidecar Pattern):** Stateless adapters — `POST /execute` → `WorkerResponse`
- **Job Ledger:** PostgreSQL (Prisma) — source of truth: jobs, artifacts, status, recipes
- **Telemetry:** PostgreSQL — per-step cost, tokens, latency, provider
- **Data Plane:** S3/R2 (local `/tmp` for MVP) — binary assets via pointers only
- **Model Config:** `model_policy.yaml` + `ModelGate` — Capability → Provider mapping
- **Knowledge Base:** PostgreSQL `tenant_context` table — brand voice, constraints per channel

## Core Contracts v1.1 (Frozen — DO NOT MODIFY)

### Enums
```typescript
enum JobStatus { PENDING = 'pending', RUNNING = 'running', WAITING_APPROVAL = 'waiting_approval', COMPLETED = 'completed', FAILED = 'failed' }
enum WorkerStatus { SUCCESS = 'success', FAILURE = 'failure' }
```

### TaskEnvelope (Input to Worker)
```typescript
interface TaskEnvelope {
  contract_version: '1.1';
  job_id: string;           // UUID
  execution_id: string;     // UUID per attempt
  tenant_id: string;        // Channel/Brand ID
  step_id: string;          // Step in workflow
  capability: string;       // e.g. "text-synthesis:script"
  attempt: number;          // Starts at 1
  policy: { provider: string; model: string; temperature?: number; max_tokens?: number };
  context: { brand_voice: string; language: string; forbidden_terms: string[]; [key: string]: unknown };
  payload: Record<string, unknown>;
  references: Record<string, string>;  // S3 pointers
  started_at: string;       // ISO-8601
}
```

### WorkerResponse (Output from Worker)
```typescript
interface WorkerResponse {
  contract_version: '1.1';
  job_id: string;
  execution_id: string;
  worker_id: string;
  worker_version: string;
  status: WorkerStatus;
  output: Record<string, unknown>;
  new_references: Record<string, string>;
  usage: { tokens_in?: number; tokens_out?: number; seconds?: number; cost_estimate: number };
  performance: { duration_ms: number; started_at: string; finished_at: string };
  error?: { code: string; message: string; retryable: boolean; stack?: string };
}
```

### ProductionRecipe (DAG)
```typescript
interface ProductionRecipe {
  name: string;
  steps: { id: string; capability: string; worker_label: string; requires_approval: boolean; input_mapping: Record<string, string> }[];
}
```

### Job Ledger (PostgreSQL)
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

## Engineering Standards (Mandatory)

### Naming
- JSON/DB: `snake_case`
- TypeScript: `camelCase` (vars/fns), `PascalCase` (classes/enums/interfaces)
- Files: `kebab-case.ts`
- Env vars: `UPPER_SNAKE_CASE`

### Error Handling
- No silent failures — every catch logs `job_id` + `execution_id`
- Workers NEVER crash — always return `WorkerResponse` with `status: FAILURE` + `WorkerError`
- Workers do NOT retry themselves — set `retryable: boolean`, Supervisor handles backoff

### Idempotency
- Every worker execution must be idempotent based on `execution_id`
- If same `execution_id` received, return cached result
- Side effects use path containing `execution_id`

### Logging
- Every log line MUST include `job_id` and `execution_id`
- Use pino (JSON structured logging)
- Levels: INFO (lifecycle), WARN (non-fatal), ERROR (failures)

### Testing
- Contract tests mandatory for every worker (validate against `@fyi/contracts`)
- No real network calls in unit tests — use MSW
- Min 80% line coverage, 100% on error handling paths

### Dependencies
- Question every `npm install` — prefer native Node.js
- Workers share ONLY `@fyi/contracts` (pinned exact version)
- No `workspace:*` for runtime deps (workers must be standalone)

## Sprint 1: The Skeleton Run

**Goal:** Execute a single media production job through 3 mock workers (Research → Script → Voice) orchestrated by Supervisor.

### Issues (in order)
| ID | Task | Description | Est. |
|----|------|-------------|------|
| S1.1 | Workspace & Infra Init | Monorepo, Docker Compose (Postgres/Redis), @fyi/contracts | 4h |
| S1.2 | Database Layer | Prisma schema (jobs + telemetry), @fyi/database package | 4h |
| S1.3 | Mock Worker Suite | 3 stateless workers (Research, Script, Voice) | 6h |
| S1.4 | Supervisor Kernel | Core loop: state machine, queue dispatch, step-runner | 8h |
| S1.5 | Skeleton Run CLI | Trigger script to seed recipe + job, monitor progress | 3h |
| S1.6 | E2E Test Suite | Vitest integration test: full pipeline | 4h |

## Anti-Monster Policy
- Max 300 lines per file
- Strict Single Responsibility Principle
- Layering: Domain → Application → Infrastructure

## Governance
- Documentation First — no implementation without approved docs
- Contracts Frozen — v1.1 changes require ADR + all consumers rebuilt
- ADR Required — every architecture change needs an ADR
- PR Checklist enforced (see engineering-standards.md)
