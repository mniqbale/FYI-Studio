---
id: dashboard-architecture
title: "FYI Studio Dashboard UI Architecture (Milestone 8)"
owner: "Principal Architect"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-milestone"
tags: [architecture, dashboard, milestone-8, ui, read-only-view, fastify, post-mvp]
related_documents:
  - "mvp-architecture.md"
  - "contracts.md"
  - "engineering-standards.md"
  - "../planning/dashboard-stack-proposal.md"
  - "../planning/dashboard-proposal.md"
  - "../planning/post-mvp-options.md"
related_adr:
  - "ADR-0001"
  - "ADR-0002"
  - "ADR-0005"
related_sprint:
  - "Sprint-007"
---

# FYI Studio Dashboard UI Architecture — Milestone 8

> **Status:** PROPOSED (pending Founder approval). This document defines the architecture for the Dashboard UI — the first post-MVP workstream. It extends the MVP v1.0 architecture with a **read-only visualization layer** over the existing Job Ledger.

---

## 1. Purpose & Scope

### 1.1 Why a Dashboard?

The MVP (Milestones 1–7) stores everything needed for human review:
- **Jobs** (`jobs` table): status, recipe, artifacts (research, script, voice, subtitle, video), timestamps
- **Telemetry** (`telemetry` table): per-step cost, tokens, duration, provider, model
- **Tenant context / memory** (`tenant_context`, `memory_entries`)
- **Tenant policies** (`tenant_policies`): cost quota, model prefs, enabled

The Dashboard turns this into a **human-reviewable surface** — the Founder's preferred way to work. It shows, in real time:
- Job pipeline progress (visual timeline per step)
- Per-step artifacts (including generated video playback)
- Cost/usage analytics with charts

### 1.2 Scope (MVP)

**In Scope:**
- Read-only web UI over existing Job Ledger (PostgreSQL)
- 5 pages: Overview, Jobs List, Job Detail, Tenants, Analytics
- Video/audio/subtitle playback from artifacts
- Polling-based near-real-time updates (2s interval)
- Local development server (`npm run dashboard`)

**Out of Scope (Post-MVP / Hardening):**
- Authentication/Authorization (Option F: Production Hardening)
- WebSocket/push updates
- Write operations (job creation, approval, retry)
- Multi-user, roles, permissions
- S3/R2 media serving (uses local `/tmp/fyi-studio` for MVP)
- Historical retention policies

---

## 2. Architectural Positioning

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FYI STUDIO SYSTEM (MVP v1.0 + Dashboard)            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │   Workers    │    │   Workers    │    │   Workers    │    │ Workers  │  │
│  │  (Research)  │    │   (Script)   │    │   (Voice)    │    │ (Video)  │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └────┬─────┘  │
│         │                   │                   │                   │        │
│         ▼                   ▼                   ▼                   ▼        │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                    SUPERVISOR (Thin Orchestrator)                      │  │
│  │  • BullMQ Queue (Redis)                                                │  │
│  │  • State Machine: PENDING → RUNNING → WAITING_APPROVAL → COMPLETED     │  │
│  │  • Context Assembly (tenant_context, memory_entries)                   │  │
│  │  • ModelGate v2 (capability → provider/model)                          │  │
│  └────────────────────────────────┬───────────────────────────────────────┘  │
│                                   │                                          │
│         ┌─────────────────────────┼─────────────────────────┐               │
│         ▼                         ▼                         ▼               │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐         │
│  │   JOB       │          │  TELEMETRY  │          │  TENANT     │         │
│  │   LEDGER    │          │   TABLE     │          │  CONTEXT/   │         │
│  │  (Postgres) │          │  (Postgres) │          │  POLICIES   │         │
│  └──────┬──────┘          └──────┬──────┘          └──────┬──────┘         │
│         │                        │                        │                 │
│         │         ┌──────────────┴──────────────┐        │                 │
│         │         ▼                             ▼        │                 │
│         │  ┌─────────────────────────────────────────────┐  │                 │
│         │  │          DASHBOARD (NEW - Milestone 8)       │  │                 │
│         │  │  • Fastify HTTP Server (Read-Only)           │  │                 │
│         │  │  • @fyi/database (Prisma) → Job Ledger       │  │                 │
│         │  │  • @fyi/analytics → Aggregations             │  │                 │
│         │  │  • Server-Rendered HTML + Vanilla JS         │  │                 │
│         │  │  • Chart.js (CDN) → Charts                   │  │                 │
│         │  │  • @fastify/static → Media (/tmp/fyi-studio) │  │                 │
│         │  └─────────────────────────────────────────────┘  │                 │
│         │                                                    │                 │
│         └────────────────────────────────────────────────────┘                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Invariants (from MVP Architecture):**
1. **Dashboard is read-only** — it NEVER writes to the Job Ledger. All writes stay with the Supervisor/workers.
2. **Media is served by pointer** — the Dashboard reads `artifacts.*` file paths (`/tmp/fyi-studio/...`) and serves them via a static/media route; it does not transport binary through the orchestrator.
3. **No live push** — the browser polls every ~2s (matches Supervisor's `POLL_INTERVAL_MS`), so the view is always near-real-time without WebSockets.
4. **Contracts v1.1 remain frozen** — the Dashboard adds a new read surface, it does not change the worker/contract layer.

---

## 3. Technology Stack

| Layer | Choice | Version | Rationale |
|-------|--------|---------|-----------|
| **Runtime** | Node.js | 20 LTS | Consistency with monorepo; no new runtime |
| **Language** | TypeScript (ESM, strict, NodeNext) | 5.x | Type safety across stack; matches all packages |
| **Web Framework** | **Fastify** | 4.x | Minimal, fast, first-class TS; schema-based validation; plugin ecosystem |
| **Rendering** | **Server-rendered HTML + Vanilla JS** | — | Anti-Monster Policy; read-only view needs no complex client state |
| **Templating** | **Template strings (TypeScript functions)** | — | Zero deps, zero build, typed, < 50 lines per page |
| **Data Access** | `@fyi/database` (Prisma Client) | 5.x | Reuse existing client; read-only queries |
| **Analytics** | `@fyi/analytics` | 1.x | Reuse existing cost intelligence module |
| **Charting** | **Chart.js** (via CDN) | 4.x | Lightweight, renders from JSON, no build step |
| **Media Serving** | `@fastify/static` | — | Handles Range requests for video seeking; zero custom code |
| **Deployment (MVP)** | Local dev server | — | `npm run dashboard` — matches MVP "runs locally" posture |

**Dependencies (services/dashboard/package.json):**
```json
{
  "dependencies": {
    "fastify": "^4.28.0",
    "@fastify/static": "^7.0.0",
    "@fyi/database": "workspace:*",
    "@fyi/analytics": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsx": "^4.19.0",
    "@types/node": "^20.0.0"
  }
}
```

**Note:** `@fyi/database` and `@fyi/analytics` are workspace dependencies — the Dashboard is part of the monorepo and shares the Prisma client and analytics module. This is acceptable because the Dashboard is a **service** (not a worker), and services may share internal packages. Workers remain isolated with only `@fyi/contracts`.

---

## 4. Package Structure

```
services/dashboard/
├── package.json              # @fyi/dashboard (private)
├── tsconfig.json             # extends root, NodeNext, strict
├── .env.example              # FYI_MEDIA_ROOT, PORT, DATABASE_URL
├── src/
│   ├── index.ts              # Entry: create Fastify, register routes, listen
│   ├── routes/
│   │   ├── index.ts          # Register all route modules
│   │   ├── overview.ts       # GET /, GET /api/overview
│   │   ├── jobs.ts           # GET /jobs, GET /jobs/:id, GET /api/jobs*
│   │   ├── tenants.ts        # GET /tenants, GET /api/tenants
│   │   ├── analytics.ts      # GET /analytics, GET /api/analytics
│   │   └── media.ts          # GET /media/* (static file serving)
│   ├── templates/
│   │   ├── layout.ts         # Shared HTML shell (head, header, footer, CSS)
│   │   ├── overview.ts       # renderOverviewPage(data)
│   │   ├── job-detail.ts     # renderJobDetailPage(job, telemetry, artifacts)
│   │   ├── job-list.ts       # renderJobListPage(jobs[], pagination)
│   │   ├── tenants.ts        # renderTenantsPage(tenants[])
│   │   └── analytics.ts      # renderAnalyticsPage(chartsData)
│   ├── client/
│   │   ├── overview.ts       # Vanilla JS: polling + stats update
│   │   ├── job-detail.ts     # Polling + video element + timeline
│   │   ├── job-list.ts       # Polling + table refresh
│   │   └── analytics.ts      # Chart.js chart creation/update
│   └── utils/
│       ├── prisma.ts         # Prisma client singleton (from @fyi/database)
│       ├── analytics.ts      # @fyi/analytics aggregate helpers
│       └── media.ts          # Media URL helpers (execution_id → /media/...)
├── public/
│   └── assets/
│       └── style.css         # Minimal CSS (no framework)
└── README.md                 # How to run: npm run dev
```

---

## 5. API Contract (Dashboard-Only)

All endpoints are **read-only projections** over existing tables. **Does NOT change Contracts v1.1.**

### 5.1 HTML Pages (Browser Navigation)

| Route | Template | Description |
|-------|----------|-------------|
| `GET /` | `overview.ts` | Dashboard overview: jobs by status, total cost, recent jobs |
| `GET /jobs` | `job-list.ts` | Paginated, filterable job list |
| `GET /jobs/:id` | `job-detail.ts` | Pipeline timeline, per-step artifacts, video player |
| `GET /tenants` | `tenants.ts` | Tenant list with policy + spend vs quota |
| `GET /analytics` | `analytics.ts` | Charts: cost over time, cost by capability, tokens by worker |

### 5.2 JSON APIs (Polled by Vanilla JS)

| Endpoint | Returns | Source |
|----------|---------|--------|
| `GET /api/overview` | `{ jobs_by_status, total_cost, total_tokens, recent_jobs[] }` | `@fyi/analytics` + Prisma |
| `GET /api/jobs?page=1&limit=20&status=running&tenant_id=...` | `{ jobs: Job[], total: number, page: number }` | Prisma `jobs` |
| `GET /api/jobs/:id` | `{ job, telemetry[], artifacts, video_ref }` | Prisma join |
| `GET /api/tenants` | `{ tenants: TenantView[] }` | Prisma + `@fyi/analytics` |
| `GET /api/analytics?tenant_id=&from=&to=` | `{ cost_over_time[], cost_by_capability[], tokens_by_worker[] }` | `@fyi/analytics` |
| `GET /media/:execution_id/:filename` | Static file (video/audio/srt) | `/tmp/fyi-studio` (or S3) |

### 5.3 Response Types (TypeScript)

```typescript
// services/dashboard/src/types.ts
export interface OverviewData {
  jobsByStatus: Record<JobStatus, number>;
  totalCost: number;
  totalTokens: number;
  recentJobs: RecentJob[];
}

export interface RecentJob {
  id: string;
  tenantId: string;
  recipeId: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  currentStepIndex: number;
  totalSteps: number;
}

export interface JobListResponse {
  jobs: JobRow[];
  total: number;
  page: number;
  limit: number;
}

export interface JobRow {
  id: string;
  tenantId: string;
  recipeId: string;
  status: JobStatus;
  currentStepIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface JobDetailResponse {
  job: JobRow & { recipeSnapshot: ProductionRecipe; artifacts: JobArtifacts };
  telemetry: TelemetryRow[];
  videoRef: string | null; // /media/<execution_id>/video.mp4
}

export interface TenantView {
  tenantId: string;
  brandVoice: string;
  language: string;
  forbiddenTerms: string[];
  policy: TenantPolicy | null;
  spendVsQuota: { spent: number; quota: number; percentage: number };
}

export interface AnalyticsData {
  costOverTime: { date: string; cost: number }[];
  costByCapability: { capability: string; cost: number; count: number }[];
  tokensByWorker: { workerId: string; tokensIn: number; tokensOut: number; count: number }[];
}
```

---

## 6. Data Flow

### 6.1 Page Load (Server-Rendered)

```
Browser GET /jobs/:id
       │
       ▼
Fastify route handler (job-detail.ts)
       │
       ├─► @fyi/database (Prisma) ──► SELECT * FROM jobs WHERE id = ?
       ├─► @fyi/database (Prisma) ──► SELECT * FROM telemetry WHERE job_id = ?
       └─► Build video_ref from artifacts.video_url → /media/<execution_id>/video.mp4
       │
       ▼
renderJobDetailPage(job, telemetry, artifacts, video_ref) → HTML string
       │
       ▼
reply.send(html) → Browser renders page
       │
       ▼
<script type="module" src="/assets/job-detail.js"> loads
       │
       ▼
Vanilla JS: startPolling(2000) → fetch('/api/jobs/:id') → update DOM
```

### 6.2 Polling Update (Client-Side)

```
setInterval(2000) → fetch('/api/jobs/:id')
       │
       ▼
Fastify route handler → Prisma queries → JSON response
       │
       ▼
Vanilla JS: updatePipelineTimeline(), updateArtifacts(), checkVideoReady()
```

### 6.3 Media Request

```
Browser: <video src="/media/abc-123-def/video.mp4" controls>
       │
       ▼
Fastify @fastify/static (prefix: /media/, root: /tmp/fyi-studio)
       │
       ▼
Serves /tmp/fyi-studio/abc-123-def/video.mp4 with Range support
       │
       ▼
Browser plays video (seeking works via HTTP Range requests)
```

---

## 7. Database Queries (Read-Only)

All queries use `@fyi/database` (Prisma) with **read-only transactions** where possible.

### 7.1 Overview Aggregates

```typescript
// utils/analytics.ts
import { analytics } from '@fyi/analytics';

export async function getOverviewData(tenantId?: string) {
  const [jobsByStatus, totals, recentJobs] = await Promise.all([
    prisma.job.groupBy({
      by: ['status'],
      where: tenantId ? { tenantId } : {},
      _count: true,
    }),
    analytics.getTotals(tenantId), // Uses @fyi/analytics
    prisma.job.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, tenantId: true, recipeId: true, status: true, createdAt: true, updatedAt: true, currentStepIndex: true, recipeSnapshot: true },
    }),
  ]);
  return { jobsByStatus, ...totals, recentJobs };
}
```

### 7.2 Job Detail with Telemetry

```typescript
export async function getJobDetail(jobId: string) {
  const [job, telemetry] = await Promise.all([
    prisma.job.findUniqueOrThrow({ where: { id: jobId } }),
    prisma.telemetry.findMany({
      where: { jobId },
      orderBy: { startedAt: 'asc' },
    }),
  ]);
  const videoRef = job.artifacts?.video_url
    ? `/media/${extractExecutionId(job.artifacts.video_url)}/video.mp4`
    : null;
  return { job, telemetry, videoRef };
}
```

### 7.3 Tenants with Spend vs Quota

```typescript
export async function getTenantsView() {
  const [contexts, policies, spend] = await Promise.all([
    prisma.tenantContext.findMany(),
    prisma.tenantPolicy.findMany(),
    analytics.getSpendByTenant(), // @fyi/analytics
  ]);
  return contexts.map(ctx => ({
    tenantId: ctx.tenantId,
    brandVoice: ctx.brandVoice,
    language: ctx.language,
    forbiddenTerms: ctx.forbiddenTerms,
    policy: policies.find(p => p.tenantId === ctx.tenantId) ?? null,
    spendVsQuota: {
      spent: spend[ctx.tenantId] ?? 0,
      quota: policies.find(p => p.tenantId === ctx.tenantId)?.costQuota ?? 0,
      percentage: policies.find(p => p.tenantId === ctx.tenantId)?.costQuota
        ? ((spend[ctx.tenantId] ?? 0) / policies.find(p => p.tenantId === ctx.tenantId)!.costQuota) * 100
        : 0,
    },
  }));
}
```

---

## 8. Client-Side Vanilla JS Pattern

Each page has a small ES module (`/assets/*.js`) loaded via `<script type="module">`.

### 8.1 Polling Base

```typescript
// client/polling.ts
export function startPolling(url: string, intervalMs: number, onData: (data: any) => void) {
  let stopped = false;
  async function tick() {
    if (stopped) return;
    try {
      const res = await fetch(url);
      if (res.ok) onData(await res.json());
    } catch (e) { console.warn('Poll failed', e); }
    if (!stopped) setTimeout(tick, intervalMs);
  }
  tick();
  return () => { stopped = true; };
}
```

### 8.2 Job Detail Page (Example)

```typescript
// client/job-detail.ts
import { startPolling } from './polling.js';

const jobId = new URLSearchParams(window.location.search).get('id') 
  ?? window.location.pathname.split('/').pop();

function updateTimeline(telemetry: TelemetryRow[]) {
  const container = document.getElementById('timeline')!;
  container.innerHTML = telemetry.map(t => `
    <div class="step ${t.status === 'success' ? 'done' : 'running'}">
      <span>${t.workerId}</span>
      <span>${t.durationMs}ms</span>
      <span>$${t.cost.toFixed(6)}</span>
    </div>
  `).join('');
}

function updateVideo(videoRef: string | null) {
  const video = document.getElementById('video-player') as HTMLVideoElement;
  if (videoRef && video.src !== videoRef) {
    video.src = videoRef;
    video.load();
  }
}

startPolling(`/api/jobs/${jobId}`, 2000, (data) => {
  updateTimeline(data.telemetry);
  updateVideo(data.videoRef);
  // Update status badge, step indicator, etc.
});
```

### 8.3 Analytics Charts (Chart.js)

```typescript
// client/analytics.ts
import { Chart } from 'chart.js/auto';

let costOverTimeChart: Chart;
let costByCapabilityChart: Chart;

async function loadCharts() {
  const data = await fetch('/api/analytics').then(r => r.json());
  
  costOverTimeChart = new Chart(document.getElementById('cost-over-time'), {
    type: 'line',
    data: { labels: data.costOverTime.map(d => d.date), datasets: [{ label: 'Cost (USD)', data: data.costOverTime.map(d => d.cost) }] },
  });
  
  costByCapabilityChart = new Chart(document.getElementById('cost-by-capability'), {
    type: 'bar',
    data: { labels: data.costByCapability.map(d => d.capability), datasets: [{ label: 'Cost (USD)', data: data.costByCapability.map(d => d.cost) }] },
  });
}

loadCharts();
startPolling('/api/analytics', 30000, (data) => { // 30s for analytics
  costOverTimeChart.data.labels = data.costOverTime.map(d => d.date);
  costOverTimeChart.data.datasets[0].data = data.costOverTime.map(d => d.cost);
  costOverTimeChart.update();
  // ... same for other charts
});
```

---

## 9. Media Serving

### 9.1 Configuration

```typescript
// routes/media.ts
import fastifyStatic from '@fastify/static';
import { FastifyInstance } from 'fastify';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEDIA_ROOT = process.env.FYI_MEDIA_ROOT ?? '/tmp/fyi-studio';

export async function mediaRoutes(fastify: FastifyInstance) {
  fastify.register(fastifyStatic, {
    root: MEDIA_ROOT,
    prefix: '/media/',
    decorateReply: false,
    // Range requests for video seeking are handled automatically by fastify-static
  });
}
```

### 9.2 Artifact → Media URL Mapping

```
Job Artifact: artifacts.video_url = "file:///tmp/fyi-studio/abc-123-def/video.mp4"
                                    │
                                    ▼
                          extractExecutionId() → "abc-123-def"
                                    │
                                    ▼
                          Media URL: "/media/abc-123-def/video.mp4"
                                    │
                                    ▼
                          Fastify Static → /tmp/fyi-studio/abc-123-def/video.mp4
```

---

## 10. Root Package.json Integration

```json
// /workspaces/FYI-Studio/package.json
{
  "scripts": {
    "dashboard": "tsx services/dashboard/src/index.ts",
    "dashboard:dev": "tsx watch services/dashboard/src/index.ts",
    "dashboard:build": "pnpm --filter @fyi/dashboard run build",
    "dashboard:typecheck": "pnpm --filter @fyi/dashboard run typecheck"
  }
}
```

---

## 11. Environment Variables

```bash
# services/dashboard/.env.example
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/fyi_studio
FYI_MEDIA_ROOT=/tmp/fyi-studio
LOG_LEVEL=info
```

---

## 12. Definition of Done (Milestone 8)

| Criterion | Verification |
|-----------|--------------|
| `npm run dashboard` starts server on `http://localhost:3001` | Manual test |
| `/` shows jobs by status, total cost, total tokens, recent jobs | Visual check |
| `/jobs` shows paginated, filterable job list | Visual check |
| `/jobs/:id` shows pipeline timeline + plays generated video | Visual check (video plays) |
| `/tenants` shows tenants with policy + spend vs quota | Visual check |
| `/analytics` renders 3 charts (cost over time, by capability, tokens by worker) | Visual check |
| No writes to Job Ledger (verified by code review + DB trigger test) | Code review |
| `pnpm run typecheck` passes | CI check |
| `pnpm run build` passes | CI check |
| Unit tests for API routes (≥80% coverage) | `pnpm test` |

---

## 13. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Scope creep into full SPA/framework | High | Medium | **Lock MVP** in this doc; defer React/Vite to post-Dashboard |
| Media paths fragile (local `/tmp`) | Medium | Medium | Central `MEDIA_ROOT` constant; abstract behind `getMediaUrl()`; later swap to S3 |
| Read perf on large tables | Low | Low | Indexes exist on `jobs.created_at`, `telemetry.*`; pagination on `/api/jobs` |
| Accidental writes from UI | High | Low | **No mutation endpoints** in MVP; read-only routes only |
| Chart.js CDN blocked in air-gapped env | Low | Low | Vendor Chart.js in `public/assets/` as fallback |
| TypeScript types drift from Prisma | Medium | Low | Generate types from Prisma; `pnpm run typecheck` catches drift |

---

## 14. Cross-References

- **Stack Proposal & Rationale:** [../planning/dashboard-stack-proposal.md](../planning/dashboard-stack-proposal.md)
- **Technical Blueprint:** [../planning/dashboard-proposal.md](../planning/dashboard-proposal.md)
- **Decision Record:** [../planning/post-mvp-options.md](../planning/post-mvp-options.md)
- **Delegation Brief:** [../planning/orchestration-delegation-brief.md](../planning/orchestration-delegation-brief.md)
- **MVP Architecture (invariants):** [mvp-architecture.md](mvp-architecture.md)
- **Frozen Contracts (unchanged):** [contracts.md](contracts.md)
- **Engineering Standards:** [engineering-standards.md](engineering-standards.md)

---

## 15. Next Steps (Upon Approval)

1. Create Sprint 7 plan: `.ai/planning/sprints/Sprint-007/README.md`
2. Create Issues 7.1–7.5: `.ai/planning/sprints/Sprint-007/Issue-701.md` through `Issue-705.md`
3. Update `orchestration-delegation-brief.md` with finalized scope
4. Scaffold `services/dashboard` package
5. Begin implementation per Sprint 7 plan