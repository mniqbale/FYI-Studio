# FYI Studio Supervisor Design Documentation

**Status:** Living Architecture Document  
**Version:** 1.0.0  
**Source:** Synthesized from Concept-3 (Manifesto v1.0), Concept-4 (Manifesto Supervisor Critique), Concept-5 (MVP Supervisor Architecture), Concept-6 (Contracts & Schemas)  
**Scope:** Core Supervisor (Orchestrator/Kernel) design covering both the Manifesto vision and MVP implementation  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Core Responsibilities](#2-core-responsibilities)
3. [Must Never Belong To Core](#3-must-never-belong-to-core)
4. [System Invariants & Architectural Axioms](#4-system-invariants--architectural-axioms)
5. [Tenets of Platform Design](#5-tenets-of-platform-design)
6. [Supervisor Logic Flow](#6-supervisor-logic-flow)
7. [Step-Runner Logic](#7-step-runner-logic)
8. [Context Assembly](#8-context-assembly)
9. [Queue Dispatching](#9-queue-dispatching)
10. [Job Ledger Updates](#10-job-ledger-updates)
11. [Human-in-the-Loop Pause State](#11-human-in-the-loop-pause-state)
12. [Model Gate Utility](#12-model-gate-utility)
13. [Knowledge, Memory & Context Architecture](#13-knowledge-memory--context-architecture)
14. [The Thin Orchestrator Design](#14-the-thin-orchestrator-design)
15. [MVP Implementation Specifications](#15-mvp-implementation-specifications)
16. [Revised Roadmap](#16-revised-roadmap)

---

## 1. Executive Summary

FYI Studio is an **AI Operating System for Distributed Media Production** — not an application, wrapper, or automation script. It is an orchestration microkernel that abstracts raw cognitive compute (LLMs), multi-modal generation engines (Voice, Image, Video), data stores, and distribution networks into a unified, deterministic runtime.

### The Two Perspectives

| Aspect | **Manifesto Supervisor (Concept-3/4)** | **MVP Supervisor (Concept-5)** |
|--------|----------------------------------------|--------------------------------|
| Philosophy | Microkernel OS with Registry, Router, SDK, Cost Intelligence | "Thin Orchestrator" with BullMQ, Direct Config, Sidecar Workers |
| Worker Discovery | Capability-based Registry with `manifest.json` | Dictionary/Map of worker addresses (hardcoded list) |
| Model Routing | Policy-driven Model Router (Intent Pattern) | `model_policy.yaml` + `ModelGate` utility |
| Data Flow | Context Bus (risk of data gravity) | Reference Bus (S3 pointers only) |
| Human-in-the-Loop | Special Worker with `WAIT_FOR_SIGNAL` state | Job status `AWAITING_APPROVAL`, Dashboard UI |
| Observability | Cost Intelligence Layer, Billing Envelopes | Telemetry table, Loki/Datadog logs with `Job_ID` |
| Scope | Scale-up (100+ channels, multi-tenant) | Startup (1 channel, tenant-aware schema) |

**The Unifying Principle:** Both designs preserve the **Thin Orchestrator** — the Core does orchestration, state, and policy ONLY. All media logic, vendor logic, and prompt engineering live in Workers.

---

## 2. Core Responsibilities

The Supervisor (Core/Kernel/Orchestrator) owns **exactly** these responsibilities:

```
+-------------------------------------------------------------------------+
|                         CORE RESPONSIBILITIES                           |
|                                                                         |
|  * Scheduling and Queue Management     * Context Assembly & Injection   |
|  * Orchestration & State Tracking      * Policy & Cost Enforcement      |
|  * Worker Discovery & Resolution       * System Telemetry & Auditing    |
|  * Model Routing & Intent Resolution   * Human-In-The-Loop Interrupts   |
+-------------------------------------------------------------------------+
```

### Detailed Breakdown

| Responsibility | Manifesto Vision | MVP Implementation |
|----------------|------------------|-------------------|
| **Scheduling & Queue Management** | Workflow Engine executes declarative DAGs; priority queuing for Shorts vs Long-form | BullMQ (Redis) job persistence; Supervisor watches `jobs` table, pushes to queue |
| **Orchestration & State Tracking** | Central state machine; Job = stateful instance of Workflow | Job Ledger (PostgreSQL) = source of truth; `status`, `current_step_index`, `artifacts` |
| **Worker Discovery & Resolution** | Registry queries Capability → returns available Worker endpoint | Static `worker_map` in config; `POST /execute` endpoint standard |
| **Model Routing & Intent Resolution** | Model Router evaluates Policy (Budget, Quality, Priority) → selects Provider | `ModelGate` utility reads `model_policy.yaml` → returns `{provider, model, params}` |
| **Context Assembly & Injection** | JIT Context: Knowledge + Memory → Prune → Inject → Purge | Supervisor queries `tenant_context` table, merges with `artifacts`, builds `TaskEnvelope` |
| **Policy & Cost Enforcement** | Cost Intelligence Layer tracks per-Job USD; Quota Management | Telemetry table logs `tokens_in`, `tokens_out`, `cost`; `model_policy.yaml` encodes budget tiers |
| **System Telemetry & Auditing** | Everything observable: tokens, ms, context, state transitions | Centralized logs (Loki/Datadog); every log line includes `Job_ID` |
| **Human-In-The-Loop Interrupts** | HITL as Special Worker; `WAIT_FOR_SIGNAL` state; notifications | `requires_approval: true` in recipe → status `AWAITING_APPROVAL` → Dashboard "Resume" |

---

## 3. Must Never Belong To Core

**Architectural integrity depends on strict containment.** The following must NEVER exist in the Supervisor/Core:

```
+-------------------------------------------------------------------------+
|                     MUST NEVER BELONG TO THE CORE                       |
|                                                                         |
|  * Direct LLM/AI Provider Logic        * Unstructured State Retention   |
|  * Domain Hardcoding (e.g., "YouTube") * Direct Worker-to-Worker Comm   |
|  * Prompt Hardcoding                   * Media Rendering/Processing     |
+-------------------------------------------------------------------------+
```

### Violation Rejection Criteria (from Manifesto Governance)

Any design proposal that introduces the following shall be **rejected automatically**:

1. **Direct Worker-to-Worker Communication** — Workers communicate ONLY via Supervisor through envelopes
2. **Hardcoded External Vendor APIs in Core Logic** — Providers hidden behind Capability interfaces / ModelGate
3. **Worker State Persistence** — Workers are stateless adapters; state lives in Job Ledger
4. **Bypassing Policy-Driven Routing** — No `import openai` in Core; all model calls via ModelGate
5. **Media Rendering/Processing in Core** — FFmpeg, video composition, audio synthesis are Workers
6. **Prompt Hardcoding** — Prompts belong to Workers (System Prompts) or Knowledge Layer
7. **Domain Hardcoding** — "YouTube", "TikTok" logic lives in Publisher/Distribution Workers

---

## 4. System Invariants & Architectural Axioms

Every RFC, architectural change, and code commit must uphold these fundamental axioms:

### Axiom 1: Workers Are Stateless Adapters
> Workers must never store persistent state, local disk caches intended for multi-job re-use, or contextual business logic.
>
> **Why:** Statelessness guarantees that any Worker instance can be terminated, scaled, or replaced instantly without corrupting Job state. It eliminates side effects and makes worker execution fully idempotent.
>
> **MVP Nuance (Concept-5):** Workers **can have a Local Cache** for performance (e.g., Brand Asset Pack), but must treat every request as a new task. The cache is an optimization, not a correctness requirement.

### Axiom 2: Providers Are Completely Replaceable
> No direct references to external vendors (OpenAI, ElevenLabs, Anthropic) may exist within the Core or higher-level application logic. Providers exist only as pluggable execution targets hidden behind abstract Capability interfaces.
>
> **Why:** Vendor reliance creates systemic fragility. If a vendor changes pricing, throttles rate limits, or degrades model quality, the OS must re-route execution via configuration, not code modification.
>
> **MVP Implementation:** `model_policy.yaml` maps Capabilities → Providers. Workers call `ModelGate.getConfig(capability)`.

### Axiom 3: Execution Is Policy-Driven
> System decisions—model selection, retry strategy, concurrency limits, human approval gates—are determined dynamically at runtime by policy engines evaluating system state, budget, and brand configuration.
>
> **Why:** Hardcoded operational rules prevent multi-tenant flexibility. A high-budget flagship brand and an automated low-cost channel must run on the exact same architecture, differentiated entirely by policies.
>
> **MVP Implementation:** `model_policy.yaml` + `recipe.requires_approval` + BullMQ retry config.

### Axiom 4: Declarative Over Imperative
> Workflows, capabilities, brand identities, and routing rules must be expressed declaratively as structured configurations (JSON/YAML), never imperatively in procedural application code.
>
> **Why:** Declarative systems allow non-engineers or higher-level AI agents to generate, modify, validate, and optimize production workflows programmatically.
>
> **MVP Implementation:** `ProductionRecipe` (JSON/DAG), `model_policy.yaml`, `tenant_context` (SQL/JSON).

### Axiom 5: Dual-Citizen Human/AI Integration
> The platform architecture must treat human operators and AI Workers as structurally identical execution resources. A step in a Workflow requires a Capability; whether that Capability is fulfilled by an automated Worker or a Human-In-The-Loop approval interface is an execution detail managed by policy.
>
> **Why:** Scaling from full human oversight to full autonomy requires a spectrum, not a binary switch. Systems must support seamless transition along this spectrum per brand, per step, and per budget constraint.
>
> **MVP Implementation:** `requires_approval: boolean` in recipe step; same `TaskEnvelope` structure; Dashboard writes to `Job Ledger.artifacts`.

---

## 5. Tenets of Platform Design

The design of FYI Studio is anchored in **eleven inviolable tenets**:

1. **Everything is a Job:** Every execution unit — from a 10-hour documentary build to a 5-second metadata generation — is encapsulated as a managed, traceable, and retryable Job.
2. **Everything is a Worker:** Every cognitive or generative execution unit is wrapped in a standard Worker interface (`POST /execute`).
3. **Everything is a Capability:** System requestors demand Capabilities (e.g., `text-synthesis:script`), never specific implementations or specific models.
4. **Everything is a Plugin:** The Core supplies only orchestration, state, and policy primitives. All media capabilities are hot-pluggable extensions.
5. **Everything is Observable:** Every token spent, millisecond elapsed, context injected, state transitioned, and payload returned must be structurally logged and queryable.
6. **Everything is Replaceable:** Any component — from a model vendor to a database store or a worker plugin — can be swapped without re-architecting the system.
7. **Knowledge Belongs to the Operating System:** Workers own no memory. The OS curates, filters, and passes precise Knowledge slices to Workers via Just-In-Time Context Assembly.
8. **Workers are Pure Functions over Context:** Given identical Context payloads and deterministic models, a Worker must yield functionally equivalent outputs.
9. **Policies Drive Execution:** Operational parameters (cost thresholds, quality scores, latency targets) dictate resource allocation dynamically.
10. **Workflows are Versioned Blueprints:** Production pipelines are immutable, version-controlled artifacts (`recipe_snapshot` in Job Ledger).
11. **Cost is a First-Class System Metric:** Financial consumption is tracked with the same precision and immediacy as CPU cycles or memory allocation.

---

## 6. Supervisor Logic Flow

The Supervisor's main execution loop (the "Kernel"):

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SUPERVISOR MAIN LOOP                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. POLL JOB LEDGER                                                      │
│    SELECT * FROM jobs WHERE status IN ('pending', 'running')            │
│    AND current_step_index < jsonb_array_length(recipe_snapshot->'steps')│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. FOR EACH JOB: RESOLVE NEXT STEP                                      │
│    step = recipe_snapshot.steps[job.current_step_index]                 │
│    capability = step.capability                                         │
│    worker_label = step.worker_label                                     │
│    requires_approval = step.requires_approval                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. ASSEMBLE CONTEXT (see Section 8)                                     │
│    context = assemble_context(job, step)                                │
│    references = extract_references(job.artifacts, step.input_mapping)   │
│    model_policy = ModelGate.get_config(capability)                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. BUILD TASK ENVELOPE                                                  │
│    envelope = {                                                         │
│      job_id: job.id,                                                    │
│      tenant_id: job.tenant_id,                                          │
│      step_id: step.id,                                                  │
│      capability: capability,                                            │
│      policy: model_policy,                                              │
│      payload: build_payload(job.artifacts, step.input_mapping),         │
│      references: references,                                            │
│      context: context                                                   │
│    }                                                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. DISPATCH TO QUEUE (see Section 9)                                    │
│    queue = get_queue(worker_label)                                      │
│    await queue.add(envelope)                                            │
│    UPDATE jobs SET status='running' WHERE id=job.id                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 6. WAIT FOR WORKER RESPONSE (async, via BullMQ completion)              │
│    response = await wait_for_completion(job.id, step.id)                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        ┌───────────────────────┐         ┌───────────────────────┐
        │ SUCCESS               │         │ FAILURE               │
        └───────────────────────┘         └───────────────────────┘
                    │                               │
                    ▼                               ▼
        ┌───────────────────────┐         ┌───────────────────────┐
        │ 7a. UPDATE JOB LEDGER │         │ 7b. HANDLE FAILURE    │
        │    (see Section 10)   │         │    - Retry per policy │
        │    - artifacts merge  │         │    - Dead letter if   │
        │    - step_index++     │         │      max retries      │
        │    - Check approval   │         │    - Alert SRE        │
        └───────────────────────┘         └───────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ 8. CHECK APPROVAL     │
        │    IF step.requires   │
        │       approval AND    │
        │       NOT approved:   │
        │       status =        │
        │       'awaiting_      │
        │       approval'       │
        │       PAUSE (Section 11)│
        └───────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ 9. LOOP OR COMPLETE   │
        │    IF more steps:     │
        │       GOTO 2          │
        │    ELSE:              │
        │       status =        │
        │       'completed'     │
        └───────────────────────┘
```

### Pseudocode: Supervisor Kernel

```typescript
// supervisor/kernel.ts
class Supervisor {
  private bullmq: Queue[];
  private pg: Pool;
  private modelGate: ModelGate;
  private workerMap: Map<string, WorkerConfig>;

  async run(): Promise<void> {
    while (true) {
      const jobs = await this.fetchRunnableJobs();
      
      for (const job of jobs) {
        await this.processJob(job);
      }
      
      await this.sleep(POLL_INTERVAL_MS);
    }
  }

  private async processJob(job: JobRow): Promise<void> {
    const recipe = job.recipe_snapshot as ProductionRecipe;
    const step = recipe.steps[job.current_step_index];
    
    // 1. Resolve model policy
    const policy = this.modelGate.getConfig(step.capability);
    
    // 2. Assemble context
    const context = await this.assembleContext(job, step);
    const references = this.extractReferences(job.artifacts, step.input_mapping);
    const payload = this.buildPayload(job.artifacts, step.input_mapping);
    
    // 3. Build envelope
    const envelope: TaskEnvelope = {
      job_id: job.id,
      tenant_id: job.tenant_id,
      step_id: step.id,
      capability: step.capability,
      policy,
      payload,
      references,
      context
    };
    
    // 4. Dispatch
    const queue = this.getQueue(step.worker_label);
    await queue.add(`step-${step.id}`, envelope);
    
    // 5. Update status to running
    await this.pg.query(
      `UPDATE jobs SET status='running', updated_at=NOW() WHERE id=$1`,
      [job.id]
    );
    
    // 6. Response handling is async via BullMQ worker process
    //    See: step-runner.ts for completion logic
  }
}
```

---

## 7. Step-Runner Logic

The Step-Runner is the **completion handler** — it runs when a Worker finishes and BullMQ marks the job complete. It is the "other half" of the Supervisor loop.

### Responsibilities

1. Receive `WorkerResponse` from BullMQ completion event
2. Validate response structure (enforce contract)
3. Merge `output` + `new_references` into Job `artifacts`
4. Log telemetry (tokens, cost, duration)
5. Increment `current_step_index`
6. Check for `requires_approval` → pause if needed
7. If no more steps → mark `completed`
8. If failure → handle retry / dead letter

### Pseudocode: Step Runner

```typescript
// supervisor/step-runner.ts
class StepRunner {
  async handleCompletion(jobId: string, stepId: string, response: WorkerResponse): Promise<void> {
    const client = await this.pg.connect();
    
    try {
      await client.query('BEGIN');
      
      // 1. Fetch current job state
      const jobResult = await client.query(
        `SELECT * FROM jobs WHERE id=$1 FOR UPDATE`,
        [jobId]
      );
      const job = jobResult.rows[0];
      const recipe = job.recipe_snapshot as ProductionRecipe;
      const step = recipe.steps.find(s => s.id === stepId);
      
      // 2. Validate response
      if (response.status === 'failure') {
        await this.handleFailure(client, job, step, response);
        await client.query('COMMIT');
        return;
      }
      
      // 3. Merge artifacts
      const newArtifacts = {
        ...job.artifacts,
        [stepId]: response.output
      };
      
      // 4. Merge references (S3 pointers)
      const newReferences = {
        ...job.artifacts._references,
        ...response.new_references
      };
      newArtifacts._references = newReferences;
      
      // 5. Log telemetry
      await this.logTelemetry(client, jobId, stepId, response);
      
      // 6. Check approval gate
      const nextStepIndex = job.current_step_index + 1;
      const isLastStep = nextStepIndex >= recipe.steps.length;
      const requiresApproval = step.requires_approval;
      
      let newStatus = 'running';
      if (requiresApproval) {
        newStatus = 'awaiting_approval';
      } else if (isLastStep) {
        newStatus = 'completed';
      }
      
      // 7. Update job
      await client.query(
        `UPDATE jobs 
         SET artifacts=$1, current_step_index=$2, status=$3, updated_at=NOW()
         WHERE id=$4`,
        [JSON.stringify(newArtifacts), nextStepIndex, newStatus, jobId]
      );
      
      await client.query('COMMIT');
      
      // 8. If approved or no approval needed, trigger next step
      if (newStatus === 'running' || newStatus === 'completed') {
        // Supervisor main loop will pick it up on next poll
        // OR we can proactively push a signal
        await this.signalNextStep(jobId);
      }
      
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  
  private async handleFailure(
    client: PoolClient, 
    job: JobRow, 
    step: RecipeStep, 
    response: WorkerResponse
  ): Promise<void> {
    const retryPolicy = this.getRetryPolicy(step.capability);
    const attempt = (job.artifacts._attempts?.[step.id] || 0) + 1;
    
    if (attempt <= retryPolicy.max_attempts && response.error?.retryable) {
      // Schedule retry with backoff
      const delay = retryPolicy.base_delay_ms * Math.pow(2, attempt - 1);
      await this.scheduleRetry(job.id, step.id, delay);
      
      await client.query(
        `UPDATE jobs SET artifacts=jsonb_set(artifacts, '{_attempts, $1}', $2) WHERE id=$3`,
        [step.id, JSON.stringify(attempt), job.id]
      );
    } else {
      // Dead letter
      await client.query(
        `UPDATE jobs SET status='failed', updated_at=NOW() WHERE id=$1`,
        [job.id]
      );
      await this.alertSRE(job.id, step.id, response.error);
    }
  }
}
```

---

## 8. Context Assembly

**Just-In-Time (JIT) Context Assembly** — the Core constructs a minimal, hyper-focused `Context Envelope` for each Worker step.

### Three-Tier Architecture (Manifesto)

```
+--------------------------------------------------------------------------+
||                             KNOWLEDGE LAYER                              ||
||   (Brand Profiles, Style Guides, Verified Facts, Asset Libraries)        ||
+--------------------------------------------------------------------------+
                                     |
                                     | Select Flushed Snippets
                                     v
+--------------------------------------------------------------------------+
||                              MEMORY LAYER                                ||
||   (Historical Performance, Historical Edits, Audience Analytics)         ||
+--------------------------------------------------------------------------+
                                     |
                                     | Filter via Policy Engine
                                     v
+--------------------------------------------------------------------------+
||                          JUST-IN-TIME CONTEXT                            ||
||   (Minimal JSON Envelope injected into stateless Worker step)             ||
+--------------------------------------------------------------------------+
```

### Assembly Process (5 Steps)

1. **Extraction:** Core evaluates Worker's explicit input schema requirements (from `step.input_mapping`)
2. **Retrieval:** Core queries **Knowledge Layer** for relevant brand/factual fragments and **Memory Layer** for performance constraints or past step outcomes
3. **Pruning:** Core strips redundant system prompts, irrelevant historical turns, and conversational bloat
4. **Injection:** Assembled **Context Envelope** dispatched to target Worker via `TaskEnvelope.context`
5. **Purge:** Once Worker returns response, Context Envelope is garbage-collected. Only structured outputs written to Job Ledger and Memory Layer.

### MVP Implementation (Concept-5)

```typescript
// supervisor/context-assembler.ts
class ContextAssembler {
  async assemble(job: JobRow, step: RecipeStep): Promise<TaskContext> {
    // 1. Fetch tenant context (Knowledge Layer - MVP: PostgreSQL table)
    const tenantCtx = await this.pg.query(
      `SELECT brand_voice, language, forbidden_terms, style_guide 
       FROM tenant_context WHERE tenant_id=$1`,
      [job.tenant_id]
    );
    
    // 2. Fetch relevant memory (Memory Layer - MVP: recent job analytics)
    //    Only if step capability benefits from historical performance
    let memoryCtx = {};
    if (this.shouldInjectMemory(step.capability)) {
      memoryCtx = await this.fetchRelevantMemory(job.tenant_id, step.capability);
    }
    
    // 3. Extract upstream artifacts per input_mapping
    const upstreamData = this.extractUpstreamData(job.artifacts, step.input_mapping);
    
    // 4. Prune: Keep only what the Worker's schema declares it needs
    const prunedContext = this.pruneForWorker(step.capability, {
      ...tenantCtx.rows[0],
      ...memoryCtx,
      ...upstreamData
    });
    
    return prunedContext;
  }
  
  private pruneForWorker(capability: string, raw: any): TaskContext {
    // Worker declares its context schema via capability manifest
    // Core only injects declared fields
    const schema = CAPABILITY_CONTEXT_SCHEMAS[capability] || DEFAULT_CONTEXT_SCHEMA;
    return pick(raw, Object.keys(schema.properties));
  }
}
```

### Context Envelope Structure (from Concept-6)

```typescript
interface TaskContext {
  brand_voice: string;
  language: string;
  forbidden_terms: string[];
  // Capability-specific fields injected here
  // e.g., for scripting: { target_duration_sec, platform, hook_style }
}
```

---

## 9. Queue Dispatching

### Manifesto Vision
- BullMQ (Redis-backed) or Temporal.io for long-running task support
- Priority queuing: High-priority "Shorts" bypass "Long-form" backlog
- Workflow as Code: handles retries and state persistence even if server restarts

### MVP Implementation (Concept-5)

**BullMQ with Redis** — single queue per worker type (or priority lanes)

```typescript
// supervisor/queue-dispatcher.ts
class QueueDispatcher {
  private queues: Map<string, Queue> = new Map();
  
  constructor(private redis: Redis) {
    // Initialize queues for each worker label
    for (const [label, config] of Object.entries(WORKER_CONFIGS)) {
      this.queues.set(label, new Queue(label, { connection: this.redis }));
    }
  }
  
  async dispatch(envelope: TaskEnvelope, workerLabel: string): Promise<void> {
    const queue = this.queues.get(workerLabel);
    if (!queue) {
      throw new Error(`No queue for worker: ${workerLabel}`);
    }
    
    // Priority: approval steps get high priority to unblock humans
    const priority = envelope.payload._requires_approval ? 10 : 5;
    
    await queue.add(`execute-${envelope.step_id}`, envelope, {
      priority,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 }
    });
  }
  
  // Worker processes register handlers
  registerWorker(workerLabel: string, handler: (job: Job) => Promise<WorkerResponse>) {
    const queue = this.queues.get(workerLabel);
    queue.process(async (job) => {
      const response = await handler(job.data);
      return response; // BullMQ stores this as job.returnvalue
    });
  }
}
```

### Worker Sidecar Pattern (Concept-5)

Each Worker is a **standalone web service** (FastAPI/Express) deployed in a container:

```
┌─────────────────┐     POST /execute      ┌─────────────────┐
│   Supervisor    │ ─────────────────────► │   Worker        │
│   (BullMQ)      │                        │   (Sidecar)     │
└─────────────────┘ ◄────────────────────── │                 │
       ▲                                      │  - Receives    │
       │         WorkerResponse               │    TaskEnvelope│
       │                                      │  - Calls       │
       │         (via BullMQ                  │    ModelGate   │
       │          completion)                 │  - Executes    │
       │                                      │  - Returns     │
       │                                      │    WorkerResp  │
       └──────────────────────────────────────┘                 │
```

**Standard Interface:** Every Worker **must** have one endpoint: `POST /execute`

```typescript
// Worker contract (Concept-6)
interface TaskEnvelope {  // Input
  job_id: string;
  tenant_id: string;
  step_id: string;
  capability: string;
  policy: { provider: string; model: string; temperature: number };
  payload: Record<string, any>;
  references: Record<string, string>;  // S3 URIs
  context: TaskContext;
}

interface WorkerResponse {  // Output
  job_id: string;
  status: "success" | "failure";
  output: Record<string, any>;
  new_references: Record<string, string>;  // S3 URIs
  usage: { tokens_in?: number; tokens_out?: number; seconds?: number; cost_estimate: number };
  error?: { code: string; message: string; retryable: boolean };
}
```

---

## 10. Job Ledger Updates

The **Job Ledger** (PostgreSQL) is the "Source of Truth" for the entire OS.

### Schema (Concept-6)

```sql
CREATE TABLE jobs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    recipe_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', 
    -- 'pending', 'running', 'awaiting_approval', 'completed', 'failed'
    current_step_index INTEGER DEFAULT 0,
    
    -- Snapshot of the full recipe for historical auditing
    recipe_snapshot JSONB NOT NULL, 
    
    -- The "Memory" of the job: cumulative outputs of all workers
    artifacts JSONB DEFAULT '{}', 
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE telemetry (
    id SERIAL PRIMARY KEY,
    job_id UUID REFERENCES jobs(id),
    worker_id VARCHAR(255),
    provider VARCHAR(50),
    model VARCHAR(50),
    tokens_in INTEGER,
    tokens_out INTEGER,
    duration_ms INTEGER,
    cost NUMERIC(10, 6),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Artifacts Structure

```json
{
  "research_worker": { "summary": "...", "sources": [...] },
  "script_worker": { "script": "...", "scenes": [...] },
  "voice_worker": { "audio_url": "s3://...", "duration_sec": 45 },
  "_references": {
    "raw_audio_url": "s3://bucket/audio.mp3",
    "generated_video_url": "s3://bucket/vid.mp4"
  },
  "_attempts": {
    "script_worker": 1
  }
}
```

### Update Operations

| Trigger | Operation | SQL Pattern |
|---------|-----------|-------------|
| Job created | Insert | `INSERT INTO jobs (id, tenant_id, recipe_id, recipe_snapshot) VALUES ...` |
| Step dispatched | Status → `running` | `UPDATE jobs SET status='running', updated_at=NOW() WHERE id=$1` |
| Step succeeded | Merge artifacts, increment step | `UPDATE jobs SET artifacts=jsonb_set(...), current_step_index=..., status=...` |
| Step failed | Increment attempt, schedule retry or fail | `UPDATE jobs SET artifacts=jsonb_set(artifacts, '{_attempts,step}', ...)` |
| Human approval | Status → `awaiting_approval` | `UPDATE jobs SET status='awaiting_approval' WHERE id=$1` |
| Human resumes | Status → `running` | `UPDATE jobs SET status='running' WHERE id=$1` |
| Job complete | Status → `completed` | `UPDATE jobs SET status='completed', updated_at=NOW() WHERE id=$1` |

---

## 11. Human-in-the-Loop Pause State

### Manifesto Vision (Axiom 5 + HITL Design)
- Treat Human Approval as a **Special Worker** (Dual-Citizen integration)
- Workflow Engine enters `WAIT_FOR_SIGNAL` state
- Sends notification (Slack/Dashboard), saves state, pauses Job
- Provides "Quality Gates" — CEO doesn't publish until Owner signs off

### MVP Implementation (Concept-5)

**Pause State Machine:**

```
┌─────────────┐     step.requires_approval      ┌──────────────────┐
│  RUNNING    │ ──────────────────────────────► │ AWAITING_APPROVAL│
└─────────────┘                                 └────────┬─────────┘
                                                         │
                              Human clicks "Resume"      │
                              (Dashboard writes          │
                               to Job Ledger)            │
                                                         ▼
                                                  ┌─────────────┐
                                                  │   RUNNING   │
                                                  │ (next step) │
                                                  └─────────────┘
```

### Implementation Details

1. **Recipe Declaration:**
   ```json
   {
     "steps": [
       { "id": "script", "capability": "text-synthesis:script", "requires_approval": true },
       { "id": "voice", "capability": "audio-synthesis:narration", "requires_approval": false }
     ]
   }
   ```

2. **Supervisor Logic (in Step-Runner):**
   ```typescript
   if (step.requires_approval) {
     await client.query(
       `UPDATE jobs SET status='awaiting_approval' WHERE id=$1`,
       [jobId]
     );
     // Job pauses here. Supervisor main loop SKIPS jobs with this status.
     await this.notifyHuman(jobId, stepId, response.output);
     return;
   }
   ```

3. **Dashboard "Resume" Action:**
   ```typescript
   // POST /api/jobs/:id/approve
   async function approveJob(req, res) {
     const { job_id, step_id, edited_output } = req.body;
     
     await pg.query('BEGIN');
     
     // 1. Update artifacts with human edits (if any)
     const job = await pg.query(`SELECT * FROM jobs WHERE id=$1`, [job_id]);
     const artifacts = { ...job.artifacts, [step_id]: edited_output || job.artifacts[step_id] };
     
     // 2. Resume
     await pg.query(
       `UPDATE jobs SET artifacts=$1, status='running', updated_at=NOW() WHERE id=$2`,
       [JSON.stringify(artifacts), job_id]
     );
     
     await pg.query('COMMIT');
     res.json({ success: true });
   }
   ```

4. **State Persistence:** No open connections held. Job can sleep for **days** in `awaiting_approval`. Supervisor poller simply skips it.

---

## 12. Model Gate Utility

### Manifesto Vision: Model Router (Policy-Based Dispatcher)
- Workers request **Profiles** (e.g., `CREATIVE_LONG_FORM`), not models
- Router evaluates: Budget, Priority, Quality → selects Provider
- Decouples system from OpenAI/Google/Anthropic

### MVP Implementation: ModelGate + model_policy.yaml (Concept-5)

**model_policy.yaml** — The "Poor Man's Router"
```yaml
# model_policy.yaml
capabilities:
  text-synthesis:script:
    provider: "openai"
    model: "gpt-4o"
    temperature: 0.7
    max_tokens: 4000
    tier: "premium"
  
  text-synthesis:summarize:
    provider: "anthropic"
    model: "claude-3-haiku"
    temperature: 0.3
    max_tokens: 1000
    tier: "economy"
  
  audio-synthesis:narration:
    provider: "elevenlabs"
    model: "eleven_multilingual_v2"
    voice_id: "rachel"
    tier: "standard"
  
  image-synthesis:thumbnail:
    provider: "openai"
    model: "dall-e-3"
    quality: "hd"
    tier: "premium"

# Budget tiers (enforced by Supervisor)
tiers:
  premium:
    max_cost_per_job_usd: 5.00
    allowed_for: ["flagship_brand"]
  standard:
    max_cost_per_job_usd: 1.00
    allowed_for: ["standard_brand"]
  economy:
    max_cost_per_job_usd: 0.10
    allowed_for: ["high_volume_brand"]
```

**ModelGate Utility:**
```typescript
// supervisor/model-gate.ts
class ModelGate {
  private config: ModelPolicyConfig;
  
  constructor(configPath: string) {
    this.config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  }
  
  getConfig(capability: string, tenantTier?: string): ModelConfig {
    const capabilityConfig = this.config.capabilities[capability];
    if (!capabilityConfig) {
      throw new Error(`No model policy for capability: ${capability}`);
    }
    
    // Tier enforcement (MVP: simple check)
    if (tenantTier && this.config.tiers[capabilityConfig.tier]) {
      const tier = this.config.tiers[capabilityConfig.tier];
      if (!tier.allowed_for.includes(tenantTier)) {
        // Fallback to economy
        return this.getFallbackConfig(capability);
      }
    }
    
    return {
      provider: capabilityConfig.provider,
      model: capabilityConfig.model,
      temperature: capabilityConfig.temperature ?? 0.7,
      max_tokens: capabilityConfig.max_tokens,
      // Pass through any extra params
      ...omit(capabilityConfig, ['provider', 'model', 'temperature', 'max_tokens', 'tier'])
    };
  }
  
  private getFallbackConfig(capability: string): ModelConfig {
    // Find economy tier alternative
    for (const [cap, cfg] of Object.entries(this.config.capabilities)) {
      if (cfg.tier === 'economy') {
        return { provider: cfg.provider, model: cfg.model, temperature: cfg.temperature };
      }
    }
    throw new Error('No economy fallback available');
  }
}
```

**Worker Usage:**
```python
# worker/script_worker.py
from model_gate import ModelGate

model_gate = ModelGate("model_policy.yaml")

@app.post("/execute")
async def execute(envelope: TaskEnvelope):
    # Get model config from ModelGate (not hardcoded!)
    model_config = model_gate.get_config(envelope.capability, envelope.context.tier)
    
    # Call provider
    if model_config.provider == "openai":
        result = await openai_client.chat.completions.create(
            model=model_config.model,
            messages=[...],
            temperature=model_config.temperature,
            max_tokens=model_config.max_tokens
        )
    elif model_config.provider == "anthropic":
        result = await anthropic_client.messages.create(...)
    
    # Calculate cost
    cost = calculate_cost(model_config.provider, model_config.model, result.usage)
    
    return WorkerResponse(
        job_id=envelope.job_id,
        status="success",
        output={"script": result.content},
        usage={"tokens_in": result.usage.prompt_tokens, "tokens_out": result.usage.completion_tokens, "cost_estimate": cost}
    )
```

---

## 13. Knowledge, Memory & Context Architecture

### Three-Layer Storage (Manifesto + Concept-1)

| Layer | Technology | Purpose | MVP Scope |
|-------|------------|---------|-----------|
| **Relational (PostgreSQL)** | PostgreSQL | Job Ledger, Tenant Config, Telemetry, Recipe Snapshots | Full |
| **Document/Object (S3/R2)** | S3/R2 | Binary assets (video, audio, images), large artifacts | Full (Pointer system) |
| **Vector (Pinecone/Milvus)** | Vector DB | Long-term memory, semantic search, brand voice embeddings | **Deferred** — MVP uses PostgreSQL `tenant_context` table |

### Knowledge Layer (MVP: `tenant_context` table)

```sql
CREATE TABLE tenant_context (
    tenant_id VARCHAR(255) PRIMARY KEY,
    brand_voice TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    forbidden_terms TEXT[],
    style_guide JSONB,
    asset_library JSONB,  -- S3 pointers to logos, fonts, brand assets
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Memory Layer (MVP: Telemetry + Job History)

```sql
-- Already defined: telemetry table tracks every token/cost
-- Job history: completed jobs with artifacts serve as memory

-- Query pattern for "what worked before":
SELECT recipe_id, artifacts, telemetry.cost 
FROM jobs 
JOIN telemetry ON jobs.id = telemetry.job_id
WHERE tenant_id = $1 AND status = 'completed'
ORDER BY telemetry.created_at DESC
LIMIT 10;
```

### Context Injection Strategy: JIT Assembly

> **CTO Insight (Concept-4):** "Just-In-Time Context is a Hallucination Risk. The Core pruning logic might strip nuance. **Fix:** Give the Worker more context than it needs and let the **Worker's System Prompt** handle filtering. The Worker is the Subject Matter Expert, not the Orchestrator."

**MVP Approach:** Core assembles broad context → Worker's system prompt filters → Worker returns structured output.

---

## 14. The Thin Orchestrator Design

### What "Thin" Means

| Thick Orchestrator (Anti-Pattern) | Thin Orchestrator (FYI Studio) |
|-----------------------------------|--------------------------------|
| Knows how to write scripts | Knows **that** a script step exists |
| Calls OpenAI directly | Calls `ModelGate.getConfig()` → Worker calls provider |
| Renders video with FFmpeg | Dispatches to `video-composer` worker |
| Stores brand voice in memory | Reads `tenant_context` table per job |
| Handles retries in business logic | BullMQ handles retries via config |
| Passes video bytes through memory | Passes **S3 pointers** only |

### Thin Orchestrator Responsibilities (Exhaustive)

1. **State Machine:** Job status transitions (pending → running → awaiting_approval → completed/failed)
2. **Queue Management:** BullMQ job lifecycle (add, process, retry, dead-letter)
3. **Context Assembly:** Merge tenant_context + artifacts + input_mapping → TaskEnvelope
4. **Policy Enforcement:** ModelGate, tier limits, approval gates
5. **Telemetry Collection:** Persist WorkerResponse.usage to telemetry table
6. **Human Interface:** Expose Job Ledger via API for Dashboard

### What Thin Orchestrator NEVER Does

- ❌ Construct LLM prompts (Worker owns system prompt)
- ❌ Parse/transform media (Worker uses FFmpeg, etc.)
- ❌ Store binary data (S3 only)
- ❌ Know about YouTube/TikTok APIs (Publisher Worker does)
- ❌ Implement retry logic (BullMQ config)
- ❌ Choose models (ModelGate + YAML)

---

## 15. MVP Implementation Specifications

### Tech Stack (Concept-5)

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Supervisor Core | Node.js (TypeScript) / Python | Single service, BullMQ native |
| Job Queue | BullMQ (Redis) | Persistent, retry, priority, observability |
| Job Ledger | PostgreSQL | ACID, JSONB for artifacts, relational for tenants |
| Object Storage | S3 / Cloudflare R2 | Media assets, pointer-based flow |
| Workers | FastAPI (Python) / Express (Node) | Sidecar containers, `POST /execute` standard |
| Model Policy | YAML file (`model_policy.yaml`) | Zero-code model swapping |
| Observability | Loki + Grafana / Datadog | Logs with `Job_ID` correlation |
| Dashboard | Next.js (React) | Human approval UI, job monitoring |

### Directory Structure (Monorepo)

```
/apps
  /supervisor          # The Thin Orchestrator (Core)
  /dashboard           # Next.js UI for HITL + monitoring
/workers
  /researcher          # POST /execute → Perplexity/Gemini
  /script-writer       # POST /execute → OpenAI/Claude
  /voice-gen           # POST /execute → ElevenLabs
  /video-composer      # POST /execute → FFmpeg
  /subtitle-gen        # POST /execute → Whisper/FFmpeg
  /publisher           # POST /execute → YouTube API
/packages
  /shared-schema       # Zod schemas: TaskEnvelope, WorkerResponse, Recipe
  /model-gate          # ModelGate utility + model_policy.yaml loader
  /database-client     # PostgreSQL pool + typed queries
  /queue-client        # BullMQ wrapper
  /logger              # Pino/Winston with Job_ID enrichment
/infrastructure
  /docker-compose.yml  # Local dev: Postgres, Redis, MinIO, Workers
  /terraform/          # AWS/GCP infra
```

### Shared Schema (packages/shared-schema)

```typescript
// packages/shared-schema/src/envelope.ts
export const TaskEnvelopeSchema = z.object({
  job_id: z.string().uuid(),
  tenant_id: z.string(),
  step_id: z.string(),
  capability: z.string(),
  policy: z.object({
    provider: z.string(),
    model: z.string(),
    temperature: z.number(),
    max_tokens: z.number().optional(),
  }).passthrough(),
  payload: z.record(z.unknown()),
  references: z.record(z.string().url()), // S3 URIs
  context: z.object({
    brand_voice: z.string(),
    language: z.string(),
    forbidden_terms: z.array(z.string()),
  }).passthrough(),
});

export const WorkerResponseSchema = z.object({
  job_id: z.string().uuid(),
  status: z.enum(["success", "failure"]),
  output: z.record(z.unknown()),
  new_references: z.record(z.string().url()),
  usage: z.object({
    tokens_in: z.number().optional(),
    tokens_out: z.number().optional(),
    seconds: z.number().optional(),
    cost_estimate: z.number(),
  }),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  }).optional(),
});
```

---

## 16. Revised Roadmap (Concept-5)

| Week | Focus | Deliverables |
|------|-------|--------------|
| **Week 1** | **The Kernel** | PostgreSQL + BullMQ + Supervisor core. `Job Ledger` schema. `TaskEnvelope`/`WorkerResponse` contracts. ModelGate + `model_policy.yaml`. One dummy worker (uppercase text). |
| **Week 2** | **The Creative Stack** | Research Worker (Perplexity/Gemini). Script Worker (OpenAI/Claude). `input_mapping` working end-to-end. Tenant context injection. |
| **Week 3** | **The Media Stack** | Voice Worker (ElevenLabs → S3). Video Composer (FFmpeg, downloads from S3). Subtitle Worker. Pointer system validated. |
| **Week 4** | **The Loop** | Dashboard UI: Job list, artifact viewer, **Approve/Edit/Resume** button. First end-to-end production run. Telemetry dashboard. |

### Success Criteria (MVP)

- [ ] One video produced end-to-end: Research → Script → Voice → Video → Publish
- [ ] Human can pause at Script step, edit in Dashboard, resume
- [ ] Cost tracked per job in telemetry table (< $0.50/test video)
- [ ] Model swap via `model_policy.yaml` verified (GPT-4o → Claude)
- [ ] Zero binary data passes through Supervisor (S3 pointers only)
- [ ] Worker restart mid-job doesn't corrupt state (Job Ledger = truth)

---

## Appendix: Cross-References

| Document | Purpose |
|----------|---------|
| `Concept-3.md` | Architecture Manifesto v1.0 (Full Microkernel Vision) |
| `Concept-4.md` | Manifesto Supervisor Critique (CTO "Butcher Shop") |
| `Concept-5.md` | MVP Supervisor Architecture (Consensus Document) |
| `Concept-6.md` | Contracts & Schemas (TaskEnvelope, Job Ledger, Recipe) |
| `Concept-1.md` | Original Architecture Blueprint (Hub-and-Spoke) |
| `Concept-2.md` | Microkernel Architecture V2 (Registry, Router, SDK) |

---

## Governance

This document is the **supreme engineering reference for the Supervisor**.

1. **RFC Compliance:** Every future RFC/ADR must cite compliance with this design.
2. **Violation Rejection:** Any proposal introducing direct Worker-to-Worker communication, hardcoded vendor APIs in Core, Worker state persistence, or bypassing ModelGate shall be rejected.
3. **Evolution:** Amendments require Architecture Review Board consensus and must maintain backward compatibility with the **Thin Orchestrator** invariants.

---

*End of Supervisor Design Documentation v1.0*