---
id: sprint-010-readme
title: "Sprint 10 — Platform Analytics & Revenue Implementation Plan (Milestone 11)"
owner: "Lead Engineer (AI Agent)"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-sprint"
tags: [sprint, planning, analytics, platform, youtube, revenue, quota, ingestion, milestone-11, implementation]
related_documents:
  - "platform-analytics-architecture.md"
  - "platform-analytics-stack-proposal.md"
  - "post-mvp-options.md"
  - "orchestration-delegation-brief.md"
  - "Issue-1001.md"
  - "Issue-1002.md"
  - "Issue-1003.md"
  - "Issue-1004.md"
  - "Issue-1005.md"
related_sprint: "Sprint-010"
---

# Sprint 10 — Platform Analytics & Revenue Implementation Plan (Milestone 11)

> **Status:** PROPOSED (pending Founder approval). This sprint implements **Milestone 11: Platform Analytics & Revenue** — ingesting content performance (views, likes, comments, watch time, **YouTube revenue per video**) into local tables under a hard YouTube API quota budget (ADR-0009), and feeding results back to the Memory Layer for future content.

---

## 1. Sprint Goal

**Build a scheduled platform analytics ingestion pipeline** that:
- Ingests YouTube stats + revenue into local tables (`platform_metrics`, `video_revenue`).
- Runs under a strict **quota ledger** (10k units/day, joint with uploads from ADR-0008).
- **Never calls a platform API on Dashboard page load** (reads local tables only).
- Feeds results to the **Memory Layer** as reflection for future content.
- Adds Dashboard read-only views for performance/revenue/engagement.

---

## 2. Scope

| In Scope | Out of Scope |
|----------|--------------|
| `platform_metrics`, `video_revenue`, `analytics_ingestion_log` tables (Prisma migration) | Auto-optimization engine (Option C) |
| YouTube Data API v3 + YouTube Analytics API client | A/B orchestration (Option D) |
| Quota ledger (joint with uploads, ADR-0008) | Facebook/Instagram/TikTok analytics (YouTube-first) |
| Scheduled ingestion worker (BullMQ repeatable) | Real-time streaming |
| Memory Layer feedback (`memory_entries` kind: analytics) | Real secret vault / auth (production hardening) |
| Dashboard read-only views over local tables | |
| Reuse `@fyi/database` + `@fyi/analytics` + `@fyi/knowledge` | |

---

## 3. Issues (Tasks)

| Issue | Title | Description | Est. | Dependencies |
|-------|-------|-------------|------|--------------|
| **10.1** | Analytics Store Schema | Add `platform_metrics`, `video_revenue`, `analytics_ingestion_log` + Prisma migration | S (1-2h) | None |
| **10.2** | YouTube Client + Quota Ledger | YouTube Data/Analytics API client + joint quota ledger (10k/day, shared with uploads) | M (3-5h) | 10.1 |
| **10.3** | Ingestion Worker | Fetch stats + revenue → idempotent upsert to local tables | M (3-5h) | 10.1, 10.2 |
| **10.4** | Memory Feedback + Dashboard Views | Write `memory_entries` (kind: analytics); Dashboard read-only charts | M (3-5h) | 10.3 |
| **10.5** | Ingestion E2E + Quota Verification | Mock YouTube adapter E2E + verify no page-load API + typecheck/build | S (1-2h) | 10.1-10.4 |

**Total Estimate: 13-22 hours**

---

## 4. Technical Approach

### 4.1 Package Structure
```
services/analytics-ingest/
├── package.json                   # @fyi/analytics-ingest
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts                   # Entry: start BullMQ repeatable ingestion job
│   ├── scheduler.ts               # BullMQ repeatable: daily ingestion cycle
│   ├── ingest.ts                  # Fetch YouTube stats → upsert local tables
│   ├── revenue.ts                 # YouTube Analytics API revenue fetch
│   ├── quota.ts                   # Quota ledger: track/check/defer
│   └── utils/
│       ├── prisma.ts
│       ├── youtube.ts             # YouTube Data API v3 + Analytics API client
│       └── memory.ts              # Write memory_entries (kind: analytics)
└── README.md
```

### 4.2 Key Patterns

**Quota ledger (hard constraint):**
```typescript
// quota.ts
export const QUOTA_LIMIT = Number(process.env.QUOTA_LIMIT ?? 10000);

export async function checkQuota(unitsNeeded: number): Promise<boolean> {
  const usedToday = await usedUnitsToday();  // from analytics_ingestion_log (incl. uploads via ADR-0008)
  return (usedToday + unitsNeeded) <= QUOTA_LIMIT;
}
```

**Idempotent upsert:**
```typescript
// ingest.ts
await prisma.platformMetric.upsert({
  where: { id: `${videoId}:${platform}:${dateKey}` },  // composite uniqueness
  update: { views, likes, comments, watchTimeMinutes, fetchedAt: new Date() },
  create: { tenantId, videoId, platform, snapshotDate, views, likes, comments, watchTimeMinutes },
});
```

**Memory feedback:**
```typescript
// memory.ts
await prisma.memoryEntry.create({ data: {
  tenantId, kind: 'analytics',
  summary: `Video ${videoId}: ${views} views, ${likes} likes, $${revenue} revenue (${dateKey})`,
}});
```

---

## 5. Acceptance Criteria (Definition of Done)

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Prisma migration adds `platform_metrics`, `video_revenue`, `analytics_ingestion_log` | `pnpm prisma migrate` + schema check |
| 2 | YouTube client (Data API + Analytics API) implemented | Unit tests with mocks |
| 3 | Quota ledger tracks units; joint with uploads (ADR-0008) | Unit tests + manual quota check |
| 4 | Ingestion worker fetches stats + revenue → idempotent upsert | E2E with mock YouTube adapter |
| 5 | `memory_entries` (kind: analytics) written on successful cycle | DB check |
| 6 | Dashboard `/api/platform/*` reads local tables only | Code review + E2E guard |
| 7 | **No Dashboard page-load platform API** (hard constraint) | Code review + E2E guard |
| 8 | `pnpm run typecheck` + `pnpm run build` pass | CI check |
| 9 | Unit tests for ingest + quota (≥80% coverage) | `pnpm test` |

---

## 6. Dependencies & Prerequisites

- **Social Publish (Milestone 10)** — provides published videos (`video_id`) to ingest analytics for.
- **MVP + Dashboard Complete** (Milestones 1–8 done).
- **PostgreSQL + Redis running** — `pnpm run infra:up`.
- **At least one published YouTube video** — for the ingestion E2E (mock adapter otherwise).
- **YouTube API key / OAuth** — for a real fetch; mock adapter used otherwise.
- **Node.js 20+, pnpm 9+**.

---

## 7. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Quota exhaustion (10k/day shared with uploads) | High | Medium | Joint quota ledger; skip/defer; configurable cadence |
| YouTube Analytics revenue availability | Medium | Medium | Graceful null; document eligibility; retry later |
| Idempotency / double-counting | Medium | Medium | Upsert keyed by `video_id` + platform + snapshot date |
| Page-load API regression | High | Low | Code review: no platform client in Dashboard routes; E2E guard |
| Data latency (daily batch) | Medium | Medium | Document "as of last sync"; configurable cadence |
| Memory spam | Low | Low | Coalesce per ingestion cycle; single summary entry |

---

## 8. Cross-References

- **Architecture:** [platform-analytics-architecture.md](../architecture/platform-analytics-architecture.md)
- **Stack Proposal:** [platform-analytics-stack-proposal.md](../planning/platform-analytics-stack-proposal.md)
- **Decision Record:** [post-mvp-options.md](../planning/post-mvp-options.md)
- **Delegation Brief:** [orchestration-delegation-brief.md](../planning/orchestration-delegation-brief.md)
- **ADR-0009 (Analytics ingestion + quota):** [../../adr/ADR-0009-platform-analytics-ingestion.md](../../adr/ADR-0009-platform-analytics-ingestion.md)
- **ADR-0008 (shared quota / published videos):** [../../adr/ADR-0008-social-publish-scheduling.md](../../adr/ADR-0008-social-publish-scheduling.md)
- **MVP Architecture:** [../../architecture/mvp-architecture.md](../../architecture/mvp-architecture.md)

---

## 9. Next Steps

1. Founder approves this sprint plan
2. Create Issue docs (1001-1005) with detailed acceptance criteria
3. Update `orchestration-delegation-brief.md` with finalized scope
4. Begin implementation: Issue 10.1 → 10.2 → 10.3 → 10.4 → 10.5
