---
id: sprint-010-issue-1003
title: "Issue 10.3 — Ingestion Worker"
owner: "Lead Engineer (AI Agent)"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-issue"
tags: [sprint-010, issue-1003, ingestion, worker, upsert, platform-metrics, video-revenue]
related_documents:
  - "README.md"
  - "platform-analytics-architecture.md"
  - "platform-analytics-stack-proposal.md"
  - "Issue-1001.md"
  - "Issue-1002.md"
related_sprint: "Sprint-010"
---

# Issue 10.3 — Ingestion Worker

> **Sprint:** 10 (Milestone 11: Platform Analytics & Revenue)  
> **Estimate:** M (3-5 hours)  
> **Dependencies:** Issues 10.1 (Schema), 10.2 (YouTube client + quota)  
> **Blockers:** None

---

## 1. Objective

Implement the **scheduled ingestion worker** that fetches YouTube stats + revenue and **idempotently upserts** them into the local tables. It runs on a BullMQ repeatable schedule and respects the quota ledger.

---

## 2. Deliverables

### 2.1 `services/analytics-ingest/src/scheduler.ts`

```typescript
// services/analytics-ingest/src/scheduler.ts
import { Queue } from 'bullmq';
import { redis } from '@fyi/utils';

export const ingestQueue = new Queue('ingest-queue', { connection: redis });

export async function registerScheduler() {
  await ingestQueue.add('daily-ingest', {}, {
    repeat: { every: Number(process.env.INGEST_INTERVAL_MS ?? 86400000) },  // daily
    jobId: 'daily-ingest',
  });
}
```

### 2.2 `services/analytics-ingest/src/ingest.ts`

```typescript
// services/analytics-ingest/src/ingest.ts
import { prisma } from './utils/prisma.js';
import { fetchVideoStats, fetchVideoRevenue } from './utils/youtube.js';
import { checkQuota, recordIngestionRun } from './quota.js';

export async function runIngestionCycle() {
  const start = Date.now();
  const published = await prisma.scheduledPublish.findMany({
    where: { status: 'published' },
    select: { tenantId: true, jobId: true, platformResponse: true },
  });

  let unitsConsumed = 0;
  for (const row of published) {
    const videoId = row.platformResponse?.videoId;
    if (!videoId) continue;
    // ~3 units per video stats fetch + ~1 for quota check
    if (!await checkQuota(3)) break;   // defer rest of cycle (quota exhausted)

    const stats = await fetchVideoStats(process.env.YOUTUBE_API_KEY!, videoId);
    const dateKey = new Date(); dateKey.setHours(0,0,0,0);

    await prisma.platformMetric.upsert({
      where: { videoId_platform_snapshotDate: { videoId, platform: 'youtube', snapshotDate: dateKey } },
      update: { views: stats.views, likes: stats.likes, comments: stats.comments, fetchedAt: new Date() },
      create: { tenantId: row.tenantId, videoId, platform: 'youtube', snapshotDate: dateKey, ...stats },
    });
    unitsConsumed += 3;
  }

  await recordIngestionRun(unitsConsumed, 'completed');
}
```

### 2.4 `services/analytics-ingest/src/revenue.ts`

```typescript
// services/analytics-ingest/src/revenue.ts
import { prisma } from './utils/prisma.js';
import { fetchVideoRevenue } from './utils/youtube.js';
import { checkQuota, recordIngestionRun } from './quota.js';

export async function runRevenueCycle() {
  const published = await prisma.scheduledPublish.findMany({ where: { status: 'published' } });
  let unitsConsumed = 0;
  for (const row of published) {
    const videoId = row.platformResponse?.videoId;
    if (!videoId) continue;
    if (!await checkQuota(10)) break;   // analytics reports are more expensive

    const revenue = await fetchVideoRevenue(token, channelId, videoId, 'today', 'today');
    if (revenue != null) {
      await prisma.videoRevenue.upsert({
        where: { videoId_platform_period: { videoId, platform: 'youtube', period: dateKeyString() } },
        update: { revenue, fetchedAt: new Date() },
        create: { tenantId: row.tenantId, videoId, platform: 'youtube', revenue, period: dateKeyString() },
      });
    }
    unitsConsumed += 10;
  }
  await recordIngestionRun(unitsConsumed, 'completed');
}
```

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Ingestion scheduler registered (BullMQ repeatable) | Queue inspection |
| 2 | Stats + revenue fetched (mock adapter) | E2E / unit test |
| 3 | Idempotent upsert (no double-count on retry) | E2E: re-run produces no duplicates |
| 4 | Quota respected; cycle defers when budget exhausted | Unit test |
| 5 | `analytics_ingestion_log` records each cycle | DB check |
| 6 | `pnpm run typecheck` + `pnpm run build` pass | CI check |

---

## 4. Implementation Notes

- **Idempotency** — upsert keyed by the unique constraints (Issue 10.1); a re-run updates, never duplicates.
- **Quota defer** — when `checkQuota` fails mid-cycle, the worker breaks and defers the rest to the next scheduled run (ADR-0009).
- **Revenue null** — skip `video_revenue` row when revenue is not available (not double-counted).

---

## 5. Definition of Done

- [ ] Scheduler + ingestion worker work
- [ ] Idempotent upserts verified
- [ ] Quota ledger respected
- [ ] Typecheck/build pass; unit tests (≥80% coverage)

---

## 6. Cross-References

- **Sprint Plan:** [README.md](./README.md)
- **Architecture:** [platform-analytics-architecture.md](../architecture/platform-analytics-architecture.md)
- **ADR-0009 (ingestion + quota):** [../../adr/ADR-0009-platform-analytics-ingestion.md](../../adr/ADR-0009-platform-analytics-ingestion.md)
