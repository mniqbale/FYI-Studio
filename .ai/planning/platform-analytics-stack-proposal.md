---
id: platform-analytics-stack-proposal
title: "Platform Analytics & Revenue — Stack Proposal & Quota Strategy (Workstream C / Milestone 11)"
owner: "Lead Engineer (AI Agent) + Founder"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "pre-implementation"
tags: [analytics, platform, youtube, revenue, quota, ingestion, stack, proposal, rationale, post-mvp, milestone-11]
related_documents:
  - "post-mvp-options.md"
  - "orchestration-delegation-brief.md"
  - "platform-analytics-architecture.md"
  - "../architecture/mvp-architecture.md"
  - "../architecture/contracts.md"
  - "../adr/ADR-0009-platform-analytics-ingestion.md"
  - "../adr/ADR-0008-social-publish-scheduling.md"
---

# Platform Analytics & Revenue — Stack Proposal & Quota Strategy

> **Status:** PROPOSED (pending Founder approval). This document provides the **detailed technology stack recommendation with reasoning** and the **YouTube quota strategy** for **Platform Analytics & Revenue** — the post-MVP workstream that ingests content performance (views, likes, comments, watch time, **YouTube revenue per video**) into local tables. It expands the technical blueprint in `platform-analytics-architecture.md` and makes the hard quota constraint explicit.

---

## 1. Executive Summary

**Recommended Stack:**
| Layer | Choice | Version | Rationale Summary |
|-------|--------|---------|-------------------|
| **Runtime** | Node.js | 20 LTS | Consistency with entire monorepo; no new runtime |
| **Language** | TypeScript (ESM, strict) | 5.x | Type safety across stack; matches all packages |
| **Scheduler** | **BullMQ repeatable job / cron** | existing | Reuse queue infra (ADR-0004); drives the ingestion cron |
| **Ingestion Worker** | New `services/analytics-ingest` | — | Calls YouTube Data API v3 + YouTube Analytics API; writes local tables |
| **Platform Client** | **YouTube Data API v3 + YouTube Analytics API** | — | Primary source; free within quota |
| **Local Store** | PostgreSQL (`platform_metrics`, `video_revenue`, `analytics_ingestion_log`) | — | Source of truth for Dashboard reads; never page-load API |
| **Quota Ledger** | In-process + `analytics_ingestion_log` table | — | Tracks daily 10k units; joint with uploads (ADR-0008) |
| **Dashboard Integration** | Read-only views over local tables (Milestone 8 pattern) | — | Charts: views/revenue/engagement; no platform API |
| **Memory Feedback** | `memory_entries` (kind: `analytics`) | — | Reflection for future content (M4/M7 pattern) |
| **Deployment (MVP)** | Local dev server + background worker | — | Matches MVP "runs locally" posture |

**What we deliberately do NOT add (MVP):**
- ❌ No platform API on page load — **hard constraint** (10k/day quota)
- ❌ No third-party analytics SaaS — own the ingestion; free within quota
- ❌ No real-time streaming — scheduled batch ingestion is sufficient and quota-safe
- ❌ No new analytics store — reuse PostgreSQL; no separate warehouse

---

## 2. Decision Framework: Why This Stack?

### 2.1 Guiding Principles (from Constitution)

| Principle | How Stack Aligns |
|-----------|------------------|
| **Anti-Monster Policy** | Ingestion worker + quota planner are small, single-responsibility modules |
| **Documentation First, Code Second** | Stack + quota strategy fully documented before implementation |
| **Minimal Dependencies** | Reuse BullMQ (ADR-0004) + `@fyi/database` + `@fyi/analytics`; no new store |
| **Layering: Domain → Application → Infrastructure** | Ingestion is an Application/worker; writes to local Domain tables via Prisma |
| **Workers share ONLY `@fyi/contracts`** | The ingestion worker shares only contracts; the **service** may share `@fyi/database`/`@fyi/analytics` |
| **Quota is a first-class constraint** | The 10k/day YouTube budget drives every design decision (ADR-0009) |

### 2.2 Evaluation Criteria (Weighted)

| Criterion | Weight | BullMQ cron + local tables | SaaS analytics (YouTube Analytics partner) | Real-time streaming ingestion | Dashboard page-load API |
|-----------|--------|----------------------------|--------------------------------------------|-------------------------------|--------------------------|
| **Quota safety (10k/day)** | 30% | ✅ 10/10 (batch, budgeted) | ✅ 10/10 (SaaS quota) | ❌ 4/10 (bursty) | ❌ 2/10 (exhausts fast) |
| **Alignment with Anti-Monster** | 20% | ✅ 10/10 (small, existing) | ❌ 3/10 (external dep) | ⚠️ 5/10 (complex) | ⚠️ 5/10 |
| **Reuse of existing infra** | 20% | ✅ 10/10 (BullMQ + DB) | ⚠️ 5/10 | ❌ 3/10 (new) | ✅ 8/10 |
| **Revenue/monetization fit** | 15% | ✅ 10/10 (own YouTube Analytics API) | ⚠️ 5/10 (partner-only revenue) | ✅ 8/10 | ❌ 3/10 |
| **Maintenance Burden** | 15% | ✅ 9/10 | ⚠️ 5/10 (SaaS churn/cost) | ⚠️ 5/10 | ✅ 7/10 |

**Weighted Score: BullMQ cron + local tables = 9.8/10** — clear winner, and the only option that respects the hard quota constraint.

---

## 3. Detailed Stack Justification

### 3.1 The Hard Quota Constraint (why Dashboard never calls the API)

**YouTube Data API v3 free quota = 10,000 units/day.** Breakdown:
- **1,600 units per video upload** (`videos.insert`, ADR-0008).
- ~1–100 units per read depending on endpoint/parts (e.g. `videos.list` with many `part` values is more expensive).

If the Dashboard called the API on every page load, a single user session (multiple page views + video detail + charts) could consume hundreds-to-thousands of units, exhausting the day's budget and **blocking uploads**. This is unacceptable for a monetization platform. Therefore:
- **All platform API calls happen in scheduled cron workers** that write results to **local tables**.
- The **Dashboard reads only from local tables**, never the platform API.

### 3.2 Batch Ingestion over Real-Time Streaming

Content-performance metrics (views, likes, revenue) change over hours/days, not seconds. A **scheduled batch** (e.g. daily) is:
- Quota-safe — a bounded, budgeted number of API calls per day.
- Simple — a BullMQ repeatable job (ADR-0004 infra) with no streaming pipeline.
- Sufficient — the Dashboard shows "as of last sync" data, which is fine for content analytics.

### 3.3 Local Tables as the Source of Truth

`platform_metrics`, `video_revenue`, and `analytics_ingestion_log` in PostgreSQL:
- Give the Dashboard fast, quota-free reads.
- Provide a durable queryable history for charts and Memory Layer reflection.
- Make the quota ledger observable (`analytics_ingestion_log`).

### 3.4 YouTube Analytics API for Revenue

Revenue per video requires the **YouTube Analytics API** (reports), which is more expensive per call than Data API reads but is the source of monetization data. The ingestion worker calls it on a low cadence (e.g. daily) for eligible videos, and handles gracefully when revenue data is unavailable/not eligible (field may be null).

### 3.5 Quota Ledger (joint with uploads)

A running **quota ledger** tracks daily units consumed across **both** uploads (ADR-0008) and analytics reads. Before any run, the planner checks remaining units and skips/deferres fetches that would exceed the budget. This prevents any single workstream from starving the other.

---

## 4. Package Structure (New: `services/analytics-ingest`)

```
services/analytics-ingest/
├── package.json                   # name: "@fyi/analytics-ingest"
├── tsconfig.json
├── .env.example                   # DATABASE_URL, REDIS_URL, YOUTUBE_API_KEY_REF, QUOTA_LIMIT=10000
├── src/
│   ├── index.ts                   # Entry: start BullMQ repeatable ingestion job
│   ├── scheduler.ts               # BullMQ repeatable job: daily ingestion cycle
│   ├── ingest.ts                  # Fetch YouTube stats → upsert local tables
│   ├── revenue.ts                 # YouTube Analytics API revenue fetch
│   ├── quota.ts                   # Quota ledger: track/check/defer against daily budget
│   └── utils/
│       ├── prisma.ts              # Prisma singleton
│       ├── youtube.ts             # YouTube Data API v3 + Analytics API client
│       └── memory.ts              # Write memory_entries (kind: analytics)
└── README.md
```

**Root `package.json` additions:**
```json
{
  "scripts": {
    "analytics-ingest": "tsx services/analytics-ingest/src/index.ts",
    "analytics-ingest:dev": "tsx watch services/analytics-ingest/src/index.ts"
  }
}
```

---

## 5. API Contract (Read-only Dashboard views over local tables)

All endpoints read from **local tables** (`platform_metrics`, `video_revenue`) — never the platform API.

| Endpoint | Method | Returns | Source |
|----------|--------|---------|--------|
| `GET /api/platform/performance` | GET | Views/likes/comments/watch-time over time per video | `platform_metrics` |
| `GET /api/platform/revenue` | GET | Revenue per video / over time | `video_revenue` |
| `GET /api/platform/engagement` | GET | Engagement metrics + top/bottom performers | `platform_metrics` + `@fyi/analytics` |
| `GET /api/platform/quota` | GET | Quota usage today (units, remaining) | `analytics_ingestion_log` |

*(These are added to the Milestone 8 Dashboard as read-only pages, or to `services/settings`/`services/analytics-ingest`'s own thin read surface.)*

---

## 6. Data Flow Diagram

```
┌─────────────────┐  scheduled     ┌─────────────────────────────┐
│  BullMQ repeat  │ ─────────────► │  Ingestion Worker           │
│  (daily cron)   │                │  (services/analytics-ingest)│
└─────────────────┘                └──────────────┬──────────────┘
                                                  │  check quota ledger
                                                  ▼
                                        ┌─────────────────────────┐
                                        │  YouTube Data API v3 +  │
                                        │  YouTube Analytics API  │
                                        │  (units consumed)       │
                                        └────────────┬────────────┘
                                                     │  upsert (idempotent)
                                                     ▼
                              ┌──────────────────────────────────────────┐
                              │  LOCAL PostgreSQL tables                 │
                              │  platform_metrics • video_revenue •      │
                              │  analytics_ingestion_log                 │
                              └───────┬────────────────────┬─────────────┘
                                      │                    │
                                      ▼                    ▼
                              ┌────────────────┐   ┌────────────────────┐
                              │  Dashboard     │   │  Memory Layer      │
                              │  (read-only,   │   │  (memory_entries,  │
                              │  NEVER API)    │   │   kind: analytics) │
                              └────────────────┘   └────────────────────┘
```

**Key Invariants:**
1. **Dashboard NEVER calls the platform API on page load** (hard constraint).
2. **All platform calls happen in the scheduled cron worker** writing to local tables.
3. **Quota ledger is joint** with uploads (ADR-0008) — budget shared across publish + analytics.
4. **Ingestion is idempotent** (upsert by `video_id` + platform + snapshot date).
5. **Results feed Memory Layer** as reflection for future content (M4/M7 pattern).

---

## 7. Implementation Estimate (Sprint 10 / "Platform Analytics & Revenue")

| Step | Task | Est. | Notes |
|------|------|------|-------|
| 10.1 | `platform_metrics`, `video_revenue`, `analytics_ingestion_log` schema + migration | S (1-2h) | Prisma; additive tables |
| 10.2 | YouTube client (Data API + Analytics API) + quota ledger module | M (3-5h) | `quota.ts`; joint budget with uploads |
| 10.3 | Ingestion worker (fetch stats + revenue → upsert local tables) | M (3-5h) | Idempotent upserts; graceful null revenue |
| 10.4 | Memory Layer feedback + Dashboard read-only views (charts) | M (3-5h) | `memory_entries` kind: analytics; read-only pages |
| 10.5 | Ingestion E2E + quota-budget verification (mock YouTube adapter) | S (1-2h) | Typecheck/build/tests; verify no page-load API |

**Total: ~13-22h** (matches the Sprint 10 plan in `.ai/planning/sprints/Sprint-010/`).

---

## 8. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Quota exhaustion (10k/day shared with uploads) | High | Medium | Joint quota ledger; skip/defer logic; configurable cadence |
| YouTube Analytics revenue availability | Medium | Medium | Graceful null; document eligibility; retry later |
| Idempotency / double-counting | Medium | Medium | Upsert keyed by `video_id` + platform + snapshot date |
| Page-load API regression | High | Low | Code review: no platform client in Dashboard routes; E2E guard |
| Data latency (daily batch) | Medium | Medium | Document "as of last sync"; configurable cadence per tenant |
| Memory spam (too many reflection rows) | Low | Low | Coalesce per ingestion cycle; single summary entry |

---

## 9. Founder Decision Request

**Please review and confirm:**

1. **Stack approved?** BullMQ cron + `services/analytics-ingest` + YouTube Data/Analytics API → local tables.
2. **Quota strategy?** Joint 10k/day ledger shared with uploads; Dashboard never calls the API on page load.
3. **Local store?** `platform_metrics` + `video_revenue` + `analytics_ingestion_log` in PostgreSQL.
4. **Memory feedback?** Ingestion writes `memory_entries` (kind: analytics) for future content.
5. **Timeline acceptable?** ~13-22h (Sprint 10).

**If approved, next steps:**
- Create Milestone 11 architecture doc (`.ai/architecture/platform-analytics-architecture.md`).
- Create Sprint 10 plan + Issues 10.1–10.5 (`.ai/planning/sprints/Sprint-010/`).
- Update `orchestration-delegation-brief.md` for external agent delegation.
- Begin implementation.

---

## 10. Cross-References

- **Decision record:** [post-mvp-options.md](./post-mvp-options.md)
- **Delegation brief:** [orchestration-delegation-brief.md](./orchestration-delegation-brief.md)
- **Architecture (Milestone 11):** [platform-analytics-architecture.md](../architecture/platform-analytics-architecture.md)
- **ADR-0009 (Analytics ingestion + quota):** [../adr/ADR-0009-platform-analytics-ingestion.md](../adr/ADR-0009-platform-analytics-ingestion.md)
- **ADR-0008 (Publish, shared quota):** [../adr/ADR-0008-social-publish-scheduling.md](../adr/ADR-0008-social-publish-scheduling.md)
- **Thin Orchestrator / BullMQ:** [../adr/ADR-0004-thin-orchestrator.md](../adr/ADR-0004-thin-orchestrator.md)
- **MVP architecture / analytics:** [../architecture/mvp-architecture.md](../architecture/mvp-architecture.md)
