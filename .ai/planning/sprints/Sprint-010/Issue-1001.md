---
id: sprint-010-issue-1001
title: "Issue 10.1 — Analytics Store Schema"
owner: "Lead Engineer (AI Agent)"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-issue"
tags: [sprint-010, issue-1001, schema, prisma, platform-metrics, video-revenue, ingestion-log, migration]
related_documents:
  - "README.md"
  - "platform-analytics-architecture.md"
  - "platform-analytics-stack-proposal.md"
related_sprint: "Sprint-010"
---

# Issue 10.1 — Analytics Store Schema

> **Sprint:** 10 (Milestone 11: Platform Analytics & Revenue)  
> **Estimate:** S (1-2 hours)  
> **Dependencies:** None  
> **Blockers:** None

---

## 1. Objective

Add the three new database tables for the analytics ingestion workstream (ADR-0009):
- **`platform_metrics`** — per-video content performance snapshots.
- **`video_revenue`** — YouTube revenue per video.
- **`analytics_ingestion_log`** — quota/run accounting.

These are **additive** tables; Contracts v1.1 remain frozen.

---

## 2. Deliverables

### 2.1 Prisma schema additions (`packages/database/prisma/schema.prisma`)

```prisma
model PlatformMetric {
  id                String   @id @default(uuid())
  tenantId          String
  videoId           String
  platform          String   @default("youtube")
  snapshotDate      DateTime
  views             Int      @default(0)
  likes             Int      @default(0)
  comments          Int      @default(0)
  watchTimeMinutes  Int      @default(0)
  retentionPct      Float?
  fetchedAt         DateTime @default(now())

  @@unique([videoId, platform, snapshotDate])
  @@index([tenantId, snapshotDate])
}

model VideoRevenue {
  id          String  @id @default(uuid())
  tenantId    String
  videoId     String
  platform    String  @default("youtube")
  revenue     Decimal
  currency    String  @default("USD")
  period      String
  fetchedAt   DateTime @default(now())

  @@unique([videoId, platform, period])
  @@index([tenantId])
}

model AnalyticsIngestionLog {
  id              String    @id @default(uuid())
  runStartedAt    DateTime  @default(now())
  runFinishedAt   DateTime?
  unitsConsumed   Int       @default(0)
  unitsRemaining  Int
  status          String    @default("running") // running | completed | failed | skipped_quota
  error           Json?

  @@index([runStartedAt])
}
```

### 2.2 Migration

```bash
cd packages/database
pnpm prisma migrate dev --name add_platform_analytics_store
pnpm prisma generate
```

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Migration applies cleanly | `pnpm prisma migrate status` clean |
| 2 | New models available in `@fyi/database` | `pnpm prisma generate` + typecheck |
| 3 | Uniqueness on `(videoId, platform, snapshotDate)` / `(videoId, platform, period)` for idempotency | Prisma schema check |
| 4 | No change to existing tables / Contracts v1.1 | Code review |
| 5 | `pnpm run typecheck` + `pnpm run build` pass | CI check |

---

## 4. Implementation Notes

- **Additive only** — do not modify existing models.
- **Idempotency** — uniqueness constraints key the upserts (Issue 10.3).
- **`unitsRemaining`** — supports the quota ledger (Issue 10.2).

---

## 5. Definition of Done

- [ ] Migration adds all three tables
- [ ] Prisma client regenerated
- [ ] Typecheck/build pass
- [ ] No changes to existing schema / Contracts v1.1

---

## 6. Cross-References

- **Sprint Plan:** [README.md](./README.md)
- **Architecture:** [platform-analytics-architecture.md](../architecture/platform-analytics-architecture.md)
- **ADR-0009 (Analytics ingestion + quota):** [../../adr/ADR-0009-platform-analytics-ingestion.md](../../adr/ADR-0009-platform-analytics-ingestion.md)
