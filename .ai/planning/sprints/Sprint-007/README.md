---
id: sprint-007-readme
title: "Sprint 7 — Dashboard UI Implementation Plan"
owner: "Lead Engineer (AI Agent)"
status: "complete"
version: "1.1.0"
last_updated: "2026-08-06"
review_cycle: "per-sprint"
tags: [sprint, planning, dashboard, milestone-8, implementation]
related_documents:
  - "dashboard-architecture.md"
  - "dashboard-stack-proposal.md"
  - "dashboard-proposal.md"
  - "post-mvp-options.md"
  - "orchestration-delegation-brief.md"
  - "Issue-701.md"
  - "Issue-702.md"
  - "Issue-703.md"
  - "Issue-704.md"
  - "Issue-705.md"
related_sprint: "Sprint-007"
---

# Sprint 7 — Dashboard UI Implementation Plan

> **Status:** COMPLETE — implemented 2026-08-06. This sprint implemented **Milestone 8: Dashboard UI** — a read-only web Dashboard over the existing Job Ledger so the Founder can review pipeline progress, per-step artifacts (including video playback), and cost analytics visually.

---

## 1. Sprint Goal

**Build a functional, local-first Dashboard UI** that:
- Starts with `npm run dashboard`
- Shows job pipeline status (Overview, Job List, Job Detail with video)
- Shows tenant policies + spend vs quota
- Shows cost analytics with charts
- Is read-only (no writes to Job Ledger)
- Passes `pnpm run typecheck` and `pnpm run build`

---

## 2. Scope (from Dashboard Architecture)

| In Scope | Out of Scope |
|----------|--------------|
| Fastify HTTP server (`services/dashboard`) | Authentication/Authorization |
| 5 server-rendered HTML pages | WebSocket/push updates |
| Vanilla JS polling (2s interval) | Write operations (job creation, approval, retry) |
| Chart.js charts (CDN) | Multi-user, roles, permissions |
| `@fastify/static` media serving from `/tmp/fyi-studio` | S3/R2 media serving |
| Read-only API endpoints | Historical retention policies |
| Reuse `@fyi/database` + `@fyi/analytics` | |

---

## 3. Issues (Tasks)

| Issue | Title | Description | Est. | Dependencies |
|-------|-------|-------------|------|--------------|
| **7.1** | Scaffold Dashboard Package | Create `services/dashboard` with package.json, tsconfig, Fastify entry, root scripts | S (1-2h) | None |
| **7.2** | Read-Only API Endpoints | Implement `/api/overview`, `/api/jobs`, `/api/jobs/:id`, `/api/tenants`, `/api/analytics` using `@fyi/database` + `@fyi/analytics` | M (3-5h) | 7.1 |
| **7.3** | Server-Rendered Pages + Client JS | Build 5 HTML templates + vanilla JS polling modules + Chart.js integration | M (3-5h) | 7.1, 7.2 |
| **7.4** | Media Serving Route | Implement `/media/*` static file serving with Range support for video seeking | S (1-2h) | 7.1 |
| **7.5** | E2E Smoke Test + Typecheck/Build | Seed completed job → verify dashboard shows it + video plays; run typecheck/build | S (1-2h) | 7.1-7.4 |

**Total Estimate: 8-16 hours** (matches post-mvp-options.md)

---

## 4. Technical Approach

### 4.1 Package Structure
```
services/dashboard/
├── package.json              # @fyi/dashboard
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts              # Fastify entry point
│   ├── routes/
│   │   ├── index.ts          # Route registration
│   │   ├── overview.ts       # Overview page + API
│   │   ├── jobs.ts           # Jobs list/detail + API
│   │   ├── tenants.ts        # Tenants page + API
│   │   ├── analytics.ts      # Analytics page + API
│   │   └── media.ts          # Static media serving
│   ├── templates/
│   │   ├── layout.ts         # Shared HTML shell
│   │   ├── overview.ts
│   │   ├── job-list.ts
│   │   ├── job-detail.ts
│   │   ├── tenants.ts
│   │   └── analytics.ts
│   ├── client/
│   │   ├── polling.ts        # Shared polling utility
│   │   ├── overview.ts
│   │   ├── job-detail.ts
│   │   ├── job-list.ts
│   │   └── analytics.ts
│   └── utils/
│       ├── prisma.ts         # Prisma singleton
│       ├── analytics.ts      # @fyi/analytics helpers
│       └── media.ts          # Media URL helpers
└── public/assets/style.css
```

### 4.2 Key Patterns

**Server-Rendered HTML (Zero Build):**
```typescript
// templates/overview.ts
export function renderOverviewPage(data: OverviewData): string {
  return `<!DOCTYPE html>
<html><head><title>FYI Dashboard</title>
<link rel="stylesheet" href="/assets/style.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
</head><body>...${data.jobsByStatus.pending}...</body></html>`;
}
```

**Vanilla JS Polling:**
```typescript
// client/polling.ts
export function startPolling(url, intervalMs, onData) {
  async function tick() {
    try { const res = await fetch(url); if (res.ok) onData(await res.json()); }
    catch (e) { console.warn('Poll failed', e); }
    setTimeout(tick, intervalMs);
  }
  tick();
  return () => {/* stop */};
}
```

**Chart.js from CDN:**
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<script type="module" src="/assets/analytics.js"></script>
```

---

## 5. Acceptance Criteria (Definition of Done)

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `npm run dashboard` starts server on `http://localhost:3001` | Manual: `curl localhost:3001` returns HTML |
| 2 | `/` (Overview) shows jobs by status, total cost, total tokens, recent jobs | Visual check in browser |
| 3 | `/jobs` shows paginated, filterable job list | Visual check + pagination works |
| 4 | `/jobs/:id` shows pipeline timeline + plays generated video | **Video plays in browser** |
| 5 | `/tenants` shows tenants with policy + spend vs quota | Visual check |
| 6 | `/analytics` renders 3 charts (cost over time, by capability, tokens by worker) | Visual check |
| 7 | No writes to Job Ledger (code review + DB trigger test) | Code review: no INSERT/UPDATE/DELETE in routes |
| 8 | `pnpm run typecheck` passes (entire monorepo) | CI check |
| 9 | `pnpm run build` passes (entire monorepo) | CI check |
| 10 | Unit tests for API routes (≥80% coverage) | `pnpm test` |

---

## 6. Dependencies & Prerequisites

- **MVP Complete** (Milestones 1–7 done) — verified in `current-state.md`
- **PostgreSQL + Redis running** — `pnpm run infra:up`
- **At least one completed job with video artifact** — for E2E smoke test (Issue 7.5)
- **Node.js 20+, pnpm 9+** — already in environment

---

## 7. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Scope creep into SPA | High | Medium | Lock scope in this doc; defer React/Vite |
| Media path issues (local /tmp) | Medium | Medium | Central `MEDIA_ROOT` constant; abstract `getMediaUrl()` |
| Chart.js CDN blocked | Low | Low | Vendor fallback in `public/assets/` |
| Type drift from Prisma | Medium | Low | `pnpm run typecheck` catches; generate from Prisma |

---

## 8. Cross-References

- **Architecture:** [dashboard-architecture.md](../architecture/dashboard-architecture.md)
- **Stack Proposal:** [dashboard-stack-proposal.md](../planning/dashboard-stack-proposal.md)
- **Decision Record:** [post-mvp-options.md](../planning/post-mvp-options.md)
- **Delegation Brief:** [orchestration-delegation-brief.md](../planning/orchestration-delegation-brief.md)
- **MVP Architecture:** [../architecture/mvp-architecture.md](../architecture/mvp-architecture.md)

---

## 9. Next Steps

1. Founder approves this sprint plan
2. Create Issue docs (701-705) with detailed acceptance criteria
3. Update `orchestration-delegation-brief.md` with finalized scope
4. Begin implementation: Issue 7.1 → 7.2 → 7.3 → 7.4 → 7.5