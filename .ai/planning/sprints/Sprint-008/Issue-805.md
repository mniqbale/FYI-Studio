---
id: sprint-008-issue-805
title: "Issue 8.5 — HITL Revise/Approve Write Operations (ADR-0010)"
owner: "Lead Engineer (AI Agent)"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-issue"
tags: [sprint-008, issue-805, hitl, revise, approve, step-rerun, write-operation, adr-0010]
related_documents:
  - "README.md"
  - "settings-ai-workspace-architecture.md"
  - "dashboard-architecture.md"
  - "Issue-804.md"
  - "../../adr/ADR-0010-hitl-revise-approve.md"
related_sprint: "Sprint-008"
---

# Issue 8.5 — HITL Revise/Approve Write Operations (ADR-0010)

> **Sprint:** 8 (Milestone 9: Settings AI Workspace — Workstream D, ADR-0010)  
> **Estimate:** M (3-5 hours)  
> **Dependencies:** Issue 8.4 (Dashboard polish — artifacts/revise UI)  
> **Blockers:** ADR-0010 approval (Proposed → Accepted)

---

## 1. Objective

Implement the **deliberate write exception** to the read-only Dashboard (per ADR-0010):
- **Approve:** `POST /api/jobs/:id/approve` resumes a `WAITING_APPROVAL` job (delegated to the Supervisor — the sole writer to `jobs.status`).
- **Revise:** `POST /api/jobs/:id/revise` edits a step's input and **re-runs that specific step** via the StepRunner (extend the Supervisor/StepRunner with a re-run path).
- Add a **Revise section** on `/jobs/:id` so the Founder can edit + re-run a step before approval.

---

## 2. Deliverables

### 2.1 Supervisor StepRunner extension — `services/supervisor/src/step-runner.ts`

```typescript
// services/supervisor/src/step-runner.ts (additions)
// Re-run a specific step (index) from updated artifacts. Extends the forward-only chain
// while preserving the Supervisor as sole writer to job.status (ADR-0004).
export async function reRunStep(jobId: string, stepIndex: number, updatedInput: unknown) {
  const job = await fetchJob(jobId);

  // Guardrail: only RUNNING / WAITING_APPROVAL jobs may be revised
  if (job.status !== 'RUNNING' && job.status !== 'WAITING_APPROVAL') {
    throw new WorkerError('NOT_REVISABLE', `Job ${jobId} is not in a revisable state (${job.status})`);
  }

  // 1. Merge edited input into the job's artifacts
  await mergeArtifacts(jobId, updatedInput);

  // 2. Reset current_step_index to the target step (for re-run)
  await updateJob(jobId, { current_step_index: stepIndex, status: 'RUNNING' });

  // 3. Re-dispatch that step through the normal worker pipeline
  const step = job.recipe_snapshot.steps[stepIndex];
  const executionId = uuidv4();
  await queue.add(step.capability, { ...buildEnvelope(job, step), execution_id: executionId });
}
```

### 2.2 Dashboard write routes — `services/dashboard/src/routes/jobs.ts`

```typescript
// services/dashboard/src/routes/jobs.ts (excerpt — HITL write endpoints)
import { reRunStep } from '@fyi/supervisor';   // or a shared supervisor API
import { resumeJob } from '@fyi/supervisor';

// Approve: resume a WAITING_APPROVAL job (Supervisor sole writer to status)
app.post('/api/jobs/:id/approve', async (req, reply) => {
  const { id } = req.params as { id: string };
  await resumeJob(id);                 // sets status RUNNING, re-enqueues next step
  return reply.send({ status: 'approved', jobId: id });
});

// Revise: edit step input + re-run that step
app.post('/api/jobs/:id/revise', async (req, reply) => {
  const { id } = req.params as { id: string };
  const { stepIndex, input } = req.body as { stepIndex: number; input: unknown };
  await reRunStep(id, stepIndex, input);
  return reply.send({ status: 're-running', jobId: id, stepIndex });
});
```

### 2.3 `services/dashboard/src/templates/job-detail-partials/revise.ts` (Revise section)

```typescript
// services/dashboard/src/templates/job-detail-partials/revise.ts
export function renderReviseSection(job) {
  if (job.status !== 'WAITING_APPROVAL' && job.status !== 'RUNNING') return '';
  return `
    <section id="revise">
      <h2>Revise & Re-run</h2>
      <label>Step index <input type="number" id="revise-step-index" value="${job.current_step_index}"></label>
      <textarea id="revise-input" placeholder="Paste edited step input (e.g. revised script)"></textarea>
      <button id="revise-submit">Revise & Re-run step</button>
      <button id="approve-submit">Approve & continue</button>
    </section>`;
}
```

### 2.4 `services/dashboard/src/client/job-detail.ts` (UPDATED — wire revise/approve)

```typescript
// client/job-detail.ts (excerpt — additions)
document.getElementById('revise-submit')?.addEventListener('click', async () => {
  const stepIndex = Number(document.getElementById('revise-step-index').value);
  const input = JSON.parse(document.getElementById('revise-input').value);
  const jobId = currentJobId();
  await fetch(`/api/jobs/${jobId}/revise`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stepIndex, input }),
  });
  startPolling(`/api/jobs/${jobId}`, 2000, updateJobDetail); // resume polling
});

document.getElementById('approve-submit')?.addEventListener('click', async () => {
  const jobId = currentJobId();
  await fetch(`/api/jobs/${jobId}/approve`, { method: 'POST' });
  startPolling(`/api/jobs/${jobId}`, 2000, updateJobDetail);
});
```

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `POST /api/jobs/:id/approve` resumes a `WAITING_APPROVAL` job | E2E: job completes after approve |
| 2 | `POST /api/jobs/:id/revise` edits a step + re-runs it | E2E: revise script → re-run → new output |
| 3 | Invalid state transitions rejected (e.g. approve non-WAITING_APPROVAL) | Unit test: structured error |
| 4 | Supervisor remains sole writer to `jobs.status` (writes delegate to it) | Code review |
| 5 | Every approve/revise is audited (pino log + telemetry row) | Log/DB check |
| 6 | `/jobs/:id` shows the Revise section for revisable jobs | Visual check |
| 7 | `pnpm run typecheck` + `pnpm run build` pass | CI check |

---

## 4. Implementation Notes

- **Requires ADR-0010 Accepted** — this is the deliberate write exception; do not implement until approved.
- **Preserve single-writer** — the Dashboard write endpoints call the Supervisor/StepRunner; they do NOT `prisma.job.update({ status })` directly. The Supervisor remains the sole writer to `jobs.status` (ADR-0004).
- **Step re-run** — carefully extend the forward-only StepRunner chain (see M1 single-writer chain note in `project-memory.md`); add unit tests to ensure the re-run path doesn't double-dispatch or corrupt artifacts.
- **Audit** — log who/what/when (Founder via Dashboard) for every approve/revise.

---

## 5. Definition of Done

- [ ] ADR-0010 is Accepted
- [ ] Approve + Revise endpoints work end-to-end
- [ ] Step re-run preserves Supervisor single-writer and artifact integrity
- [ ] Invalid transitions rejected; audits logged
- [ ] Revise section present on `/jobs/:id`
- [ ] Typecheck/build pass; E2E + unit tests pass

---

## 6. Cross-References

- **Sprint Plan:** [README.md](./README.md)
- **ADR-0010 (write exception):** [../../adr/ADR-0010-hitl-revise-approve.md](../../adr/ADR-0010-hitl-revise-approve.md)
- **Thin Orchestrator / Supervisor single-writer:** [../../adr/ADR-0004-thin-orchestrator.md](../../adr/ADR-0004-thin-orchestrator.md)
- **Dashboard Architecture:** [dashboard-architecture.md](../architecture/dashboard-architecture.md)
