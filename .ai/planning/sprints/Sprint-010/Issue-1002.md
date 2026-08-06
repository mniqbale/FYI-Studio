---
id: sprint-010-issue-1002
title: "Issue 10.2 — YouTube Client + Quota Ledger"
owner: "Lead Engineer (AI Agent)"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-issue"
tags: [sprint-010, issue-1002, youtube, client, quota, ledger, api]
related_documents:
  - "README.md"
  - "platform-analytics-architecture.md"
  - "platform-analytics-stack-proposal.md"
  - "Issue-1001.md"
related_sprint: "Sprint-010"
---

# Issue 10.2 — YouTube Client + Quota Ledger

> **Sprint:** 10 (Milestone 11: Platform Analytics & Revenue)  
> **Estimate:** M (3-5 hours)  
> **Dependencies:** Issue 10.1 (Schema)  
> **Blockers:** None

---

## 1. Objective

Implement the **YouTube client** (Data API v3 + YouTube Analytics API) and the **joint quota ledger** that tracks the 10k-unit/day budget shared with uploads (ADR-0008). This is the core of the hard quota constraint (ADR-0009).

---

## 2. Deliverables

### 2.1 `services/analytics-ingest/src/utils/youtube.ts` (YouTube client)

```typescript
// services/analytics-ingest/src/utils/youtube.ts
// YouTube Data API v3 + YouTube Analytics API client (fetch-based, no heavy SDK).

export async function fetchVideoStats(apiKey: string, videoId: string) {
  // GET videos.list?part=statistics&id=<videoId> (~1-3 units)
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${apiKey}`);
  const data = await res.json();
  const item = data.items?.[0];
  return {
    views: Number(item?.statistics?.viewCount ?? 0),
    likes: Number(item?.statistics?.likeCount ?? 0),
    comments: Number(item?.statistics?.commentCount ?? 0),
  };
}

export async function fetchVideoRevenue(accessToken: string, channelId: string, videoId: string, from: string, to: string) {
  // YouTube Analytics API reports.query — revenue data; more expensive per call.
  // Gracefully handles null when revenue is not eligible/available.
  const res = await fetch(
    `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==${channelId}&metrics=estimatedRevenue&dimensions=video&filters=video==${videoId}&startDate=${from}&endDate=${to}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return data?.rows?.[0]?.[1] ?? null;   // null when not eligible
}
```

### 2.2 `services/analytics-ingest/src/quota.ts` (Joint quota ledger)

```typescript
// services/analytics-ingest/src/quota.ts
import { prisma } from './utils/prisma.js';

export const QUOTA_LIMIT = Number(process.env.QUOTA_LIMIT ?? 10000);

// Units consumed today = analytics reads (this workstream) + uploads (ADR-0008)
// Uploads are recorded by the publish pipeline into the same daily budget.
export async function usedUnitsToday(): Promise<number> {
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const agg = await prisma.analyticsIngestionLog.aggregate({
    _sum: { unitsConsumed: true },
    where: { runStartedAt: { gte: startOfDay } },
  });
  // + units reserved by publish uploads (ADR-0008): 1600 each for today's scheduled publishes
  const uploadsToday = await publishUploadsReservedToday();
  return (agg._sum.unitsConsumed ?? 0) + uploadsToday;
}

export async function checkQuota(unitsNeeded: number): Promise<boolean> {
  return (await usedUnitsToday() + unitsNeeded) <= QUOTA_LIMIT;
}

export async function recordIngestionRun(unitsConsumed: number, status: string, error?: unknown) {
  await prisma.analyticsIngestionLog.create({
    data: { unitsConsumed, unitsRemaining: QUOTA_LIMIT - (await usedUnitsToday()), status, error: error as any },
  });
}
```

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `fetchVideoStats` returns views/likes/comments (mock) | Unit test |
| 2 | `fetchVideoRevenue` returns revenue or null (mock) | Unit test |
| 3 | `checkQuota` respects the 10k/day limit | Unit test (over/under budget) |
| 4 | Quota ledger accounts for uploads (ADR-0008: 1,600/upload) | Unit test |
| 5 | `recordIngestionRun` writes `analytics_ingestion_log` | DB check |
| 6 | `pnpm run typecheck` + `pnpm run build` pass | CI check |

---

## 4. Implementation Notes

- **Fetch-based client** — consistent with `@fyi/ai` adapters (no heavy SDK).
- **Joint quota** — the ledger includes today's publish upload reservations (ADR-0008), so ingestion never starves uploads and vice versa.
- **Revenue null** — handle gracefully; revenue not always available/eligible (ADR-0009).

---

## 5. Definition of Done

- [ ] YouTube client (Data + Analytics API) implemented
- [ ] Joint quota ledger works
- [ ] Ingestion log records each run
- [ ] Typecheck/build pass; unit tests (≥80% coverage)

---

## 6. Cross-References

- **Sprint Plan:** [README.md](./README.md)
- **Architecture:** [platform-analytics-architecture.md](../architecture/platform-analytics-architecture.md)
- **ADR-0009 (quota / shared budget):** [../../adr/ADR-0009-platform-analytics-ingestion.md](../../adr/ADR-0009-platform-analytics-ingestion.md)
- **ADR-0008 (uploads, 1,600 units):** [../../adr/ADR-0008-social-publish-scheduling.md](../../adr/ADR-0008-social-publish-scheduling.md)
