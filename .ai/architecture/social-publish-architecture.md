---
id: social-publish-architecture
title: "FYI Studio Social Publish & Scheduling Architecture (Milestone 10)"
owner: "Principal Architect"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-milestone"
tags: [architecture, publish, scheduling, social, youtube, monetization, milestone-10, bullmq, post-mvp]
related_documents:
  - "mvp-architecture.md"
  - "contracts.md"
  - "engineering-standards.md"
  - "settings-ai-workspace-architecture.md"
  - "../planning/social-publish-stack-proposal.md"
  - "../planning/post-mvp-options.md"
  - "../planning/sprints/Sprint-009/README.md"
related_adr:
  - "ADR-0001"
  - "ADR-0003"
  - "ADR-0004"
  - "ADR-0008"
  - "ADR-0009"
related_sprint:
  - "Sprint-009"
---

# FYI Studio Social Publish & Scheduling Architecture — Milestone 10

> **Status:** PROPOSED (pending Founder approval). This document defines the architecture for **Social Publish & Scheduling** — the post-MVP workstream that publishes approved content to social platforms (YouTube Channel, Facebook, Instagram, TikTok) on schedule. **YouTube is the primary monetization target** (ADR-0008). It extends the MVP with a **background publishing worker + scheduler** and adds two tables.

---

## 1. Purpose & Scope

### 1.1 Why Publish & Scheduling?

The MVP produces a full video and leaves it in the Job Ledger for human review. To monetize, the Founder must get approved content onto live platforms on a schedule. This workstream adds:
- A **social account registry** (`social_accounts`) of connected accounts per tenant.
- A **scheduling table** (`scheduled_publishes`) of what to publish and when.
- A **publishing worker** that uploads the approved video to a platform.
- A **scheduler** (BullMQ repeatable) that triggers due publishes.

### 1.2 Scope (MVP)

**In Scope:**
- `social_accounts` + `scheduled_publishes` tables (Prisma migration).
- Social account registry CRUD (via Settings UI, Milestone 9).
- Publishing worker (`services/publish` + `workers/publish-real`).
- **YouTube adapter** (Data API v3 `videos.insert`) — primary monetization target.
- BullMQ repeatable scheduler: find due publishes → enqueue → publish → write result.
- Platform URL written back to `scheduled_publishes.platform_response` + `jobs.artifacts.published`.

**Out of Scope (Post-MVP / Deferred):**
- Facebook / Instagram / TikTok adapters (behind the adapter interface; YouTube-first).
- Analytics & revenue ingestion (Milestone 11 — ADR-0009).
- Real secret vault (env for local MVP; production hardening).
- Auth/authorization (production hardening).

---

## 2. Architectural Positioning

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FYI STUDIO SYSTEM (MVP + M10)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐     ┌──────────────────┐    ┌─────────────────────┐    │
│  │  Settings UI     │     │  services/publish│    │  services/analytics │    │
│  │  (M9, forms)     │     │  (NEW - M10)     │    │  -ingest (M11)      │    │
│  │  social_accounts │     │  Scheduler +     │    │  (read-back revenue)│    │
│  │  schedule        │     │  handler         │    └──────────┬──────────┘    │
│  └────────┬─────────┘     └────────┬─────────┘               │               │
│           │                        │                         │               │
│           ▼                        ▼                         │               │
│  ┌──────────────────────────────────────────────────────┐    │               │
│  │              PostgreSQL (Job Ledger)                 │    │               │
│  │  social_accounts • scheduled_publishes • jobs •      │    │               │
│  │  platform_response/artifacts.published               │◄───┘               │
│  └──────────────────────────┬───────────────────────────┘                    │
│                             │                                                │
│                             ▼  (due publishes)                               │
│                    ┌─────────────────────────┐                               │
│                    │  publish-queue (BullMQ) │                               │
│                    └────────────┬────────────┘                               │
│                                 ▼                                            │
│                    ┌─────────────────────────┐                               │
│                    │  Publishing Worker      │                               │
│                    │  workers/publish-real   │                               │
│                    │  YouTube Data API v3    │                               │
│                    └────────────┬────────────┘                               │
│                                 ▼                                            │
│                    ┌─────────────────────────┐                               │
│                    │  YouTube Channel        │  ◄── primary monetization     │
│                    │  (video_id returned)    │                               │
│                    └─────────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Invariants:**
1. **Publishing is always a background worker** — never on Dashboard page load.
2. **Uploads use file pointers** (ADR-0003) — no binary through the orchestrator.
3. **Supervisor stays sole writer to job status** (ADR-0004) — publishing writes to `scheduled_publishes`/artifacts, not job status.
4. **YouTube quota shared with analytics** (ADR-0009) — 1,600 units/upload against the 10k/day budget.
5. **Credentials by reference** — OAuth `token_ref` in DB; material in secret manager (ADR-0006 pattern).

---

## 3. Technology Stack

| Layer | Choice | Version | Rationale |
|-------|--------|---------|-----------|
| **Runtime** | Node.js | 20 LTS | Consistency with monorepo; no new runtime |
| **Language** | TypeScript (ESM, strict, NodeNext) | 5.x | Type safety; matches all packages |
| **Queue / Scheduling** | **BullMQ repeatable jobs** | existing | Reuse ADR-0004 queue infra; no new scheduler |
| **Publishing Worker** | `workers/publish-real` | — | Consumes `publish-queue`; platform adapter |
| **Platform Adapter** | **YouTube Data API v3** (`videos.insert`) | — | Primary monetization; direct upload + video_id |
| **Credential Store** | Secret manager + `token_ref` | — | ADR-0006/0007 pattern |
| **Data Access** | `@fyi/database` (Prisma) | 5.x | `social_accounts`, `scheduled_publishes` |
| **Deployment (MVP)** | Local dev server + background worker | — | Matches MVP posture |

**Dependencies (`services/publish/package.json`):**
```json
{
  "dependencies": {
    "bullmq": "^5.x",
    "ioredis": "^5.x",
    "@fyi/database": "workspace:*"
  }
}
```

---

## 4. Package Structure

```
services/publish/                    # Scheduler + orchestration (service)
├── package.json                     # @fyi/publish
├── tsconfig.json
├── .env.example                     # DATABASE_URL, REDIS_URL, YOUTUBE_OAUTH_REF
├── src/
│   ├── index.ts                     # Entry: start scheduler + worker
│   ├── scheduler.ts                 # BullMQ repeatable: find due scheduled_publishes → enqueue
│   ├── handler.ts                   # publish-queue consumer → dispatch to platform adapter
│   └── utils/
│       ├── prisma.ts                # Prisma singleton
│       └── secret.ts                # Resolve token_ref → secret manager value
└── README.md

workers/publish-real/                # Platform adapter worker (worker — contracts only)
├── package.json                     # @fyi/publish-real
├── tsconfig.json
├── src/
│   ├── index.ts                     # BullMQ worker for publish-queue
│   ├── adapters/
│   │   ├── youtube.ts               # YouTube Data API v3 videos.insert
│   │   └── types.ts                 # PlatformAdapter interface
│   └── publish.ts                   # Upload file pointer → platform; write result back
└── README.md
```

---

## 5. API Contract (Scheduling via Settings UI — not the read-only Dashboard)

| Endpoint / Surface | Method | Purpose |
|--------------------|--------|---------|
| `services/settings` `/settings/social-accounts` | GET/POST | Connect/list/disconnect social accounts (OAuth token ref) |
| `services/settings` `/settings/schedules` | GET/POST | Create/list a scheduled publish for an approved job |
| `scheduler.ts` (BullMQ repeatable) | — | Finds due `scheduled_publishes` → enqueue `publish-queue` |
| `handler.ts` → `youtube.ts` | — | YouTube Data API `videos.insert`; write platform URL back |

---

## 6. Data Flow

### 6.1 Schedule a Publish (write via Settings UI)

```
Settings UI → POST /settings/schedules { job_id, social_account_id, scheduled_at }
       ▼
Insert row into scheduled_publishes (status: scheduled, scheduled_at: UTC)
```

### 6.2 Scheduler Fires (background)

```
BullMQ repeatable job (e.g. every 60s)
       ▼
SELECT * FROM scheduled_publishes
  WHERE status='scheduled' AND scheduled_at <= now()
       ▼
For each: mark status='publishing'; enqueue to publish-queue
```

### 6.3 Publishing Worker Uploads

```
publish-queue → workers/publish-real
       ▼
resolve token_ref → OAuth token (secret manager)
       ▼
YouTube Data API v3 videos.insert (file pointer from job.artifacts.video_url)
       ▼
write video_id + platform URL → scheduled_publishes.platform_response
write platform URL → jobs.artifacts.published
       ▼
mark scheduled_publishes.status='published'
```

---

## 7. Database Schema (new tables)

### 7.1 `social_accounts`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `tenant_id` | String | FK to tenant |
| `platform` | String enum | `youtube` \| `facebook` \| `instagram` \| `tiktok` |
| `display_name` | String | Account label |
| `account_ref` | String | Platform channel/account id |
| `token_ref` | String | OAuth credential reference (never the token) |
| `enabled` | Boolean | Default true |
| `connected_at` | DateTime | |
| `last_sync_at` | DateTime? | |

### 7.2 `scheduled_publishes`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `tenant_id` | String | FK |
| `job_id` | String | FK to approved job |
| `social_account_id` | UUID | FK to social_accounts |
| `scheduled_at` | DateTime | UTC; when to publish |
| `status` | String enum | `scheduled` \| `publishing` \| `published` \| `failed` |
| `platform_response` | JSONB? | video_id, url, error |
| `attempts` | Int | Default 0 |
| `created_at` / `updated_at` | DateTime | |

---

## 8. Root Package.json Integration

```json
// /workspaces/FYI-Studio/package.json
{
  "scripts": {
    "publish": "tsx services/publish/src/index.ts",
    "publish:dev": "tsx watch services/publish/src/index.ts",
    "worker:publish-real": "tsx workers/publish-real/src/index.ts"
  }
}
```

---

## 9. Environment Variables

```bash
# services/publish/.env.example
DATABASE_URL=postgresql://user:pass@localhost:5432/fyi_studio
REDIS_URL=redis://localhost:6379
YOUTUBE_OAUTH_REF=env       # OAuth token via secret manager / env
SCHEDULER_INTERVAL_MS=60000
LOG_LEVEL=info
```

---

## 10. Definition of Done (Milestone 10)

| Criterion | Verification |
|-----------|--------------|
| Prisma migration adds `social_accounts` + `scheduled_publishes` | `pnpm prisma migrate` + schema check |
| Settings UI connects/disconnects a YouTube account (token ref) | Visual + DB check (`social_accounts`) |
| Settings UI schedules a publish for an approved job | Visual + DB check (`scheduled_publishes`) |
| Scheduler (BullMQ repeatable) fires and enqueues due publishes | Logs + queue inspection |
| Publishing worker uploads via YouTube Data API v3 (mock adapter) | E2E with mock; real if key available |
| Platform URL + video_id written back to `platform_response` + `artifacts.published` | DB check |
| Failed upload retries with backoff (ADR-0004) | Logs + DB `attempts` |
| No Dashboard page-load platform calls | Code review + E2E guard |
| `pnpm run typecheck` + `pnpm run build` pass | CI check |
| Unit tests for scheduler + adapter (≥80% coverage) | `pnpm test` |

---

## 11. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| OAuth token leakage | High | Low | Token ref only; secret manager; git-ignore |
| YouTube quota exhaustion (1,600/upload) | High | Medium | Joint quota ledger with ADR-0009 |
| Platform API variance (FB/IG/TikTok) | Medium | Medium | Pluggable adapter; YouTube-first; others deferred |
| Failed uploads | Medium | Medium | Retryable with backoff; structured WorkerError; dead-letter |
| Scheduling correctness (timezone) | Medium | Medium | Store UTC; convert at display |

---

## 12. Cross-References

- **Stack Proposal:** [../planning/social-publish-stack-proposal.md](../planning/social-publish-stack-proposal.md)
- **Decision Record:** [../planning/post-mvp-options.md](../planning/post-mvp-options.md)
- **Delegation Brief:** [../planning/orchestration-delegation-brief.md](../planning/orchestration-delegation-brief.md)
- **Sprint Plan:** [../planning/sprints/Sprint-009/README.md](../planning/sprints/Sprint-009/README.md)
- **ADR-0008 (Publish & Scheduling):** [../adr/ADR-0008-social-publish-scheduling.md](../adr/ADR-0008-social-publish-scheduling.md)
- **ADR-0009 (Analytics quota):** [../adr/ADR-0009-platform-analytics-ingestion.md](../adr/ADR-0009-platform-analytics-ingestion.md)
- **Thin Orchestrator / BullMQ:** [../adr/ADR-0004-thin-orchestrator.md](../adr/ADR-0004-thin-orchestrator.md)
- **Reference-Based Data Plane:** [../adr/ADR-0003-reference-based-data-plane.md](../adr/ADR-0003-reference-based-data-plane.md)
- **MVP Architecture:** [mvp-architecture.md](mvp-architecture.md)
- **Settings (account registry):** [settings-ai-workspace-architecture.md](settings-ai-workspace-architecture.md)
- **Frozen Contracts:** [contracts.md](contracts.md)

---

## 13. Next Steps (Upon Approval)

1. Create Sprint 9 plan: `.ai/planning/sprints/Sprint-009/README.md`
2. Create Issues 9.1–9.5: `.ai/planning/sprints/Sprint-009/Issue-901.md` through `Issue-905.md`
3. Update `orchestration-delegation-brief.md` with finalized scope
4. Scaffold `services/publish` + `workers/publish-real`
5. Begin implementation per Sprint 9 plan
