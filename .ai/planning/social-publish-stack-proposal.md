---
id: social-publish-stack-proposal
title: "Social Publish & Scheduling — Stack Proposal & Rationale (Workstream B / Milestone 10)"
owner: "Lead Engineer (AI Agent) + Founder"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "pre-implementation"
tags: [publish, scheduling, social, youtube, monetization, stack, proposal, rationale, post-mvp, milestone-10]
related_documents:
  - "post-mvp-options.md"
  - "orchestration-delegation-brief.md"
  - "social-publish-architecture.md"
  - "../architecture/mvp-architecture.md"
  - "../architecture/contracts.md"
  - "../adr/ADR-0008-social-publish-scheduling.md"
  - "../adr/ADR-0009-platform-analytics-ingestion.md"
---

# Social Publish & Scheduling — Stack Proposal & Rationale

> **Status:** PROPOSED (pending Founder approval). This document provides the **detailed technology stack recommendation with reasoning** for **Social Publish & Scheduling** — the post-MVP workstream that publishes approved content to social platforms (YouTube Channel, Facebook, Instagram, TikTok) on schedule. **YouTube is the primary monetization target.** It expands the technical blueprint in `social-publish-architecture.md` to give the Founder full visibility into the "why" behind each choice.

---

## 1. Executive Summary

**Recommended Stack:**
| Layer | Choice | Version | Rationale Summary |
|-------|--------|---------|-------------------|
| **Runtime** | Node.js | 20 LTS | Consistency with entire monorepo; no new runtime |
| **Language** | TypeScript (ESM, strict) | 5.x | Type safety across stack; matches all packages |
| **Queue / Scheduling** | **BullMQ repeatable jobs** (Redis) | existing | Already the queue infra (ADR-0004); repeatable job drives the scheduler |
| **Publishing Worker** | New `services/publish` / `workers/publish-real` | — | Consumes `publish-queue`, performs platform upload |
| **Platform Adapter** | **YouTube Data API v3** (`videos.insert`) — YouTube-first | — | Primary monetization target; direct upload + revenue tracking |
| **Credential Store** | Secret manager + `key_ref`/`token_ref` in DB | — | Mirror ADR-0006/0007 provider-connection pattern; OAuth tokens by reference |
| **Data Access** | `@fyi/database` (Prisma) | 5.x | New tables `social_accounts`, `scheduled_publishes` |
| **Settings UI** | `services/settings` (Milestone 9) | — | Founder connects social accounts + schedules publishes there |
| **Deployment (MVP)** | Local dev server + background worker | — | Matches MVP "runs locally" posture |

**What we deliberately do NOT add (MVP):**
- ❌ No third-party scheduling SaaS (Buffer/Hootsuite) — external cost + lock-in; own the pipeline
- ❌ No Temporal.io — BullMQ repeatable jobs already exist (ADR-0004)
- ❌ No Dashboard page-load platform calls — publishing is a **background worker**, never on page load
- ❌ No binary through the orchestrator — uploads use file pointers (ADR-0003)

---

## 2. Decision Framework: Why This Stack?

### 2.1 Guiding Principles (from Constitution)

| Principle | How Stack Aligns |
|-----------|------------------|
| **Anti-Monster Policy** | Publishing worker + scheduler are small, single-responsibility modules; no framework bloat |
| **Documentation First, Code Second** | Stack fully documented here before implementation |
| **Minimal Dependencies** | Reuse BullMQ (ADR-0004) + `@fyi/database`; no new queue/scheduler infra |
| **Layering: Domain → Application → Infrastructure** | Publishing is an Application/worker concern; writes to `scheduled_publishes` (Domain) via Prisma |
| **Workers share ONLY `@fyi/contracts`** | The publish **worker** shares only contracts; the **service** (scheduler/settings wiring) may share `@fyi/database` |
| **YouTube-first monetization** | First adapter targets YouTube Channel (primary revenue driver) |

### 2.2 Evaluation Criteria (Weighted)

| Criterion | Weight | BullMQ repeatable + custom worker | Third-party SaaS (Buffer) | Temporal.io | File-based/manual |
|-----------|--------|-----------------------------------|---------------------------|-------------|-------------------|
| **Alignment with Anti-Monster** | 30% | ✅ 10/10 (small, existing) | ❌ 3/10 (external dep) | ❌ 2/10 (heavy) | ✅ 8/10 (simple) |
| **Reuse of existing infra** | 20% | ✅ 10/10 (BullMQ already in stack) | ⚠️ 5/10 | ❌ 2/10 (new infra) | ✅ 8/10 |
| **Time to MVP** | 20% | ✅ 9/10 | ✅ 7/10 (fast setup) | ❌ 3/10 | ⚠️ 6/10 |
| **Revenue/monetization fit** | 15% | ✅ 10/10 (direct Data API) | ❌ 4/10 (no direct revenue API) | ✅ 7/10 | ❌ 2/10 |
| **Maintenance Burden** | 15% | ✅ 9/10 (own pipeline) | ⚠️ 5/10 (SaaS churn/cost) | ⚠️ 6/10 | ✅ 9/10 |

**Weighted Score: BullMQ repeatable + custom publishing worker = 9.5/10** — clear winner, reusing proven infra and owning the monetization pipeline.

---

## 3. Detailed Stack Justification

### 3.1 BullMQ Repeatable Jobs over a Third-Party Scheduler

The Supervisor already uses BullMQ (ADR-0004) for queue persistence, retries, and priority. BullMQ's **repeatable jobs** add a scheduler capability with zero new infrastructure: a repeatable job runs on an interval, finds due `scheduled_publishes` rows, and enqueues them to the `publish-queue`. No Temporal, no cron daemon, no SaaS.

### 3.2 YouTube Data API v3 (`videos.insert`) over a SaaS aggregator

For monetization, the platform must own the publish pipeline and track revenue. The **YouTube Data API v3** `videos.insert` endpoint:
- Uploads the video directly to the connected YouTube Channel.
- Returns a YouTube video ID, which links to YouTube Analytics for revenue (ADR-0009).
- Is **free within the 10,000 units/day quota** (1,600 units per upload) — no per-video SaaS fee.

A third-party scheduler (Buffer/Hootsuite) would add recurring cost, hide the YouTube video ID behind its own abstraction, and complicate revenue analytics. The direct Data API is the right monetization path.

### 3.3 Credential Storage: OAuth token by reference

Social platforms require OAuth access tokens per connected account. Mirroring the ADR-0006/0007 provider-connection pattern:
- DB stores a `token_ref` (reference), never the token.
- Token material lives in the secret manager / env (local MVP).
- The `social_accounts` table is the registry of connected accounts per tenant.

---

## 4. Package Structure (New: `services/publish` + `workers/publish-real`)

```
services/publish/                    # Scheduler + orchestration (service)
├── package.json                     # name: "@fyi/publish"
├── tsconfig.json
├── .env.example                     # DATABASE_URL, REDIS_URL, YOUTUBE_OAUTH_REF
├── src/
│   ├── index.ts                     # Entry: start BullMQ repeatable scheduler + worker
│   ├── scheduler.ts                 # BullMQ repeatable job: find due scheduled_publishes → enqueue
│   ├── handler.ts                   # publish-queue consumer: dispatch to platform adapter
│   └── utils/
│       ├── prisma.ts                # Prisma singleton
│       └── secret.ts                # Resolve token_ref → secret manager value
└── README.md

workers/publish-real/                # Platform adapter worker (worker — contracts only)
├── package.json                     # name: "@fyi/publish-real"
├── tsconfig.json
├── src/
│   ├── index.ts                     # BullMQ worker for publish-queue
│   ├── adapters/
│   │   ├── youtube.ts               # YouTube Data API v3 videos.insert
│   │   └── types.ts                 # PlatformAdapter interface
│   └── publish.ts                   # Upload file pointer → platform; write result back
└── README.md
```

**Root `package.json` additions:**
```json
{
  "scripts": {
    "publish": "tsx services/publish/src/index.ts",
    "publish:dev": "tsx watch services/publish/src/index.ts",
    "worker:publish-real": "tsx workers/publish-real/src/index.ts"
  }
}
```

---

## 5. API Contract (Scheduling via Settings UI — not the read-only Dashboard)

Scheduling is done from the **Settings** surface (Milestone 9) or CLI — NOT the read-only Dashboard. The publish pipeline itself is entirely background.

| Endpoint / Surface | Method | Purpose |
|--------------------|--------|---------|
| `services/settings` `/settings/social-accounts` | GET/POST | Connect/list/disconnect social accounts (OAuth) |
| `services/settings` `/settings/schedules` | GET/POST | Create/list a scheduled publish for an approved job |
| `scheduler.ts` (BullMQ repeatable) | — | Finds due `scheduled_publishes` → enqueue `publish-queue` |
| `handler.ts` → `youtube.ts` | — | YouTube Data API `videos.insert` upload; write platform URL back |

---

## 6. Data Flow Diagram

```
┌─────────────────┐  schedule        ┌──────────────────────────┐
│  Settings UI    │ ───────────────► │  scheduled_publishes     │
│  (Milestone 9)  │  (row inserted)  │  (PostgreSQL)            │
└─────────────────┘                  └───────────┬──────────────┘
                                                 │  due rows
                                                 ▼
                                        ┌──────────────────────────┐
                                        │  Scheduler               │
                                        │  (BullMQ repeatable)     │
                                        └───────────┬──────────────┘
                                                    │  enqueue
                                                    ▼
                                        ┌──────────────────────────┐
                                        │  publish-queue (BullMQ)  │
                                        └───────────┬──────────────┘
                                                    │
                                                    ▼
                                        ┌──────────────────────────┐
                                        │  Publishing Worker       │
                                        │  (workers/publish-real)  │
                                        └───────────┬──────────────┘
                                                    │  YouTube Data API v3
                                                    ▼
                                        ┌──────────────────────────┐
                                        │  YouTube Channel         │
                                        │  (primary monetization)  │
                                        └───────────┬──────────────┘
                                                    │  video_id → revenue (ADR-0009)
                                                    ▼
                                        ┌──────────────────────────┐
                                        │  platform_metrics /      │
                                        │  video_revenue (local)   │
                                        └──────────────────────────┘
```

**Key Invariants:**
1. **Publishing is always a background worker** — never on Dashboard page load.
2. **Uploads use file pointers** (ADR-0003) — no binary through the orchestrator.
3. **YouTube quota shared with analytics** (ADR-0009) — 1,600 units/upload against the 10k/day budget.
4. **Supervisor stays sole writer to job status** (ADR-0004) — publishing writes to `scheduled_publishes`/artifacts, not job status.

---

## 7. Implementation Estimate (Sprint 9 / "Social Publish & Scheduling")

| Step | Task | Est. | Notes |
|------|------|------|-------|
| 9.1 | `social_accounts` + `scheduled_publishes` schema + migration | S (1-2h) | Prisma; additive tables |
| 9.2 | Social account registry CRUD (via Settings UI) + OAuth token ref | M (3-5h) | Reuse ADR-0006 credential pattern |
| 9.3 | Publishing worker + YouTube adapter (`videos.insert`) | M (3-5h) | `workers/publish-real`; file-pointer upload |
| 9.4 | Scheduler (BullMQ repeatable) + scheduled-publish flow | M (3-5h) | Find due → enqueue → publish → write result |
| 9.5 | Publish E2E + verification (mock YouTube adapter + real if key available) | S (1-2h) | Typecheck/build/tests |

**Total: ~13-22h** (matches the Sprint 9 plan in `.ai/planning/sprints/Sprint-009/`).

---

## 8. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| OAuth token leakage | High | Low | Token ref only; secret manager; strict git-ignore |
| YouTube quota exhaustion (1,600/upload) | High | Medium | Joint quota ledger with ADR-0009; budget-aware scheduling |
| Platform API variance (FB/IG/TikTok) | Medium | Medium | Pluggable adapter interface; YouTube-first; others deferred |
| Failed uploads | Medium | Medium | Retryable with backoff (ADR-0004); structured WorkerError; dead-letter |
| Scope creep into analytics/revenue | Medium | Medium | Publishing writes platform URL; analytics is ADR-0009 (separate workstream) |
| Scheduling correctness (timezone) | Medium | Medium | Store UTC timestamps; convert at display |

---

## 9. Founder Decision Request

**Please review and confirm:**

1. **Stack approved?** BullMQ repeatable scheduler + `services/publish` + `workers/publish-real` + YouTube Data API v3.
2. **YouTube-first?** First adapter = YouTube Channel (monetization); Facebook/Instagram/TikTok deferred behind adapter interface.
3. **Credential storage?** OAuth token ref in DB + secret manager (ADR-0006 pattern).
4. **Quota coupling?** Publish uploads (1,600 units) share the 10k/day YouTube quota with analytics (ADR-0009).
5. **Timeline acceptable?** ~13-22h (Sprint 9).

**If approved, next steps:**
- Create Milestone 10 architecture doc (`.ai/architecture/social-publish-architecture.md`).
- Create Sprint 9 plan + Issues 9.1–9.5 (`.ai/planning/sprints/Sprint-009/`).
- Update `orchestration-delegation-brief.md` for external agent delegation.
- Begin implementation.

---

## 10. Cross-References

- **Decision record:** [post-mvp-options.md](./post-mvp-options.md)
- **Delegation brief:** [orchestration-delegation-brief.md](./orchestration-delegation-brief.md)
- **Architecture (Milestone 10):** [social-publish-architecture.md](../architecture/social-publish-architecture.md)
- **ADR-0008 (Publish & Scheduling):** [../adr/ADR-0008-social-publish-scheduling.md](../adr/ADR-0008-social-publish-scheduling.md)
- **ADR-0009 (Analytics quota):** [../adr/ADR-0009-platform-analytics-ingestion.md](../adr/ADR-0009-platform-analytics-ingestion.md)
- **Thin Orchestrator / BullMQ:** [../adr/ADR-0004-thin-orchestrator.md](../adr/ADR-0004-thin-orchestrator.md)
- **Reference-Based Data Plane:** [../adr/ADR-0003-reference-based-data-plane.md](../adr/ADR-0003-reference-based-data-plane.md)
- **MVP architecture:** [../architecture/mvp-architecture.md](../architecture/mvp-architecture.md)
