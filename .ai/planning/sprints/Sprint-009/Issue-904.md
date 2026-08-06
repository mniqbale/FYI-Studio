---
id: sprint-009-issue-904
title: "Issue 9.4 — Scheduler + Scheduled-Publish Flow"
owner: "Lead Engineer (AI Agent)"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-issue"
tags: [sprint-009, issue-904, scheduler, bullmq, repeatable, scheduled-publish]
related_documents:
  - "README.md"
  - "social-publish-architecture.md"
  - "social-publish-stack-proposal.md"
  - "Issue-901.md"
  - "Issue-902.md"
  - "Issue-903.md"
related_sprint: "Sprint-009"
---

# Issue 9.4 — Scheduler + Scheduled-Publish Flow

> **Sprint:** 9 (Milestone 10: Social Publish & Scheduling)  
> **Estimate:** M (3-5 hours)  
> **Dependencies:** Issues 9.2 (Registry), 9.3 (Worker/Adapter)  
> **Blockers:** None

---

## 1. Objective

Implement the **BullMQ repeatable scheduler** that finds due scheduled publishes and enqueues them to the `publish-queue`:
- A repeatable job runs on an interval.
- It selects `scheduled_publishes` where `status='scheduled'` and `scheduled_at <= now()`.
- Marks them `publishing` and enqueues each to the `publish-queue`.
- On worker completion, `handlePublishResult` (Issue 9.3) writes the result back.

---

## 2. Deliverables

### 2.1 `services/publish/src/scheduler.ts`

```typescript
// services/publish/src/scheduler.ts
import { Queue } from 'bullmq';
import { redis } from '@fyi/utils';
import { prisma } from './utils/prisma.js';

export const publishQueue = new Queue('publish-queue', { connection: redis });

// One-time: register the repeatable sweep job
export async function registerScheduler() {
  await publishQueue.add('publish-sweep', {}, {
    repeat: { every: Number(process.env.SCHEDULER_INTERVAL_MS ?? 60000) },
    jobId: 'publish-sweep',
  });
}

// Run by the repeatable job each interval:
export async function sweepDuePublishes() {
  const due = await prisma.scheduledPublish.findMany({
    where: { status: 'scheduled', scheduledAt: { lte: new Date() } },
  });
  for (const row of due) {
    await prisma.scheduledPublish.update({ where: { id: row.id }, data: { status: 'publishing' } });
    await publishQueue.add('publish', {
      scheduledPublishId: row.id,
      tenantId: row.tenantId,
      jobId: row.jobId,
      adapter: 'youtube',  // resolve from social_account.platform
    });
  }
  return due.length;
}
```

### 2.2 `services/publish/src/index.ts` (entry)

```typescript
// services/publish/src/index.ts
import { Worker } from 'bullmq';
import { redis } from '@fyi/utils';
import { registerScheduler, sweepDuePublishes } from './scheduler.js';
import { handlePublishResult } from './handler.js';

async function start() {
  await registerScheduler();

  // Run the sweep immediately + on the repeatable schedule
  await sweepDuePublishes();

  // Completion worker: write results back
  const completion = new Worker('completion-queue', async (job) => {
    await handlePublishResult(job.data.jobId, job.data.scheduledPublishId, job.data.result);
  }, { connection: redis });
}

start();
```

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Repeatable scheduler registered on `publish-queue` | Queue inspection |
| 2 | Sweep selects due `scheduled_publishes` and marks them `publishing` | DB check |
| 3 | Due publishes enqueued to `publish-queue` | Queue inspection / logs |
| 4 | On completion, `handlePublishResult` writes the result back | DB check (`platform_response`, `artifacts.published`) |
| 5 | Timezone handled (UTC storage) | Code review |
| 6 | `pnpm run typecheck` + `pnpm run build` pass | CI check |

---

## 4. Implementation Notes

- **BullMQ repeatable** (ADR-0004 infra) — no new scheduler.
- **UTC timestamps** — `scheduled_at` stored in UTC; conversion at display only.
- **Idempotency** — mark `publishing` before enqueue to avoid double-dispatch on scheduler overlap.

---

## 5. Definition of Done

- [ ] Scheduler registered + sweep works
- [ ] Due publishes enqueued + processed
- [ ] Results written back
- [ ] Typecheck/build pass; unit tests (≥80% coverage)

---

## 6. Cross-References

- **Sprint Plan:** [README.md](./README.md)
- **Architecture:** [social-publish-architecture.md](../architecture/social-publish-architecture.md)
- **ADR-0004 (BullMQ / queue topology):** [../../adr/ADR-0004-thin-orchestrator.md](../../adr/ADR-0004-thin-orchestrator.md)
