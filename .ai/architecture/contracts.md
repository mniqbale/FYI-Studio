---
title: "FYI Studio Core Contracts"
version: "1.1"
status: "approved"
description: "Definitive contracts governing communication between Supervisor and Workers. Combines Concept-6 v1.0 (Core Schema) with Concept-8/9 Contracts v1.1 revisions."
source_documents:
  - "Concept-6.md (Core Schema: TaskEnvelope v1.0, WorkerResponse v1.0, Job Ledger SQL, Production Recipe, Usage & Telemetry SQL, Implementation Strategy Milestones 1-4, Supervisor Logic Flow)"
  - "Concept-8.md (Contracts v1.0: @fyi/contracts package definition)"
  - "Concept-9.md Part 1 (Contracts v1.1: Strict Enums, Idempotency & Retries, Safer Typing, Telemetry separation, Versioning)"
last_updated: "2026-08-04"
owner: "Principal Architect"
---

# FYI Studio Core Contracts v1.1

> **Design Philosophy**: "Code is cheap; contracts are expensive." By defining the Interfaces now, we ensure that different developers can build different workers that will all "just work" when plugged into the Core.

---

## 1. Core Schema Definitions (The "Law")

### 1.1 TypeScript Enums (v1.1 - Strict Enums)

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

### 1.2 TaskEnvelope (Input to Worker) — v1.1

Every Worker receives this exact object. No Worker should ever look for data outside this envelope.

```typescript
export interface ModelPolicy {
  provider: string;       // "openai", "anthropic", "elevenlabs"
  model: string;          // "gpt-4o", "claude-3-5-sonnet"
  temperature?: number;
  max_tokens?: number;
}

export interface TenantContext {
  brand_voice: string;
  language: string;
  forbidden_terms: string[];
  [key: string]: unknown; // Allow for niche-specific context fragments
}

/**
 * The standard input for any Worker in the FYI Studio OS.
 * v1.1 adds: contract_version, execution_id, attempt, started_at
 */
export interface TaskEnvelope {
  contract_version: '1.1';
  job_id: string;        // The persistent ID for the whole production (UUID)
  execution_id: string;  // Unique ID for THIS specific attempt/run (UUID)
  tenant_id: string;     // Channel/Brand ID
  step_id: string;       // ID of the step in the current workflow
  capability: string;    // e.g., "text-synthesis:script"
  attempt: number;       // Starts at 1
  policy: ModelPolicy;   // The Model Policy determined by the Core ModelGate
  context: TenantContext; // Fragment of the Tenant Context (Brand voice, constraints)
  payload: Record<string, unknown>; // Structured data needed for the task (e.g., the prompt or research results)
  references: Record<string, string>; // Pointers to binary assets in S3/R2 (key: "raw_audio_url", value: "s3://bucket/audio.mp3")
  started_at: string;    // ISO-8601 timestamp
}
```

**v1.0 → v1.1 Changes:**
| Field | v1.0 | v1.1 |
|-------|------|------|
| `contract_version` | ❌ | ✅ `'1.1'` |
| `execution_id` | ❌ | ✅ UUID per attempt |
| `attempt` | ❌ | ✅ number (starts at 1) |
| `started_at` | ❌ | ✅ ISO-8601 string |
| `payload` type | `Record<string, any>` | `Record<string, unknown>` |
| `context` index sig | `[key: string]: any` | `[key: string]: unknown` |

### 1.3 WorkerResponse (Output from Worker) — v1.1

Every Worker must return this structure. Failure to do so triggers an automatic Job Failure.

```typescript
export interface UsageMetrics {
  tokens_in?: number;
  tokens_out?: number;
  seconds?: number;       // For voice/video generation
  cost_estimate: number;  // In USD, calculated by the worker based on provider response
}

export interface PerformanceMetrics {
  duration_ms: number;
  started_at: string;     // ISO-8601
  finished_at: string;    // ISO-8601
}

export interface WorkerError {
  code: string;           // e.g., "RATE_LIMIT_EXCEEDED", "INVALID_INPUT", "PROVIDER_ERROR"
  message: string;
  retryable: boolean;
  stack?: string;
}

/**
 * The standard output produced by any Worker.
 * v1.1 adds: contract_version, execution_id, worker_id, worker_version, performance, separated usage/performance
 */
export interface WorkerResponse {
  contract_version: '1.1';
  job_id: string;
  execution_id: string;
  worker_id: string;       // Unique name of the worker instance (e.g., "script-worker-v2")
  worker_version: string;  // Semver of the worker code
  status: WorkerStatus;    // SUCCESS | FAILURE
  output: Record<string, unknown>;      // The actual result (e.g., the script text)
  new_references: Record<string, string>; // Pointers to new files created (key: "generated_video_url", value: "s3://bucket/vid.mp4")
  usage: UsageMetrics;                 // Cost intelligence layer
  performance: PerformanceMetrics;     // Latency/timing for SRE observability
  error?: WorkerError;                 // Populated ONLY when status === FAILURE
}
```

**v1.0 → v1.1 Changes:**
| Field | v1.0 | v1.1 |
|-------|------|------|
| `contract_version` | ❌ | ✅ `'1.1'` |
| `execution_id` | ❌ | ✅ Must match input envelope |
| `worker_id` | ❌ | ✅ Required |
| `worker_version` | ❌ | ✅ Required |
| `usage` | Combined tokens+cost+duration | `UsageMetrics` (cost/tokens only) |
| `performance` | ❌ | ✅ New: `PerformanceMetrics` (latency/timing) |
| `error.stack` | ❌ | ✅ Optional stack trace |
| `output`/`new_references` type | `Record<string, any>` | `Record<string, unknown>` |

### 1.4 Job Ledger (PostgreSQL Schema) — Source of Truth

```sql
CREATE TABLE jobs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    recipe_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'waiting_approval', 'completed', 'failed'
    current_step_index INTEGER DEFAULT 0,
    
    -- Snapshot of the full recipe for historical auditing
    recipe_snapshot JSONB NOT NULL, 
    
    -- The "Memory" of the job: cumulative outputs of all workers
    artifacts JSONB DEFAULT '{}', 
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common query patterns
CREATE INDEX idx_jobs_tenant_status ON jobs(tenant_id, status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
```

### 1.5 Production Recipe (The DAG)

Defined by the user or channel template.

```typescript
export interface ProductionRecipe {
  name: string;
  steps: {
    id: string;
    capability: string;
    worker_label: string;      // e.g., "standard-script-writer"
    requires_approval: boolean;
    
    // Maps previous step outputs to this step's inputs
    // e.g., "research_results": "steps.research_worker.output.summary"
    input_mapping: Record<string, string>; 
  }[];
}
```

### 1.6 Usage & Telemetry (The Bill)

Separate table for cost intelligence and SRE observability.

```sql
CREATE TABLE telemetry (
    id SERIAL PRIMARY KEY,
    job_id UUID REFERENCES jobs(id),
    execution_id VARCHAR(255) NOT NULL,  -- Links to specific attempt
    worker_id VARCHAR(255) NOT NULL,
    worker_version VARCHAR(50) NOT NULL,
    provider VARCHAR(50),
    model VARCHAR(50),
    tokens_in INTEGER,
    tokens_out INTEGER,
    seconds INTEGER,              -- For audio/video generation duration
    cost NUMERIC(10, 6),          -- USD cost estimate
    duration_ms INTEGER,          -- Worker execution latency
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for cost analysis and debugging
CREATE INDEX idx_telemetry_job ON telemetry(job_id);
CREATE INDEX idx_telemetry_worker ON telemetry(worker_id, created_at DESC);
CREATE INDEX idx_telemetry_provider ON telemetry(provider, model, created_at DESC);
```

---

## 2. Implementation Strategy: The "One-Video" Path

We will not build the 100-channel manager yet. We will build the **Minimum Viable Pipeline.**

### Milestone 1: The Hello-World Pipeline (Sprint 1)
- **Goal:** Move a single string through three "Dummy" workers.
- **Infrastructure:** Setup PostgreSQL, Redis, and a single "Supervisor" service (Orchestrator).
- **Test:** Create a Job in the Ledger, have a "Mock Worker" receive it, "process" it (uppercase the text), and return it.

### Milestone 2: AI Platform Foundation (Sprints 2–3)
- **Goal:** Establish the AI infrastructure foundation used by every future worker — Provider Registry, Connection Manager, Model Registry, Capability Registry, and ModelGate v2. This is the "Bring Your Own AI (BYOAI)" layer.
- **Work:** Build Provider Registry with encrypted API key storage, Connection Manager for health/quota, Model Registry with capability metadata, Capability Registry, ModelGate v2 for capability-filtered model selection.
- **Logic:** Workers request capabilities; ModelGate resolves connected providers → available models → policy → capability match → selected model.

### Milestone 3: The Cognitive Core (Sprints 4–5)
- **Goal:** Integration with actual AI providers via the AI Platform Foundation.
- **Workers:** Build the **Research Worker** (Perplexity/Gemini/OpenAI) and the **Script Worker** (OpenAI/Claude/Gemini) using ModelGate v2.
- **Logic:** The Orchestrator must successfully pass the Research output into the Script input using the `input_mapping`. Real AI calls replace mock workers.

### Milestone 4: Knowledge Layer + Memory Management (Sprints 6–7)
- **Goal:** Implement the three-tier context assembly (Global Knowledge, Tenant Brand Memory, Project Memory) with Just-In-Time context injection and vector-based semantic retrieval.
- **Work:** Knowledge Layer with Brand Profiles, Style Guides, Verified Facts, Asset Libraries. Memory Layer for historical performance. Vector store integration for semantic search.

### Milestone 5: The Media Plane (Sprints 8–10)
- **Goal:** S3 Integration and binary handling with media generation capabilities.
- **Workers:** Build the **Voice Worker** (ElevenLabs/Azure/OpenAI TTS), **Video Composer Worker** (FFmpeg), **Subtitle Worker** (Whisper), **Asset Library Worker**.
- **Logic:** Workers use ModelGate v2 for model selection. Voice worker saves MP3 to S3; Composer worker downloads and renders video.

### Milestone 6: Multi-Tenant Brand Management (Sprints 11–13)
- **Goal:** Enable horizontal scaling to hundreds of heterogeneous channels with strict isolation.
- **Features:** Tenant Registry, Policy Engine, Worker Registry v2, A/B testing framework, Dashboard.

### Milestone 7: Analytics & Learning Loop (Auto-optimization) (Sprints 14–16)
- **Goal:** Close the feedback loop — autonomous hypothesis generation, recipe mutation, and A/B execution at scale.
- **Work:** Analytics Workers (YouTube, TikTok, Instagram APIs), Memory Layer enrichment, Autonomous Optimization Engine, A/B test orchestration, Cost Intelligence.

---

## 3. Supervisor Logic Flow (Pseudo-code)

The Supervisor's only job is the Kernel's main execution loop:

```typescript
// Supervisor Main Loop
async function supervise(jobId: string): Promise<void> {
  // 1. Watch the `jobs` table for new entries (or poll)
  const job = await fetchJob(jobId);
  
  while (job.status === JobStatus.RUNNING || job.status === JobStatus.PENDING) {
    // 2. Identify the next step in the `recipe`
    const step = job.recipe_snapshot.steps[job.current_step_index];
    
    if (!step) {
      // No more steps - job complete
      await updateJob(jobId, { status: JobStatus.COMPLETED });
      break;
    }
    
    // 3. Assemble the TaskEnvelope (fetching pointers from `artifacts`)
    const envelope = buildEnvelope(job, step);
    
    // 4. Push the envelope to the Queue (BullMQ)
    const executionId = uuidv4();
    await queue.add(step.capability, { ...envelope, execution_id: executionId });
    
    // 5. Wait for the WorkerResponse (with timeout)
    const response = await waitForResponse(executionId, TIMEOUT_MS);
    
    // 6. Write the WorkerResponse.output into the `artifacts` column
    await mergeArtifacts(jobId, step.id, response.output, response.new_references);
    
    // 7. Record telemetry
    await recordTelemetry(response);
    
    // 8. Handle result
    if (response.status === WorkerStatus.FAILURE) {
      if (response.error?.retryable) {
        // Supervisor decides backoff strategy, increments attempt, re-queues
        await handleRetry(jobId, step, response);
      } else {
        await updateJob(jobId, { status: JobStatus.FAILED });
        break;
      }
    } else if (step.requires_approval) {
      await updateJob(jobId, { status: JobStatus.WAITING_APPROVAL });
      // Wait for external signal (Dashboard/UI) to continue
      await waitForApproval(jobId);
      await updateJob(jobId, { status: JobStatus.RUNNING });
    }
    
    // 9. Advance to next step
    await updateJob(jobId, { current_step_index: job.current_step_index + 1 });
    job = await fetchJob(jobId); // Refresh
  }
}

function buildEnvelope(job: Job, step: RecipeStep): TaskEnvelope {
  const payload = resolveInputMapping(step.input_mapping, job.artifacts);
  
  return {
    contract_version: '1.1',
    job_id: job.id,
    execution_id: uuidv4(), // Will be overridden by queue wrapper
    tenant_id: job.tenant_id,
    step_id: step.id,
    capability: step.capability,
    attempt: 1, // Incremented on retry
    policy: await resolveModelPolicy(step.capability, job.tenant_id),
    context: await fetchTenantContext(job.tenant_id),
    payload,
    references: extractReferences(job.artifacts),
    started_at: new Date().toISOString(),
  };
}
```

---

## 4. @fyi/contracts Package Definition (from Concept-8)

### 4.1 Responsibility
The `@fyi/contracts` package is the "Source of Truth" for the entire FYI Studio ecosystem. It defines the TypeScript interfaces and types that every other component (Supervisor and Workers) must implement. It contains **no executable logic**—only type definitions.

### 4.2 Why it Exists
In a distributed system, the most common cause of failure is "Schema Drift"—where a sender changes a field name and the receiver breaks. By centralizing these definitions in a single package imported by all other services, we turn runtime errors into compile-time errors.

### 4.3 System Interaction
| Consumer | Usage |
|----------|-------|
| **Supervisor** | Imports types to ensure it constructs valid envelopes before pushing to queue |
| **Workers** | Import types to ensure they correctly parse incoming task and structure response |
| **Database Layer** | Uses types to ensure `artifacts` and `logs` JSON fields in PostgreSQL match expected runtime structures |

### 4.4 File Structure
```
packages/contracts/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts          # All type definitions (exports above)
```

### 4.5 Package Configuration

```json
{
  "name": "@fyi/contracts",
  "version": "1.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

### 4.6 TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 5. Versioning Policy

| Version | Changes | Migration |
|---------|---------|-----------|
| **1.0** | Initial contracts (Concept-6) | Baseline |
| **1.1** | Strict enums, `execution_id`, `attempt`, separated usage/performance, `worker_id`, `worker_version`, `contract_version` field, `Record<string, unknown>` | Breaking: All workers must be rebuilt. Supervisor must add new fields. |

**Future versions** will follow semantic versioning. The `contract_version` field in every envelope/response enables runtime validation and graceful degradation.

---

## 6. Risks and Edge Cases (from Concept-8)

| Risk | Mitigation |
|------|------------|
| **Payload Elasticity**: Different workers need very different data in `payload` | Use generic `Record<string, unknown>` for payload but enforce strict types for envelope metadata |
| **Snake_case vs CamelCase**: AI APIs use snake_case, TypeScript prefers camelCase | **Decision:** Use **snake_case** for all fields within contract interfaces to maintain consistency with JSON data stored in PostgreSQL and used by external AI APIs |
| **Schema Drift across services** | Single `@fyi/contracts` package imported by all; CI validates types on every PR |
| **Non-TypeScript workers (future)** | Generate JSON Schema from TS types for cross-language validation |

---

## 7. Cross-References

| Document | Relation |
|----------|----------|
| `engineering-standards.md` | Error handling, idempotency, logging, testing, PR checklist for workers implementing these contracts |
| `supervisor-design.md` | Full Supervisor service architecture implementing the logic flow above |
| `sprint-planning.md` | Milestone breakdown with tickets for each contract consumer |
| `database-layer.md` | Prisma schema mirroring the Job Ledger and Telemetry tables |