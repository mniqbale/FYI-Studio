---
id: platform-analytics-architecture
title: "FYI Studio Platform Analytics & Revenue Architecture (Milestone 11)"
owner: "Principal Architect"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-milestone"
tags: [architecture, analytics, platform, youtube, revenue, quota, ingestion, milestone-11, post-mvp]
related_documents:
  - "mvp-architecture.md"
  - "contracts.md"
  - "engineering-standards.md"
  - "dashboard-architecture.md"
  - "social-publish-architecture.md"
  - "../planning/platform-analytics-stack-proposal.md"
  - "../planning/post-mvp-options.md"
  - "../planning/sprints/Sprint-010/README.md"
related_adr:
  - "ADR-0001"
  - "ADR-0004"
  - "ADR-0008"
  - "ADR-0009"
related_sprint:
  - "Sprint-010"
---

# FYI Studio Platform Analytics & Revenue Architecture — Milestone 11

> **Status:** PROPOSED (pending Founder approval). This document defines the architecture for **Platform Analytics & Revenue** — the post-MVP workstream that ingests content performance (views, likes, comments, watch time, **YouTube revenue per video**) into local tables, under a hard YouTube API quota budget (ADR-0009). Results feed back to the Memory Layer as reflection for producing future content.

---

## 1. Purpose & Scope

### 1.1 Why Platform Analytics & Revenue?

The MVP aggregates **internal** telemetry (cost, tokens, duration). It does **not** capture **external** content performance or **revenue**. This workstream closes that gap:
- Ingest views, likes, comments, watch time, and **YouTube revenue per video** from the platform.
- Store results in **local PostgreSQL tables** so the Dashboard reads quickly, never on page load.
- Feed results to the **Memory Layer** as reflection for producing future content (learning loop).

### 1.2 The Hard Constraint (from ADR-0009)

**YouTube Data API v3 free quota = 10,000 units/day.** Uploads cost **1,600 units each** (ADR-0008). Reads cost ~1–100 units. Therefore:
- The **Dashboard NEVER calls platform APIs on page load**.
- All platform API calls happen in **scheduled cron workers** that write to **local tables**.

### 1.3 Scope (MVP)

**In Scope:**
- `platform_metrics`, `video_revenue`, `analytics_ingestion_log` tables (Prisma migration).
- YouTube Data API v3 + YouTube Analytics API client.
- Quota ledger (joint with uploads from ADR-0008).
- Scheduled ingestion worker (BullMQ repeatable / cron).
- Memory Layer feedback (`memory_entries` kind: `analytics`).
- Dashboard read-only views over local tables (views/revenue/engagement charts).

**Out of Scope (Post-MVP / Deferred):**
- Auto-optimization engine (recipe mutation from retention) — post-MVP Option C.
- A/B orchestration — post-MVP Option D.
- Facebook/Instagram/TikTok analytics ingestion (YouTube-first).
- Real-time streaming; real secret vault; auth (production hardening).

---

## 2. Architectural Positioning

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FYI STUDIO SYSTEM (MVP + M11)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────┐        ┌──────────────────────────────────┐     │
│  │  services/analytics-    │        │  Dashboard (M8) read-only        │     │
│  │  ingest (NEW - M11)     │        │  • /api/platform/* charts        │     │
│  │  • BullMQ repeatable    │        │  • reads LOCAL tables ONLY       │     │
│  │  • quota ledger         │        │  • NEVER platform API on load    │     │
│  └───────────┬─────────────┘        └───────────────────┬──────────────┘     │
│              │                                          │                    │
│              │  (scheduled cron)                        │  (SELECT only)     │
│              ▼                                          ▼                    │
│  ┌────────────────────────────────────────────────────────────────────┐      │
│  │              PostgreSQL (local analytics store)                    │      │
│  │  platform_metrics • video_revenue • analytics_ingestion_log        │      │
│  └───────┬────────────────────────────────────────────────────────────┘      │
│          │  upsert (idempotent)                                             │
│          ▼                                                                   │
│  ┌─────────────────────────┐        ┌──────────────────────────────────┐     │
│  │  YouTube Data API v3 +  │        │  Memory Layer (M4/M7)            │     │
│  │  YouTube Analytics API  │        │  • memory_entries (kind:         │     │
│  │  (units consumed)       │        │    analytics) → Context Assembly │     │
│  └─────────────────────────┘        │    for future content            │     │
│                                     └──────────────────────────────────┘     │
│                                                                              │
│  (Shared YouTube quota budget with ADR-0008 uploads: 10k/day)                │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Invariants:**
1. **Dashboard NEVER calls the platform API on page load** (hard constraint).
2. **All platform calls happen in the scheduled cron worker** writing to local tables.
3. **Quota ledger is joint** with uploads (ADR-0008) — budget shared across publish + analytics.
4. **Ingestion is idempotent** (upsert by `video_id` + platform + snapshot date).
5. **Results feed Memory Layer** as reflection (M4/M7 pattern).

---

## 3. Technology Stack

| Layer | Choice | Version | Rationale |
|-------|--------|---------|-----------|
| **Runtime** | Node.js | 20 LTS | Consistency with monorepo; no new runtime |
| **Language** | TypeScript (ESM, strict, NodeNext) | 5.x | Type safety; matches all packages |
| **Scheduler** | **BullMQ repeatable / cron** | existing | Reuse ADR-0004 infra; daily ingestion cycle |
| **Ingestion Worker** | `services/analytics-ingest` | — | Fetches stats + revenue → upsert local tables |
| **Platform Client** | **YouTube Data API v3 + YouTube Analytics API** | — | Primary source; free within quota |
| **Local Store** | PostgreSQL | — | `platform_metrics`, `video_revenue`, `analytics_ingestion_log` |
| **Quota Ledger** | In-process + `analytics_ingestion_log` | — | Track daily units; joint with uploads |
| **Dashboard** | Read-only views over local tables | — | Milestone 8 pattern; no platform API |
| **Memory** | `@fyi/knowledge` (memory_entries) | 1.x | Reflection for future content |

**Dependencies (`services/analytics-ingest/package.json`):**
```json
{
  "dependencies": {
    "bullmq": "^5.x",
    "ioredis": "^5.x",
    "@fyi/database": "workspace:*",
    "@fyi/analytics": "workspace:*",
    "@fyi/knowledge": "workspace:*"
  }
}
```

---

## 4. Package Structure

```
services/analytics-ingest/
├── package.json                   # @fyi/analytics-ingest
├── tsconfig.json
├── .env.example                   # DATABASE_URL, REDIS_URL, YOUTUBE_API_KEY_REF, QUOTA_LIMIT=10000
├── src/
│   ├── index.ts                   # Entry: start BullMQ repeatable ingestion job
│   ├── scheduler.ts               # BullMQ repeatable: daily ingestion cycle
│   ├── ingest.ts                  # Fetch YouTube stats → upsert local tables
│   ├── revenue.ts                 # YouTube Analytics API revenue fetch
│   ├── quota.ts                   # Quota ledger: track/check/defer against daily budget
│   └── utils/
│       ├── prisma.ts              # Prisma singleton
│       ├── youtube.ts             # YouTube Data API v3 + Analytics API client
│       └── memory.ts              # Write memory_entries (kind: analytics)
└── README.md
```

---

## 5. API Contract (Read-only Dashboard views over local tables)

| Endpoint | Method | Returns | Source |
|----------|--------|---------|--------|
| `GET /api/platform/performance` | GET | Views/likes/comments/watch-time over time per video | `platform_metrics` |
| `GET /api/platform/revenue` | GET | Revenue per video / over time | `video_revenue` |
| `GET /api/platform/engagement` | GET | Engagement metrics + top/bottom performers | `platform_metrics` + `@fyi/analytics` |
| `GET /api/platform/quota` | GET | Quota usage today (units, remaining) | `analytics_ingestion_log` |

---

## 6. Data Flow

### 6.1 Daily Ingestion Cycle (scheduled)

```
BullMQ repeatable job (e.g. daily 00:00 UTC)
       ▼
quota.ts: check remaining units in ledger (joint with uploads)
       ▼
ingest.ts: for each tenant's published videos →
  YouTube Data API v3 videos.list (stats: views, likes, comments, watch time)
       ▼
revenue.ts: for eligible videos → YouTube Analytics API (revenue per video)
       ▼
upsert into platform_metrics / video_revenue (idempotent by video_id+platform+date)
       ▼
write analytics_ingestion_log row (units consumed, status)
       ▼
memory.ts: write memory_entries (kind: analytics) summarizing performance
```

### 6.2 Dashboard Read (page load — local only)

```
Browser → GET /api/platform/performance
       ▼
Dashboard route → SELECT platform_metrics (local)
       ▼
JSON → Chart.js chart
```

---

## 7. Database Schema (new tables)

### 7.1 `platform_metrics`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `tenant_id` | String | FK |
| `video_id` | String | YouTube video id |
| `platform` | String | `youtube` (primary) |
| `snapshot_date` | DateTime | day of snapshot |
| `views` | Int | |
| `likes` | Int | |
| `comments` | Int | |
| `watch_time_minutes` | Int | |
| `retention_pct` | Float? | if available |
| `fetched_at` | DateTime | |

### 7.2 `video_revenue`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `tenant_id` | String | FK |
| `video_id` | String | YouTube video id |
| `platform` | String | `youtube` |
| `revenue` | Decimal | amount |
| `currency` | String | e.g. USD |
| `period` | String | period label |
| `fetched_at` | DateTime | |

### 7.3 `analytics_ingestion_log`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `run_started_at` | DateTime | |
| `run_finished_at` | DateTime? | |
| `units_consumed` | Int | |
| `units_remaining` | Int | |
| `status` | String enum | `running` \| `completed` \| `failed` \| `skipped_quota` |
| `error` | JSONB? | |

---

## 8. Root Package.json Integration

```json
// /workspaces/FYI-Studio/package.json
{
  "scripts": {
    "analytics-ingest": "tsx services/analytics-ingest/src/index.ts",
    "analytics-ingest:dev": "tsx watch services/analytics-ingest/src/index.ts"
  }
}
```

---

## 9. Environment Variables

```bash
# services/analytics-ingest/.env.example
DATABASE_URL=postgresql://user:pass@localhost:5432/fyi_studio
REDIS_URL=redis://localhost:6379
YOUTUBE_API_KEY_REF=env        # YouTube API key via secret manager / env
QUOTA_LIMIT=10000              # daily units
INGEST_INTERVAL_MS=86400000    # daily
LOG_LEVEL=info
```

---

## 10. Definition of Done (Milestone 11)

| Criterion | Verification |
|-----------|--------------|
| Prisma migration adds `platform_metrics`, `video_revenue`, `analytics_ingestion_log` | `pnpm prisma migrate` + schema check |
| YouTube client (Data API + Analytics API) implemented | Unit tests with mocks |
| Quota ledger tracks units; joint with uploads (ADR-0008) | Unit tests + manual quota check |
| Ingestion worker fetches stats + revenue → upserts local tables | E2E with mock YouTube adapter |
| Ingestion idempotent (no double-count on retry) | E2E: re-run produces no duplicates |
| `memory_entries` (kind: analytics) written on successful cycle | DB check |
| Dashboard `/api/platform/*` reads local tables only | Code review + E2E guard: no platform client in routes |
| No Dashboard page-load platform API | Code review + E2E guard |
| `pnpm run typecheck` + `pnpm run build` pass | CI check |
| Unit tests for ingest + quota (≥80% coverage) | `pnpm test` |

---

## 11. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Quota exhaustion (10k/day shared with uploads) | High | Medium | Joint quota ledger; skip/defer; configurable cadence |
| YouTube Analytics revenue availability | Medium | Medium | Graceful null; document eligibility; retry later |
| Idempotency / double-counting | Medium | Medium | Upsert keyed by `video_id` + platform + snapshot date |
| Page-load API regression | High | Low | Code review: no platform client in Dashboard routes; E2E guard |
| Data latency (daily batch) | Medium | Medium | Document "as of last sync"; configurable cadence |
| Memory spam | Low | Low | Coalesce per ingestion cycle; single summary entry |

---

## 12. Cross-References

- **Stack Proposal:** [../planning/platform-analytics-stack-proposal.md](../planning/platform-analytics-stack-proposal.md)
- **Decision Record:** [../planning/post-mvp-options.md](../planning/post-mvp-options.md)
- **Delegation Brief:** [../planning/orchestration-delegation-brief.md](../planning/orchestration-delegation-brief.md)
- **Sprint Plan:** [../planning/sprints/Sprint-010/README.md](../planning/sprints/Sprint-010/README.md)
- **ADR-0009 (Analytics ingestion + quota):** [../adr/ADR-0009-platform-analytics-ingestion.md](../adr/ADR-0009-platform-analytics-ingestion.md)
- **ADR-0008 (Publish, shared quota):** [../adr/ADR-0008-social-publish-scheduling.md](../adr/ADR-0008-social-publish-scheduling.md)
- **Thin Orchestrator / BullMQ:** [../adr/ADR-0004-thin-orchestrator.md](../adr/ADR-0004-thin-orchestrator.md)
- **MVP Architecture:** [mvp-architecture.md](mvp-architecture.md)
- **Dashboard (read-only views):** [dashboard-architecture.md](dashboard-architecture.md)
- **Publish (source of videos):** [social-publish-architecture.md](social-publish-architecture.md)
- **Frozen Contracts:** [contracts.md](contracts.md)

---

## 13. Next Steps (Upon Approval)

1. Create Sprint 10 plan: `.ai/planning/sprints/Sprint-010/README.md`
2. Create Issues 10.1–10.5: `.ai/planning/sprints/Sprint-010/Issue-1001.md` through `Issue-1005.md`
3. Update `orchestration-delegation-brief.md` with finalized scope
4. Scaffold `services/analytics-ingest` package
5. Begin implementation per Sprint 10 plan
