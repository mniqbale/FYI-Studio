---
id: glossary
title: "FYI Studio Glossary - Canonical Definitions"
owner: "Documentation Architect"
status: "active"
version: "1.0.0"
last_updated: "2026-08-04"
review_cycle: "per-sprint"
tags: [glossary, definitions, terminology, taxonomy]
related_documents:
  - "../architecture/architecture-manifesto.md"
  - "../architecture/contracts.md"
  - "../architecture/system-architecture.md"
---

# FYI Studio Glossary

> **Canonical definitions** — These terms have strict technical meanings within FYI Studio. Do not use loosely. From [Architecture Manifesto v1.0](../architecture/architecture-manifesto.md) Section 2.

---

## Core Taxonomy

```text
                  +------------------------+
                  |        WORKFLOW        | (Declarative DAG)
                  +-----------+------------+
                              |
                              v
                  +------------------------+
                  |          JOB           | (Stateful Instance)
                  +-----------+------------+
                              |
       +----------------------+----------------------+
       |                      |                      |
       v                      v                      v
+--------------+      +---------------+      +---------------+
|   CAPABILITY |      |    CONTEXT     |      | MODEL ROUTER  |
+-------+------+      +-------+-------+      +-------+-------+
        |                     |                      |
        v                     v                      v
+--------------+      +---------------+      +---------------+
|   WORKER     |      | KNOWLEDGE /   |      |   PROVIDER    |
|  (Plugin)    |      | MEMORY LAYER  |      |   (Adapter)   |
+--------------+      +---------------+      +---------------+
```

---

## Definitions

### Worker
A **Worker** is an isolated, stateless, single-purpose execution unit. It acts as an adapter between the FYI Studio Core and an external domain capability. A Worker possesses:
- No knowledge of other Workers
- No persistent business state
- Communication exclusively with the Core via standard payload envelopes

**Interface:** `POST /execute` accepting `TaskEnvelope`, returning `WorkerResponse`

**MVP Implementation:** Standalone web service (FastAPI/Express) deployed in container

---

### Capability
A **Capability** is an abstract functional interface declared within the OS (e.g., `capability:text-synthesis:scripting`, `capability:audio-synthesis:narration`). Capabilities define **what** needs to be done, completely isolated from **how** or **by whom** it is performed.

**Naming Convention:** `capability:<domain>:<specific-function>`

**Examples:**
- `capability:text-synthesis:research`
- `capability:text-synthesis:scripting`
- `capability:audio-synthesis:narration`
- `capability:video-synthesis:composition`
- `capability:image-synthesis:thumbnail`

---

### Workflow
A **Workflow** is a declarative, Directed Acyclic Graph (DAG) specifying the sequential, parallel, or conditional execution path of Capabilities required to produce a media asset. Workflows are stateless blueprints stored as data.

**Synonym:** Production Recipe

**Representation:** JSON/YAML with `steps[]` containing `id`, `capability`, `worker_label`, `requires_approval`, `input_mapping`

---

### Job
A **Job** is a stateful, trackable instantiation of a Workflow running against a specific payload, tenant context, and target platform. The Job is the unit of execution within the OS kernel.

**State Machine:** `PENDING` → `RUNNING` → `WAITING_APPROVAL` → `COMPLETED` | `FAILED`

**Persistence:** PostgreSQL `jobs` table (Job Ledger)

**Identity:** UUID `job_id` + `execution_id` per attempt

---

### Knowledge
**Knowledge** is the structural, factual, and stylistic truth of an organization or brand. It encompasses:
- Brand personas
- Verified facts
- Asset libraries
- Style guidelines
- Historical performance metrics

Knowledge is static or semi-static and resides permanently within the OS.

**MVP Storage:** PostgreSQL `tenant_context` table

---

### Memory
**Memory** is the transactional audit log and structural lineage of all past Job executions, system events, state transitions, and analytical outcomes. Memory enables the system to learn from past performance without mutating Worker logic.

**Storage:** PostgreSQL `telemetry` table + `jobs.artifacts` JSONB

**Key Distinction:** Knowledge = "what we know", Memory = "what we did and what happened"

---

### Context
**Context** is the ephemeral, hyper-focused payload assembled by the Core and injected into a Worker for the duration of a single Job step execution. Context is constructed by merging:
1. Relevant Knowledge fragments (brand voice, constraints)
2. Memory records (performance constraints, past outcomes)
3. Upstream Job step outputs (via `input_mapping`)

Context is **destroyed upon step completion**. Only structured outputs are written to the Job Ledger and Memory Layer.

**Just-In-Time Assembly Process:**
1. **Extraction:** Core evaluates Worker's explicit input schema requirements
2. **Retrieval:** Core queries Knowledge Layer + Memory Layer
3. **Pruning:** Core strips redundant prompts, irrelevant history, conversational bloat
4. **Injection:** Assembled Context Envelope dispatched to Worker
5. **Purge:** Context garbage-collected; only structured outputs persisted

---

## Contract Objects (from contracts.md v1.1)

### TaskEnvelope
The standard input for any Worker. Contains all data needed for a single step execution.

**Key Fields:**
- `contract_version: '1.1'`
- `job_id: string` (UUID)
- `execution_id: string` (UUID per attempt)
- `tenant_id: string`
- `step_id: string`
- `capability: string`
- `attempt: number` (starts at 1)
- `policy: ModelPolicy` (provider, model, temperature)
- `context: TenantContext` (brand_voice, language, forbidden_terms)
- `payload: Record<string, unknown>` (step-specific data)
- `references: Record<string, string>` (S3/R2 URIs)
- `started_at: string` (ISO-8601)

---

### WorkerResponse
The standard output from any Worker. Must match this structure exactly.

**Key Fields:**
- `contract_version: '1.1'`
- `job_id: string`
- `execution_id: string` (must match input)
- `worker_id: string` (e.g., "script-worker-v2")
- `worker_version: string` (semver)
- `status: WorkerStatus` (SUCCESS | FAILURE)
- `output: Record<string, unknown>` (actual result)
- `new_references: Record<string, string>` (new S3/R2 URIs created)
- `usage: UsageMetrics` (tokens_in, tokens_out, seconds, cost_estimate)
- `performance: PerformanceMetrics` (duration_ms, started_at, finished_at)
- `error?: WorkerError` (only when status === FAILURE)

---

### JobStatus (Enum)
```typescript
enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  WAITING_APPROVAL = 'waiting_approval',
  COMPLETED = 'completed',
  FAILED = 'failed',
}
```

---

### WorkerStatus (Enum)
```typescript
enum WorkerStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
}
```

---

## System Components

### Supervisor (Orchestrator / Kernel / CEO)
The central orchestration service. Responsibilities:
- Scheduling and Queue Management
- Orchestration & State Tracking
- Worker Discovery & Resolution
- Model Routing & Intent Resolution
- Context Assembly & Injection
- Policy & Cost Enforcement
- System Telemetry & Auditing
- Human-In-The-Loop Interrupts

**Must NEVER do:** Direct LLM logic, domain hardcoding, prompt hardcoding, media rendering, direct worker-to-worker comm, unstructured state retention.

---

### ModelGate
Internal utility that reads `model_policy.yaml` and resolves a Capability to a concrete `{provider, model, parameters}` tuple. Replaces the full Model Router service in MVP.

---

### Job Ledger
The `jobs` table in PostgreSQL. Source of truth for all Job state, artifacts, and recipe snapshots.

---

### Telemetry
The `telemetry` table in PostgreSQL. Per-execution cost, latency, token usage for SRE observability and cost intelligence.

---

### Data Plane (Reference Bus)
The mechanism for binary data transfer: Workers write to S3/R2 and return URIs. **No binary data ever travels through the Supervisor.**

---

### Production Recipe
A specific Workflow configuration for a channel/template. Defines the DAG of steps with `input_mapping` for data flow between steps.

---

## Architecture Layers (Manifesto Terminology)

| Layer | Components | Responsibility |
|-------|------------|----------------|
| **Application Layer** | Channel templates, YouTube Shorts, Documentaries, Podcasts | Business logic, user-facing products |
| **FYI Studio OS** | Workflow Engine, Model Router, Knowledge Layer, Worker Registry, Cost Intelligence, Job Ledger | Orchestration, policy, state, context |
| **Capability Adapters** | LLMs, Voice Synthesis, Renderers, Social APIs | External vendor integrations |

---

## Key Principles (Axioms from Manifesto)

| # | Axiom | Summary |
|---|-------|---------|
| 1 | **Workers Are Stateless Adapters** | No persistent state, fully idempotent, instant replaceability |
| 2 | **Providers Are Completely Replaceable** | No direct vendor refs in Core; behind Capability interfaces |
| 3 | **Execution Is Policy-Driven** | Model selection, retry, concurrency via policy engines |
| 4 | **Declarative Over Imperative** | Workflows, capabilities, brands, routing as data (JSON/YAML) |
| 5 | **Dual-Citizen Human/AI Integration** | Humans and AI Workers structurally identical execution resources |

---

## Tenets of Platform Design (11 Invariants)

1. **Everything is a Job** — Every execution unit is a managed, traceable, retryable Job
2. **Everything is a Worker** — Every cognitive/generative unit wrapped in standard interface
3. **Everything is a Capability** — Requestors demand Capabilities, never specific implementations
4. **Everything is a Plugin** — Core supplies only orchestration; all media capabilities hot-pluggable
5. **Everything is Observable** — Every token, ms, context, state transition structurally logged
6. **Everything is Replaceable** — Any component swappable without re-architecting
7. **Knowledge Belongs to the OS** — Workers own no memory; OS curates and injects
8. **Workers are Pure Functions over Context** — Same Context + deterministic model = same output
9. **Policies Drive Execution** — Cost, quality, latency dictate resource allocation dynamically
10. **Workflows are Versioned Blueprints** — Production pipelines are immutable, version-controlled
11. **Cost is a First-Class System Metric** — Financial consumption tracked with CPU/memory precision

---

## Naming Conventions (from Engineering Standards)

| Context | Convention | Example |
|---------|------------|---------|
| JSON/Database | `snake_case` | `job_id`, `tenant_id`, `cost_estimate` |
| TypeScript variables/functions | `camelCase` | `buildEnvelope()`, `currentStepIndex` |
| TypeScript Classes/Enums/Interfaces | `PascalCase` | `TaskEnvelope`, `WorkerResponse`, `JobStatus` |
| Files | `kebab-case.ts` | `script-worker.ts`, `supervisor-service.ts` |
| Environment Variables | `UPPER_SNAKE_CASE` | `DATABASE_URL`, `OPENAI_API_KEY` |
| Git Branches | `kebab-case` | `feature/script-worker`, `fix/telemetry-index` |

---

## Error Codes (Standard)

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

---

## Cross-References

- [Architecture Manifesto](../architecture/architecture-manifesto.md) — Source of axioms/tenets/taxonomy
- [Contracts v1.1](../architecture/contracts.md) — Full TypeScript interfaces + SQL schemas
- [Engineering Standards](../architecture/engineering-standards.md) — Error handling, logging, testing, PR checklist
- [MVP Architecture](../architecture/mvp-architecture.md) — Approved implementation architecture