---
id: ADR-0004-thin-orchestrator
title: "Thin Orchestrator with BullMQ + PostgreSQL"
status: "Accepted"
date: "2026-08-04"
deciders: ["Founder", "CTO", "Principal Engineer", "SRE"]
tags: [orchestrator, supervisor, bullmq, postgresql, state-machine, queue]
source_conversation: "Concept-5.md (MVP Supervisor), Concept-6.md (Supervisor Logic Flow), Concept-10.md (Sprint 1 Planning)"
---

# ADR-0004: Thin Orchestrator with BullMQ + PostgreSQL

## Context

The Architecture Review (Concept-5) established the "Thin Orchestrator" as the MVP Supervisor. Concept-6 detailed the Supervisor Logic Flow (pseudo-code). Concept-10 broke this into Sprint 1 issues.

**Key Requirements from Consensus:**
- Simple Node.js service (not a complex microkernel)
- BullMQ (Redis) for job queue persistence
- PostgreSQL Job Ledger as source of truth
- State machine: `PENDING` → `RUNNING` → `WAITING_APPROVAL` → `COMPLETED` | `FAILED`
- Supervisor is **sole writer** to Job `status` column (prevents race conditions)
- Workers are stateless; Supervisor assembles `TaskEnvelope` from `artifacts` + `tenant_context`

## Decision

**Implement the Supervisor as a Thin Orchestrator with the following architecture:**

### Core Components

#### 1. Supervisor Kernel (`/services/supervisor/src/kernel.ts`)
Main execution loop:
```typescript
async function supervise(jobId: string): Promise<void> {
  const job = await fetchJob(jobId);
  
  while (job.status === JobStatus.RUNNING || job.status === JobStatus.PENDING) {
    // 1. Identify next step in recipe
    const step = job.recipe_snapshot.steps[job.current_step_index];
    if (!step) { await completeJob(jobId); break; }
    
    // 2. Assemble TaskEnvelope (fetch pointers from artifacts)
    const envelope = buildEnvelope(job, step);
    
    // 3. Push to BullMQ queue
    const executionId = uuidv4();
    await queue.add(step.capability, { ...envelope, execution_id: executionId });
    
    // 4. Wait for WorkerResponse (with timeout)
    const response = await waitForResponse(executionId, TIMEOUT_MS);
    
    // 5. Write output to artifacts
    await mergeArtifacts(jobId, step.id, response.output, response.new_references);
    
    // 6. Record telemetry
    await recordTelemetry(response);
    
    // 7. Handle result
    if (response.status === WorkerStatus.FAILURE) {
      if (response.error?.retryable) await handleRetry(jobId, step, response);
      else await failJob(jobId);
    } else if (step.requires_approval) {
      await pauseForApproval(jobId);
    }
    
    // 8. Advance step
    await updateJob(jobId, { current_step_index: job.current_step_index + 1 });
    job = await fetchJob(jobId);
  }
}
```

#### 2. Queue Handler (`/services/supervisor/src/queue-handler.ts`)
- BullMQ Queue producers for each worker capability
- BullMQ Worker consumer for `completion-queue` (workers push results here)
- Connection pooling via shared Redis client

#### 3. Context Assembly (`buildEnvelope`)
- Resolves `input_mapping` from recipe step against `job.artifacts`
- Fetches `tenant_context` for brand voice/constraints
- Resolves model policy via `ModelGate` (reads `model_policy.yaml`)
- Extracts S3 references from artifacts

### State Management Rules

| Rule | Enforcement |
|------|-------------|
| **Supervisor = Sole Writer to `jobs.status`** | Workers never update status; only Supervisor transitions state |
| **Optimistic Locking** | Use `updated_at` or version column for concurrent safety |
| **Atomic Artifact Merge** | Single `UPDATE jobs SET artifacts = jsonb_set(...)` per step |
| **Telemetry Separation** | `telemetry` table for metrics; `jobs` for state/artifacts |

### Queue Topology

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Supervisor │────▶│  research-queue  │────▶│ Research Worker │
│  (Kernel)   │     │  (BullMQ/Redis)  │     │  (Sidecar)      │
└─────────────┘     └──────────────────┘     └────────┬────────┘
        ▲                                            │
        │                    ┌──────────────────┐    │
        └───────────────────│ completion-queue │◀───┘
                             │  (BullMQ/Redis)  │
                             └──────────────────┘
        ▲                                            │
        │                    ┌──────────────────┐    │
        └───────────────────│  script-queue    │◀───┘
                             │  (BullMQ/Redis)  │
                             └──────────────────┘
        ▲                                            │
        └───────────────────▶│  voice-queue     │────▶ Voice Worker
                             │  (BullMQ/Redis)  │
                             └──────────────────┘
```

### Retry Strategy (Supervisor-Controlled)
- Worker returns `error.retryable: true` → Supervisor decides backoff
- Exponential backoff: `baseDelay * 2^attempt` (configurable)
- Max attempts: 3 (configurable per capability)
- Dead letter: After max attempts, move to `FAILED` with error details

### Human-in-the-Loop (Pause/Resume)
- Recipe step has `requires_approval: true`
- Supervisor sets `status = WAITING_APPROVAL`, stops queue processing
- Dashboard UI: Human edits `artifacts` in DB, clicks "Resume"
- Resume: Supervisor sets `status = RUNNING`, continues from current step

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **Temporal.io** | Heavy dependency; overkill for MVP; BullMQ sufficient for queue + retries |
| **Custom State Machine in DB** | Reinventing wheel; BullMQ provides persistence, retries, priority queues |
| **Choreography (Worker-to-Worker)** | Violates Axiom: "No Direct Worker-to-Worker Communication"; no central state |
| **Orchestrator as Library** | Supervisor must be independently deployable/scalable; separate service |

## Consequences

### Positive
- **Simple** — ~200 lines core loop; easy to understand, debug, test
- **Observable** — Every state transition in Job Ledger; telemetry per step
- **Resumable** — Job can pause for days (human approval); no hanging connections
- **Testable** — Step Resolver logic unit-testable with mock recipes
- **Scalable** — Supervisor stateless; horizontal scale with shared Postgres/Redis

### Negative
- **Polling for Completion** — Supervisor waits on `completion-queue` (mitigated: BullMQ worker pattern)
- **Single Point of Failure** — Supervisor down = no new jobs (mitigated: stateless, replica + health checks)
- **Manual Retry Logic** — Not built-in like Temporal (mitigated: explicit control preferred for MVP)

## Implementation Notes

1. **Sprint 1 Scope:** Basic kernel + queue handler + 3 mock workers + completion flow
2. **Not in Sprint 1:** Retry logic, Human approval UI, ModelGate integration (mock policy)
3. **Dependencies:** `@fyi/contracts`, `@fyi/database` (Prisma), `@fyi/utils` (Redis, logging)
4. **Config:** `model_policy.yaml`, Redis URL, Postgres URL via env vars
5. **Cross-References:**
   - ADR-0001 (MVP Architecture) — Thin Orchestrator is component #1
   - ADR-0002 (Contracts v1.1) — TaskEnvelope/WorkerResponse used
   - ADR-0003 (Reference Data Plane) — Envelope references are S3 URIs
   - Sprint 1 Issues: S1.3 (Mock Workers), S1.4 (Supervisor Kernel), S1.5 (CLI)

---

**Approval:** Founder (fast), SRE (traceable), PE (simple), CTO (scalable foundations)