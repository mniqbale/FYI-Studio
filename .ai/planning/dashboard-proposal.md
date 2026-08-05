---
id: dashboard-proposal
title: "Dashboard UI — Technical Proposal (Post-MVP Option A)"
owner: "Lead Engineer (AI Agent) + Founder"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-05"
review_cycle: "pre-implementation"
tags: [dashboard, ui, proposal, stack, flow, post-mvp]
related_documents:
  - "post-mvp-options.md"
  - "orchestration-delegation-brief.md"
  - "../architecture/mvp-architecture.md"
  - "../architecture/contracts.md"
---

# Dashboard UI — Technical Proposal

> **Status: PROPOSED (pending Founder approval).** This is the technical blueprint for the Dashboard UI — the first post-MVP workstream. It defines the **technology stack** and the **data flow** so the Founder can review visually and so the work can be delegated to an external AI agent via [orchestration-delegation-brief.md](./orchestration-delegation-brief.md).

---

## 1. Why a Dashboard

The MVP already stores everything needed to visualize the system:

- **Jobs** (`jobs` table): status, recipe, artifacts (research, script, voice, subtitle, video), timestamps
- **Telemetry** (`telemetry` table): per-step cost, tokens, duration, provider, model
- **Tenant context / memory** (`tenant_context`, `memory_entries`)
- **Tenant policies** (`tenant_policies`): cost quota, model prefs, enabled

A Dashboard turns this into a **human-reviewable surface** — the Founder's preferred way to work. It shows, in real time: job pipeline progress, per-step artifacts (including the generated video), and cost/usage analytics.

---

## 2. Technology Stack

**Guiding principle (per Engineering Standards + Anti-Monster Policy):** prefer native Node.js / minimal dependencies; keep the Dashboard a **thin, read-only view** over the existing Job Ledger. No new database, no heavy framework.

### Recommended stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Runtime** | Node.js 20+ (ESM) — same as the rest of the monorepo | Consistency, no new runtime |
| **Language** | TypeScript (strict, NodeNext) — same as all packages | Type safety across the stack |
| **Web framework** | **Fastify** (or Express if preferred) | Minimal, fast, first-class TS support; a thin HTTP/JSON layer |
| **Rendering** | **Server-rendered HTML + a tiny vanilla-JS layer** (no React/Vue for MVP) | Anti-Monster; the dashboard is a read-only view, no complex client state |
| **Templating** | Simple HTML templates (or `hono` with JSX if a framework is desired) | Keeps it dependency-light |
| **Data access** | `@fyi/database` (Prisma) — read queries | Reuse the existing client; no second ORM |
| **Charting** | **Chart.js** (single `<script>` CDN or vendored) | Lightweight, renders from our JSON, no build step |
| **Serving media** | Static file handler over `/tmp/fyi-studio` (or S3/R2 later) | Video/audio playback via `<video>` element |
| **Deployment (MVP)** | Local dev server (e.g. `npm run dashboard`) | Matches MVP "runs locally" posture |

### What we deliberately do NOT add (MVP)
- No React/Vue/Svelte + bundler (Webpack/Vite) — overkill for a read-only view.
- No separate analytics DB — read from the existing Postgres telemetry.
- No auth for MVP (internal tool); a real auth is a production-hardening concern (Option F).
- No WebSocket/pub-sub for live updates — a simple **poll every 2s** matches the existing Supervisor polling pattern.

> **Decision:** Fastify (HTTP) + server-rendered HTML + Chart.js + existing Prisma. This is the least-friction path and keeps the whole codebase TypeScript/ESM-consistent.

---

## 3. Dashboard Layout / Pages

| Route | Purpose | Key data |
|-------|---------|----------|
| `/` | **Overview** — jobs by status, total cost, token usage, recent jobs | `jobs` count by status, `telemetry` aggregates |
| `/jobs` | **Job list** — all jobs with status + recipe + timestamps; filterable by tenant/status | `jobs` rows |
| `/jobs/:id` | **Job detail** — pipeline timeline (per step), artifacts per step, **video player** | `job`, `telemetry`, `artifacts` |
| `/tenants` | **Tenant list** — tenants, brand voice, policy, cost quota vs spend | `tenant_context`, `tenant_policies`, `tenant_spend` |
| `/analytics` | **Cost & usage** — charts (cost over time, cost per capability, tokens) | `telemetry` aggregates via `@fyi/analytics` |

Each page is a **read-only** query against the existing tables — no writes, no state mutation from the UI.

---

## 4. Data Flow

```
Browser (Dashboard UI)
        │  GET / , /jobs, /jobs/:id, /tenants, /analytics
        ▼
Fastify HTTP server (services/dashboard)  ──►  @fyi/database (Prisma, read-only)
        │                                        @fyi/analytics (aggregates)
        │                                        @fyi/knowledge (tenant context)
        ▼
PostgreSQL (Job Ledger: jobs, telemetry, tenant_context, tenant_policies, memory_entries)
        ▲
        │  (existing Supervisor writes here — Dashboard only READS)
```

**Key invariants (per MVP architecture / Reference-Based Data Plane):**
1. **Dashboard is read-only** — it never writes to the Job Ledger. All writes stay with the Supervisor/workers.
2. **Media is served by pointer** — the dashboard reads `artifacts.*` file paths (`/tmp/fyi-studio/...`) and serves them via a static/media route; it does not transport binary through the orchestrator.
3. **No live push** — the browser polls every ~2s (matches Supervisor's `POLL_INTERVAL_MS`), so the view is always near-real-time without WebSockets.

### Endpoint contract (new, dashboard-only — does NOT change frozen Contracts v1.1)

| Endpoint | Returns |
|----------|---------|
| `GET /api/overview` | { jobs_by_status, total_cost, total_tokens, recent_jobs[] } |
| `GET /api/jobs` | jobs[] (paged, filterable by tenant/status) |
| `GET /api/jobs/:id` | { job, telemetry[], artifacts, video_ref } |
| `GET /api/tenants` | tenants[] (context + policy + spend vs quota) |
| `GET /api/analytics` | { cost_over_time[], cost_by_capability[], tokens_by_worker[] } |
| `GET /media/*` | static file from `/tmp/fyi-studio` (video/audio/subtitle) |

> All endpoints are **read-only projections** over existing tables. Contracts v1.1 remain frozen — the Dashboard adds a new read surface, it does not change the worker/contract layer.

---

## 5. MVP Implementation Steps (Sprint 7 / "Dashboard")

| Step | Task | Est. |
|------|------|------|
| 7.1 | Scaffold `services/dashboard` (Fastify + tsconfig + scripts), add `dashboard` root script | S |
| 7.2 | Read-only API endpoints (`/api/overview`, `/api/jobs`, `/api/jobs/:id`, `/api/tenants`, `/api/analytics`) using `@fyi/database` + `@fyi/analytics` | M |
| 7.3 | Server-rendered HTML pages + vanilla-JS polling + Chart.js for analytics | M |
| 7.4 | Media serving route (video/audio/subtitle playback from artifacts) | S |
| 7.5 | E2E smoke (seed a completed job → dashboard shows it + video plays) + typecheck/build | S |

**Definition of Done:** `npm run dashboard` starts a local server; browsing `/` shows pipeline status; a completed job's `/jobs/:id` shows the pipeline timeline and plays its generated video; `/analytics` charts render; no writes to the Job Ledger; `pnpm run typecheck` + `build` pass.

---

## 6. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Scope creep into a full SPA/framework | High | Medium | Lock MVP to server-rendered HTML + minimal JS; defer React/Vite |
| Media paths fragile (local /tmp) | Medium | Medium | Central media-root constant; later swap to S3/R2 via same route |
| Read perf on large tables | Low | Low | Simple indexes already on `jobs.created_at`, `telemetry.*`; pagination |
| Accidental writes from UI | High | Low | Read-only routes; no mutation endpoints in MVP |

---

## 7. Cross-References

- **Decision record:** [post-mvp-options.md](./post-mvp-options.md)
- **Delegation brief (for an external AI agent):** [orchestration-delegation-brief.md](./orchestration-delegation-brief.md)
- **Data plane / thin orchestrator invariants:** [mvp-architecture.md](../architecture/mvp-architecture.md)
- **Frozen contracts (unchanged):** [contracts.md](../architecture/contracts.md)
