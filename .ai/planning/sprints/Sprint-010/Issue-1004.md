---
id: sprint-010-issue-1004
title: "Issue 10.4 — Memory Feedback + Dashboard Views"
owner: "Lead Engineer (AI Agent)"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-issue"
tags: [sprint-010, issue-1004, memory, dashboard, platform-views, revenue, charts, feedback]
related_documents:
  - "README.md"
  - "platform-analytics-architecture.md"
  - "platform-analytics-stack-proposal.md"
  - "Issue-1003.md"
related_sprint: "Sprint-010"
---

# Issue 10.4 — Memory Feedback + Dashboard Views

> **Sprint:** 10 (Milestone 11: Platform Analytics & Revenue)  
> **Estimate:** M (3-5 hours)  
> **Dependencies:** Issue 10.3 (Ingestion worker)  
> **Blockers:** None

---

## 1. Objective

- Write ingestion results to the **Memory Layer** (`memory_entries` kind: `analytics`) as reflection for future content (M4/M7 pattern).
- Add **read-only Dashboard views** over the local `platform_metrics` / `video_revenue` tables — the Dashboard **never** calls a platform API.

---

## 2. Deliverables

### 2.1 `services/analytics-ingest/src/utils/memory.ts` (Memory feedback)

```typescript
// services/analytics-ingest/src/utils/memory.ts
import { prisma } from './utils/prisma.js';

// After a successful ingestion cycle, write a reflection entry per video.
export async function writeAnalyticsMemory(tenantId: string, videoId: string, stats: { views: number; likes: number; revenue: number | null }, dateKey: string) {
  await prisma.memoryEntry.create({
    data: {
      tenantId,
      kind: 'analytics',
      summary: `Video ${videoId}: ${stats.views} views, ${stats.likes} likes, $${stats.revenue ?? 'n/a'} revenue (${dateKey})`,
    },
  });
}
```

### 2.2 `services/dashboard/src/routes/platform.ts` (Read-only platform views)

```typescript
// services/dashboard/src/routes/platform.ts
import { FastifyInstance } from 'fastify';
import { prisma } from '../utils/prisma.js';
import { analytics } from '@fyi/analytics';

export async function platformRoutes(app: FastifyInstance) {
  // Performance over time (READS LOCAL TABLES ONLY — never the platform API)
  app.get('/api/platform/performance', async (req, reply) => {
    const rows = await prisma.platformMetric.findMany({
      orderBy: { snapshotDate: 'asc' },
      select: { videoId: true, snapshotDate: true, views: true, likes: true, comments: true, watchTimeMinutes: true },
    });
    return reply.send({ performance: rows });
  });

  // Revenue per video / over time
  app.get('/api/platform/revenue', async (req, reply) => {
    const rows = await prisma.videoRevenue.findMany({ orderBy: { fetchedAt: 'asc' } });
    return reply.send({ revenue: rows });
  });

  // Quota usage today
  app.get('/api/platform/quota', async (req, reply) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const agg = await prisma.analyticsIngestionLog.aggregate({ _sum: { unitsConsumed: true }, where: { runStartedAt: { gte: today } } });
    return reply.send({ used: agg._sum.unitsConsumed ?? 0, limit: 10000, remaining: 10000 - (agg._sum.unitsConsumed ?? 0) });
  });

  // HTML page with Chart.js charts
  app.get('/platform', async (req, reply) => {
    const [performance, revenue] = await Promise.all([
      prisma.platformMetric.findMany(), prisma.videoRevenue.findMany(),
    ]);
    return reply.type('text/html').send(renderPlatformPage({ performance, revenue }));
  });
}
```

### 2.3 `services/dashboard/src/templates/platform.ts` (charts)

Renders Chart.js charts (views over time, revenue per video, engagement) from the local JSON — mirroring the existing analytics page pattern.

### 2.4 Register in `services/dashboard/src/routes/index.ts`

Add `platformRoutes(app)` to the registration.

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `memory_entries` (kind: analytics) written on successful cycle | DB check |
| 2 | `/api/platform/performance` reads local tables (no platform API) | Code review |
| 3 | `/api/platform/revenue` reads local tables | Code review |
| 4 | `/api/platform/quota` shows units used/remaining | Visual check |
| 5 | `/platform` page renders charts from local JSON | Visual check |
| 6 | **No platform API call anywhere in Dashboard routes** (hard constraint) | Code review + E2E guard |
| 7 | `pnpm run typecheck` + `pnpm run build` pass | CI check |

---

## 4. Implementation Notes

- **Memory feedback** — write a reflection entry per video per cycle; this connects performance data to the Context Assembly Engine for future content (M4).
- **Read-only** — these Dashboard views only SELECT local tables; no platform client in `services/dashboard` (ADR-0009 guardrail).

---

## 5. Definition of Done

- [ ] Memory feedback works
- [ ] Dashboard platform views render charts from local data
- [ ] No page-load platform API calls
- [ ] Typecheck/build pass; unit tests (≥80% coverage)

---

## 6. Cross-References

- **Sprint Plan:** [README.md](./README.md)
- **Architecture:** [platform-analytics-architecture.md](../architecture/platform-analytics-architecture.md)
- **Memory Layer (M4/M7):** [../../planning/sprints/Sprint-003/README.md](../../planning/sprints/Sprint-003/README.md)
- **Dashboard (read-only views):** [../architecture/dashboard-architecture.md](../architecture/dashboard-architecture.md)
