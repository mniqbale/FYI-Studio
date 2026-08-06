---
id: sprint-009-readme
title: "Sprint 9 — Social Publish & Scheduling Implementation Plan (Milestone 10)"
owner: "Lead Engineer (AI Agent)"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-sprint"
tags: [sprint, planning, publish, scheduling, social, youtube, monetization, milestone-10, implementation]
related_documents:
  - "social-publish-architecture.md"
  - "social-publish-stack-proposal.md"
  - "post-mvp-options.md"
  - "orchestration-delegation-brief.md"
  - "Issue-901.md"
  - "Issue-902.md"
  - "Issue-903.md"
  - "Issue-904.md"
  - "Issue-905.md"
related_sprint: "Sprint-009"
---

# Sprint 9 — Social Publish & Scheduling Implementation Plan (Milestone 10)

> **Status:** PROPOSED (pending Founder approval). This sprint implements **Milestone 10: Social Publish & Scheduling** — publishing approved content to social platforms (YouTube Channel, Facebook, Instagram, TikTok) on schedule. **YouTube is the primary monetization target** (ADR-0008).

---

## 1. Sprint Goal

**Build a functional publish & scheduling pipeline** that:
- Registers connected social accounts per tenant (`social_accounts`).
- Schedules approved jobs for publication (`scheduled_publishes`).
- Runs a BullMQ repeatable scheduler that finds due publishes and enqueues them.
- Runs a publishing worker (YouTube-first) that uploads via YouTube Data API v3.
- Writes the platform URL back to the Job Ledger / schedule record.
- Never calls a platform API on Dashboard page load.

---

## 2. Scope

| In Scope | Out of Scope |
|----------|--------------|
| `social_accounts` + `scheduled_publishes` tables (Prisma migration) | Facebook/Instagram/TikTok adapters (deferred; adapter interface only) |
| Social account registry CRUD (via Settings UI, M9) | Platform analytics & revenue (Milestone 11 / ADR-0009) |
| Publishing worker (`services/publish` + `workers/publish-real`) | Real secret vault (env for MVP) |
| **YouTube adapter** (Data API v3 `videos.insert`) | Authentication/Authorization |
| BullMQ repeatable scheduler | |
| Platform URL written back to `platform_response` + `artifacts.published` | |
| Reuse `@fyi/database` (Prisma) | |

---

## 3. Issues (Tasks)

| Issue | Title | Description | Est. | Dependencies |
|-------|-------|-------------|------|--------------|
| **9.1** | Social Account + Schedule Schema | Add `social_accounts` + `scheduled_publishes` tables + Prisma migration | S (1-2h) | None |
| **9.2** | Social Account Registry CRUD | Connect/list/disconnect social accounts via Settings UI (OAuth token ref) | M (3-5h) | 9.1 |
| **9.3** | Publishing Worker + YouTube Adapter | `services/publish` + `workers/publish-real`; YouTube `videos.insert` upload | M (3-5h) | 9.1 |
| **9.4** | Scheduler + Scheduled-Publish Flow | BullMQ repeatable job: find due → enqueue → publish → write result | M (3-5h) | 9.2, 9.3 |
| **9.5** | Publish E2E + Verification | Mock YouTube adapter E2E + typecheck/build/tests | S (1-2h) | 9.1-9.4 |

**Total Estimate: 13-22 hours**

---

## 4. Technical Approach

### 4.1 Package Structure
```
services/publish/                    # Scheduler + orchestration (service)
├── package.json                     # @fyi/publish
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts                     # Entry: start scheduler + worker
│   ├── scheduler.ts                 # BullMQ repeatable: find due → enqueue
│   ├── handler.ts                   # publish-queue consumer → dispatch to adapter
│   └── utils/
│       ├── prisma.ts
│       └── secret.ts                # Resolve token_ref
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

### 4.2 Key Patterns

**BullMQ repeatable scheduler:**
```typescript
// scheduler.ts
await queue.add('publish-sweep', {}, {
  repeat: { every: Number(process.env.SCHEDULER_INTERVAL_MS ?? 60000) },
  jobId: 'publish-sweep',
});
// On each run:
//   SELECT * FROM scheduled_publishes WHERE status='scheduled' AND scheduled_at <= now()
//   → mark 'publishing' → enqueue to publish-queue
```

**YouTube adapter (upload):**
```typescript
// adapters/youtube.ts
export const youtubeAdapter: PlatformAdapter = {
  async publish({ videoPath, title, description, token }) {
    // YouTube Data API v3 videos.insert (resumable upload of file pointer)
    const { videoId, url } = await uploadVideo({ videoPath, title, description, token });
    return { videoId, url };  // written back to platform_response
  },
};
```

**Write result back:**
```typescript
await prisma.scheduledPublish.update({ where: { id }, data: {
  status: 'published',
  platformResponse: { videoId, url },
}});
// also: jobs.artifacts.published = { platform: 'youtube', url, videoId }
```

---

## 5. Acceptance Criteria (Definition of Done)

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Prisma migration adds `social_accounts` + `scheduled_publishes` | `pnpm prisma migrate` + schema check |
| 2 | Settings UI connects/disconnects a YouTube account (token ref) | Visual + DB check |
| 3 | Settings UI schedules a publish for an approved job | Visual + DB check (`scheduled_publishes`) |
| 4 | Scheduler fires and enqueues due publishes | Logs + queue inspection |
| 5 | Publishing worker uploads via YouTube Data API v3 (mock adapter) | E2E with mock; real if key available |
| 6 | Platform URL + video_id written back to `platform_response` + `artifacts.published` | DB check |
| 7 | Failed upload retries with backoff (ADR-0004) | Logs + DB `attempts` |
| 8 | No Dashboard page-load platform calls | Code review + E2E guard |
| 9 | `pnpm run typecheck` + `pnpm run build` pass | CI check |
| 10 | Unit tests for scheduler + adapter (≥80% coverage) | `pnpm test` |

---

## 6. Dependencies & Prerequisites

- **Settings AI Workspace (Milestone 9)** — provides the Settings UI for social account + schedule CRUD.
- **MVP + Dashboard Complete** (Milestones 1–8 done).
- **PostgreSQL + Redis running** — `pnpm run infra:up`.
- **At least one approved job with a video artifact** — for the publish E2E.
- **YouTube OAuth token / API key** — for a real upload; mock adapter used otherwise.
- **Node.js 20+, pnpm 9+**.

---

## 7. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| OAuth token leakage | High | Low | Token ref only; secret manager; git-ignore |
| YouTube quota exhaustion (1,600/upload) | High | Medium | Joint quota ledger with ADR-0009 |
| Platform API variance (FB/IG/TikTok) | Medium | Medium | Pluggable adapter; YouTube-first; others deferred |
| Failed uploads | Medium | Medium | Retryable with backoff (ADR-0004); dead-letter |
| Scheduling correctness (timezone) | Medium | Medium | Store UTC; convert at display |

---

## 8. Cross-References

- **Architecture:** [social-publish-architecture.md](../architecture/social-publish-architecture.md)
- **Stack Proposal:** [social-publish-stack-proposal.md](../planning/social-publish-stack-proposal.md)
- **Decision Record:** [post-mvp-options.md](../planning/post-mvp-options.md)
- **Delegation Brief:** [orchestration-delegation-brief.md](../planning/orchestration-delegation-brief.md)
- **ADR-0008 (Publish & Scheduling):** [../../adr/ADR-0008-social-publish-scheduling.md](../../adr/ADR-0008-social-publish-scheduling.md)
- **ADR-0009 (shared quota):** [../../adr/ADR-0009-platform-analytics-ingestion.md](../../adr/ADR-0009-platform-analytics-ingestion.md)
- **MVP Architecture:** [../../architecture/mvp-architecture.md](../../architecture/mvp-architecture.md)

---

## 9. Next Steps

1. Founder approves this sprint plan
2. Create Issue docs (901-905) with detailed acceptance criteria
3. Update `orchestration-delegation-brief.md` with finalized scope
4. Begin implementation: Issue 9.1 → 9.2 → 9.3 → 9.4 → 9.5
