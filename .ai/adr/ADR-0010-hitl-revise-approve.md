---
id: ADR-0010-hitl-revise-approve
title: "Dashboard HITL Write Operations (Approve / Revise Step Re-run)"
status: "Accepted"
date: "2026-08-06"
deciders: ["Founder", "Lead Engineer", "Principal Architect"]
tags: [post-mvp, dashboard, hitl, approval, revise, write-operation, supervisor, step-runner]
source_conversation: "Founder post-MVP review feedback (Milestone 8 Dashboard review)"
---

# ADR-0010: Dashboard HITL Write Operations (Approve / Revise Step Re-run)

> **Status:** ACCEPTED (Founder approval 2026-08-06). This ADR records a **deliberate exception** to the read-only Dashboard invariant: allowing the Dashboard to perform **write operations** for the human-in-the-loop (HITL) approve/revise workflow. This is the first documented deviation from ADR-0001's "Dashboard never writes" rule.

## Context

The MVP's Supervisor (ADR-0004) supports a `WAITING_APPROVAL` state: a recipe step with `requires_approval: true` pauses the job for human review. Milestone 8 (Dashboard) surfaces these jobs read-only, but the Founder has **no way to approve or revise a step from the Dashboard** — the approval gate was originally documented (ADR-0004 §"Human-in-the-Loop") as "Human edits `artifacts` in DB, clicks Resume" (a manual DB operation).

The Founder's post-MVP review feedback explicitly requested:
1. **Revise** — edit and re-run a step before approval (e.g. edit the script, then re-run the script step).
2. **Approve** — approve a `WAITING_APPROVAL` job so the Supervisor continues to the next step.

Both are **write operations** that **break the Dashboard's read-only invariant** (ADR-0001). Without this, the Founder is forced to hand-edit the database or use a CLI — which conflicts with the visual-review workflow that drove the Dashboard.

**Design tension:** The Dashboard was deliberately read-only for safety (no accidental writes, single-writer Supervisor). This ADR is a **scoped, deliberate exception**: it adds a small, controlled write surface for HITL only, and routes all writes **through the Supervisor / StepRunner** so the Supervisor remains the sole writer to `jobs.status` (ADR-0004). The Dashboard does not mutate Job Ledger state directly — it calls a write API that the Supervisor owns.

## Decision

**Allow the Dashboard to perform a small, deliberate set of HITL write operations — Approve and Revise — implemented as write endpoints that the Dashboard calls to instruct the Supervisor/StepRunner, NOT as direct Dashboard DB mutations.**

### 1. Approve operation
- `POST /api/jobs/:id/approve` (Dashboard write endpoint) resumes a `WAITING_APPROVAL` job.
- The Dashboard endpoint delegates to the Supervisor: it sets the job back to `RUNNING` (Supervisor single-writer) and re-enqueues the next step.
- This replaces the manual "edit DB + click Resume" flow from ADR-0004.

### 2. Revise operation (step re-run)
- `POST /api/jobs/:id/revise` (Dashboard write endpoint) accepts edited step input (e.g. a revised script) and a target step index.
- The Dashboard writes the edited input into the job's artifacts, then instructs the **StepRunner to re-run that specific step** from the updated artifacts.
- Step re-run requires a small extension to the Supervisor/StepRunner: a "re-run step N from current artifacts" path (currently the step-runner only advances forward from `current_step_index`).

### 3. Write-surface guardrails
- Only these two operations are exposed — no arbitrary DB writes from the Dashboard.
- All writes are validated and routed through Supervisor/StepRunner; the Supervisor remains the sole writer to `jobs.status` (ADR-0004).
- Idempotency: approve/revise are keyed to job state; a job not in `WAITING_APPROVAL` (or `RUNNING` for revise) rejects the request.
- Audit: the Dashboard logs every approve/revise action (who, what, when) to the Job Ledger/telemetry.

### 4. Scope boundary
- This is a **HITL-only** write exception. It does NOT open general CRUD from the Dashboard. Content creation, deletion, tenant mutation, and platform publishing remain outside the Dashboard (Settings AI workspace = Milestone 9; publishing = Milestone 10 worker).
- The read-only invariant still holds for **all non-HITL views** (Overview, Jobs list, Tenants, Analytics).

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **Keep the Dashboard fully read-only; hand-edit DB / use CLI for approve/revise** | Conflicts with the Founder's visual-review workflow; error-prone manual DB edits; no way to revise a step from the UI. |
| **Dashboard writes directly to the `jobs` table (UPDATE status)** | Violates the single-writer Supervisor invariant (ADR-0004) and risks race conditions; the Dashboard must not be a writer to job status. |
| **Open full Dashboard CRUD (general write surface)** | Over-broad scope creep; increases risk of accidental writes; only approve/revise are needed for HITL. |
| **Push-based HITL (WebSocket) instead of HTTP POST** | Overkill; a simple HTTP write endpoint is sufficient and consistent with the polling-based dashboard; no new infra. |

## Consequences

### Easier
- **Founder HITL workflow** — approve or revise a step from the Dashboard without touching the DB or CLI (matches the visual-review way of working).
- **Re-run a single step** — edit the script and re-run just the script step instead of restarting the whole job (saves cost/time).
- **Supervisor integrity preserved** — all writes route through the Supervisor/StepRunner, keeping it the sole writer to job status.

### Harder / Risks
- **Breaks the pure read-only invariant** — must be carefully scoped and guarded; this is a deliberate, documented exception to ADR-0001.
- **StepRunner extension** — a "re-run step N" path must be added to the Supervisor/StepRunner without breaking the forward-only chain (M1 single-writer chain note in project-memory).
- **Validation burden** — approve/revise must reject invalid state transitions (e.g. approve a non-`WAITING_APPROVAL` job; revise a non-`RUNNING` step) with structured errors.
- **Auditability** — every write must be logged so the Job Ledger remains the authoritative history.
- **Contracts v1.1 frozen** — the write endpoints are Dashboard-facing (application layer) and do not alter `TaskEnvelope`/`WorkerResponse`; the step re-run uses existing artifact/telemetry fields.

## Implementation Notes

- Add two Dashboard write routes: `POST /api/jobs/:id/approve` and `POST /api/jobs/:id/revise` in `services/dashboard`.
- Extend the Supervisor/StepRunner with a `reRunStep(jobId, stepIndex, updatedInput)` capability (a new exported function in `services/supervisor/src/step-runner.ts`).
- Dashboard write endpoints call the Supervisor/StepRunner (shared package or internal call), never `prisma.job.update` directly for status.
- Add audit logging (pino) + a telemetry row per approve/revise action.
- Add unit tests for state-transition rejection + E2E: pause a job at `WAITING_APPROVAL`, revise the script step, re-run, then approve and observe the job complete.
- Contracts v1.1 remain frozen.

## Architecture Impact on Existing ADRs

| ADR | Impact |
|-----|--------|
| **ADR-0001 (MVP Architecture)** | **Directly amended by exception** — the Dashboard gains a deliberate, scoped HITL write surface; all other views remain read-only. This is a documented carve-out, not a repeal. |
| **ADR-0002 (Contracts v1.1)** | No change — frozen; write operations are application-layer (Dashboard/Supervisor), not contract changes. |
| **ADR-0003 (Reference-Based Data Plane)** | No change — revise edits artifact pointers/content, not binary transport. |
| **ADR-0004 (Thin Orchestrator)** | Extends the Supervisor/StepRunner with a step re-run path; Supervisor remains sole writer to `jobs.status`. |
| **ADR-0005 (Engineering Standards)** | No change — error handling, logging, testing standards apply to the new write routes and step-rerun. |
| **ADR-0008 / 0009 (Publish / Analytics)** | Independent; this ADR concerns in-platform HITL, not platform publish or ingestion. |

## Status

**Implemented** (2026-08-07). Approve + Revise shipped end-to-end:
- `POST /api/jobs/:id/approve` resumes a `WAITING_APPROVAL` job (Supervisor sole writer).
- `POST /api/jobs/:id/revise` writes edited step input into artifacts + re-runs that step.
- Dashboard job-detail shows **✅ Approve** + **✏️ Revise Script** buttons for `WAITING_APPROVAL` jobs.
- State-transition guardrails: approve/revise reject invalid states with structured 409 errors; non-UUID ids handled as not-found.
- Unit tests (`tests/hitl.test.ts`) cover route wiring + validation + rejection.

---

**Approval:** Founder (Product/HITL workflow), Lead Engineer (Implementation Feasibility), Principal Architect (Architectural Integrity).
