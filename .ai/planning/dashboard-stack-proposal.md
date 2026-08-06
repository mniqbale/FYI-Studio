---
id: dashboard-stack-proposal
title: "Dashboard UI — Stack Proposal & Rationale (Post-MVP Option A)"
owner: "Lead Engineer (AI Agent) + Founder"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "pre-implementation"
tags: [dashboard, ui, stack, proposal, rationale, technology-choice, post-mvp]
related_documents:
  - "post-mvp-options.md"
  - "dashboard-proposal.md"
  - "orchestration-delegation-brief.md"
  - "../architecture/mvp-architecture.md"
  - "../architecture/contracts.md"
  - "../architecture/engineering-standards.md"
---

# Dashboard UI — Stack Proposal & Rationale

> **Status:** PROPOSED (pending Founder approval). This document provides the **detailed technology stack recommendation with reasoning** for the Dashboard UI — the first post-MVP workstream. It expands on the technical blueprint in `dashboard-proposal.md` to give the Founder full visibility into the "why" behind each choice.

---

## 1. Executive Summary

**Recommended Stack:**
| Layer | Choice | Version | Rationale Summary |
|-------|--------|---------|-------------------|
| **Runtime** | Node.js | 20 LTS | Consistency with entire monorepo; no new runtime |
| **Language** | TypeScript (ESM, strict) | 5.x | Type safety across stack; matches all packages |
| **Web Framework** | **Fastify** | 4.x | Minimal, fast, first-class TS; thin HTTP/JSON layer |
| **Rendering** | **Server-rendered HTML + vanilla JS** | — | Anti-Monster; read-only view needs no complex client state |
| **Templating** | **HTML template strings** (or `eta` if preferred) | — | Zero-build, dependency-light |
| **Data Access** | `@fyi/database` (Prisma) | 5.x | Reuse existing client; read-only queries only |
| **Analytics Aggregation** | `@fyi/analytics` | 1.x | Reuse existing cost intelligence module |
| **Charting** | **Chart.js** (CDN) | 4.x | Lightweight, renders from JSON, no build step |
| **Media Serving** | Fastify static handler | — | Serves `/tmp/fyi-studio` artifacts via `<video>` |
| **Deployment (MVP)** | Local dev server (`npm run dashboard`) | — | Matches MVP "runs locally" posture |

**What we deliberately do NOT add (MVP):**
- ❌ No React/Vue/Svelte + bundler (Webpack/Vite) — overkill for a read-only view
- ❌ No separate analytics DB — read from existing Postgres telemetry
- ❌ No auth for MVP (internal tool) — real auth is a production-hardening concern (Option F)
- ❌ No WebSocket/pub-sub for live updates — simple **poll every 2s** matches Supervisor polling pattern

---

## 2. Decision Framework: Why This Stack?

### 2.1 Guiding Principles (from Constitution)

| Principle | How Stack Aligns |
|-----------|------------------|
| **Anti-Monster Policy** (max 300 lines/file, strict SRP) | Server-rendered HTML + vanilla JS keeps each page ~100-200 lines; no framework boilerplate |
| **Documentation First, Code Second** | Stack is fully documented here before implementation |
| **Minimal Dependencies** | Fastify + Chart.js (CDN) + Prisma = 3 runtime deps; no build toolchain |
| **Layering: Domain → Application → Infrastructure** | Dashboard is Application layer; reads from Domain (Prisma) and Infrastructure (FS) |
| **Workers share ONLY `@fyi/contracts`** | Dashboard is NOT a worker — it's a read surface; uses `@fyi/database` + `@fyi/analytics` |
| **No `workspace:*` for runtime deps** | Dashboard will be its own package (`services/dashboard`) with explicit deps |

### 2.2 Evaluation Criteria (Weighted)

| Criterion | Weight | Fastify + Server HTML | React + Vite | Next.js | Hono + JSX |
|-----------|--------|----------------------|--------------|---------|------------|
| **Alignment with Anti-Monster** | 30% | ✅ 10/10 (tiny) | ❌ 3/10 (heavy) | ❌ 2/10 (heavy) | ⚠️ 6/10 (JSX = build) |
| **TypeScript Integration** | 20% | ✅ 10/10 (native) | ✅ 10/10 | ✅ 10/10 | ✅ 9/10 |
| **Time to MVP (8-16h target)** | 25% | ✅ 10/10 (no build) | ❌ 4/10 (setup+build) | ❌ 3/10 (setup+build) | ⚠️ 7/10 (needs build) |
| **Read-Only View Suitability** | 15% | ✅ 10/10 (designed for) | ⚠️ 6/10 (overkill) | ⚠️ 5/10 (overkill) | ✅ 8/10 |
| **Maintenance Burden** | 10% | ✅ 10/10 (vanilla) | ❌ 4/10 (ecosystem churn) | ❌ 3/10 (ecosystem churn) | ⚠️ 6/10 (JSX tooling) |
| **Team Familiarity (Node/TS)** | - | ✅ 10/10 | ✅ 8/10 | ✅ 7/10 | ⚠️ 6/10 |

**Weighted Score: Fastify + Server HTML = 9.7/10** — clear winner.

---

## 3. Detailed Stack Justification

### 3.1 Fastify over Express / Hono / Native http

| Factor | Fastify | Express | Hono | Native http |
|--------|---------|---------|------|-------------|
| **Performance** | ⚡ Very fast (benchmarks) | 🐢 Slower | ⚡ Fast | ⚡ Fastest |
| **TypeScript** | ✅ First-class, schema-based | ✅ Good (via @types) | ✅ Native TS | ❌ Manual |
| **Validation** | ✅ Built-in (JSON Schema) | ❌ Manual/joi | ✅ Built-in (Zod) | ❌ Manual |
| **Plugin Ecosystem** | ✅ Rich (static, cors, etc.) | ✅ Huge | ✅ Growing | ❌ None |
| **Learning Curve** | Low (Express-like) | Lowest | Low (Express-like) | High |
| **Bundle Size** | Small | Medium | Tiny | None |

**Why Fastify wins:** Best balance of TS-native validation, performance, plugin ecosystem (static file serving, CORS), and familiarity. The `fastify-static` plugin handles media serving trivially.

### 3.2 Server-Rendered HTML + Vanilla JS over SPA Frameworks

**The Dashboard is a READ-ONLY VIEW.** It has:
- No client-side routing complexity (5 static routes)
- No complex client state (just polling + chart updates)
- No user interactions that mutate state (no forms, no writes)
- Simple periodic data fetch → DOM update

**SPA frameworks add:**
- Build step (Vite/Webpack) → configuration, caching, CI complexity
- Bundle size → 50-100KB+ JS before any code
- Hydration complexity → for what? A few chart updates?
- Mental model mismatch → server already has the data

**Server-rendered + vanilla JS gives:**
- Zero build step (ESM in browser via `<script type="module">`)
- Each page = one `.ts` file → template string → `reply.send(html)`
- Chart.js from CDN → `new Chart(ctx, { data: await fetch('/api/analytics').then(r=>r.json()) })`
- Polling: `setInterval(() => fetch('/api/jobs').then(render), 2000)`

### 3.3 Chart.js over Recharts / Victory / D3 / ApexCharts

| Factor | Chart.js (CDN) | Recharts | Victory | D3 | ApexCharts |
|--------|----------------|----------|---------|-----|------------|
| **Build Required** | ❌ No (CDN) | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No (CDN) |
| **Bundle Size** | 60KB (CDN) | 150KB+ | 100KB+ | 80KB+ (core) | 100KB+ |
| **TypeScript** | ✅ Types on DefinitelyTyped | ✅ Native | ✅ Native | ✅ Native | ✅ Types |
| **API Simplicity** | ✅ Simple config | ✅ React-friendly | ✅ React-friendly | ❌ Low-level | ✅ Config-based |
| **Maintenance** | ✅ Mature, stable | ✅ Active | ✅ Active | ✅ Active | ✅ Active |

**Why Chart.js wins:** Zero build, CDN delivery, simple imperative API perfect for vanilla JS polling pattern. The analytics charts are standard (line, bar, pie) — Chart.js covers all.

### 3.4 HTML Template Strings over Template Engines

For 5 pages with simple data interpolation, a template engine adds unnecessary dep.

```typescript
// Simple, typed, no deps
function renderOverviewPage(data: OverviewData): string {
  return `<!DOCTYPE html>
<html><head><title>FYI Dashboard</title>
<link rel="stylesheet" href="/assets/style.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
</head><body>
  <header><h1>FYI Studio Dashboard</h1></header>
  <main>
    <section class="stats-grid">
      <div class="stat"><span>${data.jobsByStatus.pending}</span> Pending</div>
      <div class="stat"><span>${data.jobsByStatus.running}</span> Running</div>
      <div class="stat"><span>${data.jobsByStatus.completed}</span> Completed</div>
      <div class="stat"><span>$${data.totalCost.toFixed(4)}</span> Total Cost</div>
    </section>
    <section id="recent-jobs">${renderJobRows(data.recentJobs)}</section>
  </main>
  <script type="module" src="/assets/overview.js"></script>
</body></html>`;
}
```

If complexity grows, `eta` (embedded JS templates) is a 2KB drop-in — but not needed for MVP.

### 3.5 Media Serving: Fastify Static over Custom Route

```typescript
// services/dashboard/src/routes/media.ts
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEDIA_ROOT = process.env.FYI_MEDIA_ROOT ?? '/tmp/fyi-studio';

export async function mediaRoutes(fastify: FastifyInstance) {
  fastify.register(fastifyStatic, {
    root: MEDIA_ROOT,
    prefix: '/media/', // GET /media/<execution_id>/video.mp4
    decorateReply: false,
  });
}
```

- Handles Range requests for video seeking automatically
- Zero custom code
- Later swap to S3/R2 by changing `MEDIA_ROOT` and using `@fastify/s3` or proxy

---

## 4. Package Structure (New: `services/dashboard`)

```
services/dashboard/
├── package.json           # name: "@fyi/dashboard", private: true
├── tsconfig.json          # extends root, NodeNext, strict
├── src/
│   ├── index.ts           # Entry: create Fastify, register routes, listen
│   ├── routes/
│   │   ├── index.ts       # Register all route modules
│   │   ├── overview.ts    # GET /, GET /api/overview
│   │   ├── jobs.ts        # GET /jobs, GET /jobs/:id, GET /api/jobs*
│   │   ├── tenants.ts     # GET /tenants, GET /api/tenants
│   │   ├── analytics.ts   # GET /analytics, GET /api/analytics
│   │   └── media.ts       # GET /media/* (static)
│   ├── templates/
│   │   ├── layout.ts      # Shared HTML shell (head, header, footer)
│   │   ├── overview.ts    # renderOverviewPage(data)
│   │   ├── job-detail.ts  # renderJobDetailPage(job, telemetry, artifacts)
│   │   ├── tenants.ts     # renderTenantsPage(tenants[])
│   │   └── analytics.ts   # renderAnalyticsPage(chartsData)
│   ├── client/
│   │   ├── overview.ts    # Vanilla JS: polling + Chart.js init
│   │   ├── job-detail.ts  # Polling + video element handling
│   │   └── analytics.ts   # Chart.js chart creation/update
│   └── utils/
│       ├── prisma.ts      # Prisma client singleton (from @fyi/database)
│       └── analytics.ts   # @fyi/analytics aggregate helpers
├── .env.example           # FYI_MEDIA_ROOT, PORT
└── README.md              # How to run: npm run dev
```

**Root `package.json` additions:**
```json
{
  "scripts": {
    "dashboard": "tsx services/dashboard/src/index.ts",
    "dashboard:dev": "tsx watch services/dashboard/src/index.ts"
  }
}
```

---

## 5. API Contract (Dashboard-Only, Does NOT Change Contracts v1.1)

All endpoints are **read-only projections** over existing tables.

| Endpoint | Method | Returns | Source |
|----------|--------|---------|--------|
| `/` | GET | HTML (Overview page) | `jobs`, `telemetry` aggregates |
| `/api/overview` | GET | `{ jobs_by_status, total_cost, total_tokens, recent_jobs[] }` | `@fyi/analytics` + Prisma |
| `/jobs` | GET | HTML (Job list page) | `jobs` (paged, filtered) |
| `/api/jobs` | GET | `{ jobs: Job[], total: number, page: number }` | Prisma `jobs` |
| `/jobs/:id` | GET | HTML (Job detail + video player) | `job`, `telemetry[]`, `artifacts` |
| `/api/jobs/:id` | GET | `{ job, telemetry, artifacts, video_ref }` | Prisma join |
| `/tenants` | GET | HTML (Tenant list) | `tenant_context`, `tenant_policies`, spend |
| `/api/tenants` | GET | `{ tenants: TenantView[] }` | Prisma + `@fyi/analytics` |
| `/analytics` | GET | HTML (Charts page) | `@fyi/analytics` aggregates |
| `/api/analytics` | GET | `{ cost_over_time[], cost_by_capability[], tokens_by_worker[] }` | `@fyi/analytics` |
| `/media/*` | GET | Static file (video/audio/srt) | `/tmp/fyi-studio` (or S3) |

---

## 6. Data Flow Diagram

```
┌─────────────────┐     HTTP GET      ┌──────────────────────┐
│  Browser        │ ────────────────► │  Fastify (Dashboard) │
│  (Dashboard UI) │                   │  services/dashboard  │
└─────────────────┘                   └──────────┬───────────┘
                                                 │
                    ┌────────────────────────────┼────────────────────────────┐
                    ▼                            ▼                            ▼
           ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
           │ @fyi/database   │          │ @fyi/analytics  │          │  File System    │
           │ (Prisma Client) │          │ (Aggregations)  │          │ /tmp/fyi-studio │
           └────────┬────────┘          └────────┬────────┘          └────────┬────────┘
                    │                            │                            │
                    ▼                            ▼                            ▼
           ┌──────────────────────────────────────────────────────────────────────┐
           │                    PostgreSQL (Job Ledger)                           │
           │  jobs • telemetry • tenant_context • tenant_policies • memory_entries │
           └──────────────────────────────────────────────────────────────────────┘
```

**Key Invariants (per MVP Architecture):**
1. **Dashboard is read-only** — never writes to Job Ledger
2. **Media served by pointer** — reads `artifacts.video_url` (`/tmp/fyi-studio/...`) and serves via `/media/`
3. **No live push** — browser polls every 2s (matches Supervisor `POLL_INTERVAL_MS`)

---

## 7. Implementation Estimate (Sprint 7 / "Dashboard Sprint")

| Step | Task | Est. | Notes |
|------|------|------|-------|
| 7.1 | Scaffold `services/dashboard` (package.json, tsconfig, Fastify entry, root script) | S (1-2h) | Copy pattern from `services/supervisor` |
| 7.2 | Read-only API endpoints (`/api/overview`, `/api/jobs`, `/api/jobs/:id`, `/api/tenants`, `/api/analytics`) | M (3-5h) | Use `@fyi/database` + `@fyi/analytics` |
| 7.3 | Server-rendered HTML pages + vanilla JS polling + Chart.js | M (3-5h) | 5 pages, shared layout, 3 client modules |
| 7.4 | Media serving route (video/audio/subtitle from artifacts) | S (1-2h) | `@fastify/static` + Range support |
| 7.5 | E2E smoke (seed completed job → dashboard shows + video plays) + typecheck/build | S (1-2h) | Reuse existing test patterns |

**Total: ~8-16h (matches post-mvp-options.md estimate)**

---

## 8. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Scope creep into full SPA/framework | High | Medium | **Lock MVP**: Server-rendered HTML + minimal JS only; defer React/Vite to post-Dashboard |
| Media paths fragile (local `/tmp`) | Medium | Medium | Central `MEDIA_ROOT` constant; abstract behind `getMediaUrl(artifact)`; later swap to S3 |
| Read perf on large tables | Low | Low | Simple indexes exist on `jobs.created_at`, `telemetry.*`; add pagination |
| Accidental writes from UI | High | Low | **No mutation endpoints** in MVP; read-only routes only |
| Chart.js CDN blocked in air-gapped env | Low | Low | Vendor Chart.js in `public/assets/` as fallback |
| TypeScript types drift from Prisma | Medium | Low | Generate types from Prisma; `pnpm run typecheck` catches drift |

---

## 9. Founder Decision Request

**Please review and confirm:**

1. **Stack approved?** Fastify + Server HTML + Vanilla JS + Chart.js (CDN) + Prisma + `@fyi/analytics`
2. **Scope locked?** 5 pages, read-only, polling, no auth, no WebSockets
3. **Media serving?** `/media/*` from `/tmp/fyi-studio` via `@fastify/static`
4. **Timeline acceptable?** 8-16h (Sprint 7)

**If approved, next steps:**
- Create Milestone 8 Dashboard UI architecture doc (`.ai/architecture/dashboard-architecture.md`)
- Create Sprint 7 plan (`.ai/planning/sprints/Sprint-007/README.md`)
- Create Issues 7.1–7.5 (`.ai/planning/sprints/Sprint-007/Issue-701.md` through `Issue-705.md`)
- Update `orchestration-delegation-brief.md` for external agent delegation
- Begin implementation

---

## 10. Cross-References

- **Decision record:** [post-mvp-options.md](./post-mvp-options.md)
- **Technical blueprint:** [dashboard-proposal.md](./dashboard-proposal.md)
- **Delegation brief:** [orchestration-delegation-brief.md](./orchestration-delegation-brief.md)
- **MVP architecture (invariants):** [../architecture/mvp-architecture.md](../architecture/mvp-architecture.md)
- **Frozen contracts (unchanged):** [../architecture/contracts.md](../architecture/contracts.md)
- **Engineering standards:** [../architecture/engineering-standards.md](../architecture/engineering-standards.md)