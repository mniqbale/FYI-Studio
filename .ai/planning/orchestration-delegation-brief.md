---
id: orchestration-delegation-brief
title: "Orchestration Delegation Brief — for External AI Agents"
owner: "Founder (orchestrator) + Lead Engineer"
status: "active"
version: "2.0.0"
last_updated: "2026-08-06"
review_cycle: "per-delegation"
tags: [delegation, orchestration, brief, dashboard, ai-agent, knowledge-transfer]
related_documents:
  - "dashboard-proposal.md"
  - "dashboard-stack-proposal.md"
  - "dashboard-architecture.md"
  - "post-mvp-options.md"
  - "../architecture/contracts.md"
  - "../architecture/mvp-architecture.md"
  - "../planning/sprints/Sprint-007/README.md"
---

# Orchestration Delegation Brief

> **Purpose:** This document is a self-contained brief the **Founder (or any orchestrator) can hand to an external AI agent** to delegate a task — while ensuring the agent has enough context to work without the full session history, and that any knowledge it produces flows back into FYI Studio's constitution (`.ai/`).

---

## 1. How to Use This Brief (for the Orchestrator / Founder)

1. Pick a workstream from [post-mvp-options.md](./post-mvp-options.md) (currently: **Dashboard UI**).
2. Give the external agent THIS brief + the relevant proposals ([dashboard-proposal.md](./dashboard-proposal.md), [dashboard-stack-proposal.md](./dashboard-stack-proposal.md), [dashboard-architecture.md](../architecture/dashboard-architecture.md)) + the repo's constitution entrypoints.
3. Tell the agent which **deliverable** to produce and the **output contract** (Section 5).
4. After the agent finishes, review its output and, if accepted, integrate + commit it (or ask the agent to commit if you've granted push access).
5. Record the outcome in the constitution (append to `project-memory.md`, update `current-state.md`).

---

## 1a. ROLES & ORCHESTRATION PROTOCOL (IMPORTANT — read first)

> **This brief defines a role split. It does NOT mean the external agent should do everything alone.**

**Two roles exist in this project's workflow:**

| Role | Who | Responsibility |
|------|-----|----------------|
| **Orchestrator** | The Founder (human) — optionally advised by the **Lead Engineer (AI partner)** | Owns decisions, approves scope/ADRs, sequences workstreams, integrates + commits accepted output |
| **Executor (external AI agent)** | The agent that receives THIS brief | Produces a scoped deliverable per the output contract (Section 5); **returns work to the Orchestrator/Lead Engineer for review & integration** — it does NOT merge/commit/push on its own unless explicitly authorized |

**Orchestration protocol for the external agent:**
1. **Read, don't rewrite** — follow the mandated reading order in Section 2. Presume the constitution (`.ai/`) is the source of truth; do NOT invent new architecture, contracts, or schemas without proposing an ADR.
2. **Scope is fixed** — work only the delegated deliverable (currently the Dashboard per [dashboard-architecture.md](../architecture/dashboard-architecture.md) and Sprint 7 issues). Do NOT expand into other workstreams.
3. **Return, don't absorb** — when the deliverable is done, hand it back per the output contract. Do NOT merge into `main`, do NOT push, do NOT claim "done" without verification evidence.
4. **If the agent has deeper expertise** (e.g. a better charting/media-serving/UI approach) it should **propose** that as a knowledge doc (Section 4) for the Orchestrator/Lead Engineer to review — not silently implement a different stack than the approved proposal.

**What "delegating back to the Lead Engineer (this session)" means:**
- The external agent is a **producer of a candidate deliverable + knowledge**.
- The **Lead Engineer (this session) reviews, verifies, integrates, updates the constitution, and commits**. That is the natural hand-off point — the external agent does not bypass it.
- If the external agent is itself an orchestrator with sub-agents, it should delegate leaf tasks down and **consolidate results back to this brief's output contract** — never push to the repo.

> **Net effect:** an external agent reading this brief will know (a) what task it owns, (b) that it must return work to the Orchestrator/Lead Engineer rather than self-integrate, and (c) where to record any new knowledge it brings.

---

## 2. Context to Give the Agent (paste this block)

> You are working in the **FYI Studio** pnpm monorepo at `/workspaces/FYI-Studio` — an "AI Orchestration Platform for Creative Production" (BYOAI). The MVP (Milestones 1–7) is **COMPLETE**. You are being asked to work on a specific post-MVP workstream.
>
> **Read first (mandatory, in order):**
> 1. `.ai/context/start-here.md` — onboarding + required reading order
> 2. `.ai/architecture/contracts.md` — **Contracts v1.1 FROZEN** (do not change)
> 3. `.ai/architecture/mvp-architecture.md` — data plane, thin orchestrator invariants
> 4. `.ai/architecture/engineering-standards.md` — naming, logging, errors, anti-monster
> 5. `.ai/state/current-state.md` — what's done
> 6. `.ai/planning/post-mvp-options.md` + `.ai/planning/dashboard-proposal.md` + `.ai/planning/dashboard-stack-proposal.md` + `.ai/architecture/dashboard-architecture.md` — decision + technical blueprint + stack rationale + architecture
> 7. `.ai/planning/sprints/Sprint-007/README.md` + `Issue-701.md` through `Issue-705.md` — implementation plan
> 8. **THIS brief (Section 1a ROLES & ORCHESTRATION PROTOCOL)** — your role as Executor and the requirement to **return work to the Orchestrator/Lead Engineer** (do NOT merge/commit/push unless explicitly authorized)
> 9. The `fyi-studio-monorepo` skill (`skill_view name='fyi-studio-monorepo'`) for proven repo workflows
>
> **Your role:** You are the **Executor** of a scoped deliverable. You produce a candidate deliverable + any knowledge docs, return them per the output contract, and do NOT self-integrate into `main` unless authorized.
>
> **Environment facts:**
> - Working AI provider = Ollama Cloud (`OLLAMA_BASE_URL=https://ollama.com/v1`, model `deepseek-v4-flash`). Media = offline `espeak-ng` + `ffmpeg`. Cloud free tiers (OpenAI/Gemini/Anthropic) are credit-blocked.
> - Stack: TypeScript ESM, Node.js 20+, pnpm workspaces, PostgreSQL (Prisma) + Redis (BullMQ), Vitest, Biome.
> - Repo layout: `packages/{contracts,database,utils,ai,platform,knowledge,media,analytics,cli}`, `workers/{research,script,voice,mock,research-real,script-real,voice-real,subtitle-real,video-real}`, `services/{supervisor,dashboard}`, `tests/`.
> - **Verify with:** `pnpm run typecheck` and `pnpm run build`. **Do not commit/push unless explicitly authorized.**
> - **Language:** write code/comments in English; the user communicates in Indonesian but code stays English.

---

## 3. Current Delegated Workstream

### Dashboard UI (Post-MVP Option A) — Sprint 7 / Milestone 8

- **Source of truth for scope:** [dashboard-architecture.md](../architecture/dashboard-architecture.md) + [Sprint-007 README](../planning/sprints/Sprint-007/README.md) + Issues 701-705
- **Goal:** Build a read-only web Dashboard over the existing Job Ledger so the Founder can review pipeline progress, per-step artifacts (including video playback), and cost analytics **visually**.
- **Stack (as decided):**
  - **Fastify** (HTTP server) + **server-rendered HTML** + **vanilla JS** (ES modules, no bundler)
  - **Chart.js** (via CDN) for analytics charts
  - **@fastify/static** for media serving (`/media/*` → `/tmp/fyi-studio`)
  - **@fyi/database** (Prisma) + **@fyi/analytics** for data access
  - **No React/Vue/Svelte, no WebSocket, no auth, no writes** — MVP is read-only, polling-based
- **Acceptance criteria (from Sprint 7 DoD):**
  1. `npm run dashboard` starts a local server on port 3001
  2. `/` shows jobs-by-status + cost/token overview + recent jobs
  3. `/jobs` shows paginated, filterable job list
  4. `/jobs/:id` shows a per-step pipeline timeline and **plays the generated video**
  5. `/tenants` shows tenants + policy + spend-vs-quota
  6. `/analytics` renders 3 charts (cost over time, cost per capability, tokens per worker)
  7. No writes to the Job Ledger; `pnpm run typecheck` + `pnpm run build` pass
  8. Unit tests for API routes (≥80% coverage), E2E smoke test passes

---

## 4. If the Agent Adds New Knowledge (recommendation path)

If the external agent has expertise beyond the repo (e.g. a preferred charting approach, a better media-serving strategy, an alternative lightweight UI stack), ask it to **capture that as a new knowledge doc** so it can be reused — not just implemented silently.

### Where to put knowledge (follow the constitution)

| Type of knowledge | Location |
|-------------------|----------|
| **Architecture decision / trade-off** | `.ai/adr/ADR-XXXX-<slug>.md` (propose; mark status: Proposed; get approval before Accepted) |
| **Reusable procedure / workflow** | Hermes skill (`skill_manage`) or `.ai/planning/` if repo-scoped |
| **Technical design / blueprint** | `.ai/planning/<topic>-proposal.md` |
| **Current state / progress** | `.ai/state/current-state.md` (append to the relevant section) |
| **Historical / decision log** | `.ai/memory/project-memory.md` (append-only) |
| **Session handoff** | `.ai/handoff/<date>_<topic>_Handoff.md` |

**Guideline:** any decision that changes architecture, the data model, or the worker/contract layer **requires an ADR** (Constitution: Documentation First). New capabilities/costs/schemas must be reflected in `project-memory.md` + `current-state.md`.

---

## 5. Output Contract (what the agent must return)

The external agent should report back with:

1. **Files created/changed** (absolute paths).
2. **Verification results** — `pnpm run typecheck` exit code, `pnpm run build` exit code, unit/E2E test results.
3. **How to run/verify the deliverable** (exact commands).
4. **Any new knowledge / decisions** it wants captured (ADR / skill / doc proposals) and why.
5. **Anything NOT done** (deferred, blocked, or requires a human/credential).

---

## 6. Sprint 7 Implementation Details (for the Executor)

### Issue Breakdown

| Issue | Task | Key Files to Create |
|-------|------|---------------------|
| **7.1** | Scaffold `services/dashboard` package | `services/dashboard/{package.json,tsconfig.json,.env.example,src/index.ts,src/routes/*.ts,src/templates/*.ts,src/client/*.ts,src/utils/*.ts,public/assets/style.css}` |
| **7.2** | Read-Only API Endpoints | `src/utils/analytics.ts`, `src/routes/{overview,jobs,tenants,analytics}.ts` |
| **7.3** | Server-Rendered Pages + Client JS | `src/templates/*.ts` (refactored), `src/client/{overview,job-list,job-detail,analytics,polling}.ts` |
| **7.4** | Media Serving Route | `src/utils/media.ts`, `src/routes/media.ts` |
| **7.5** | E2E Smoke Test + Verification | `scripts/seed-test-job.ts`, `tests/e2e/dashboard.test.ts`, `tests/routes.test.ts` |

### Key Technical Patterns (must follow)

1. **Server-rendered HTML via template functions** — no build step, TypeScript template strings
2. **Vanilla JS polling** — `setInterval(fetch('/api/...'), 2000)` + DOM updates
3. **Chart.js from CDN** — `<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>`
4. **Media URLs** — `file:///tmp/fyi-studio/<exec_id>/video.mp4` → `/media/<exec_id>/video.mp4`
5. **Read-only Prisma queries** — `select`, `findMany`, `groupBy`, `count` — NO create/update/delete
6. **Reuse `@fyi/analytics`** for all aggregations

### Commands to Run

```bash
# Install deps
pnpm install

# Typecheck
pnpm run typecheck

# Build
pnpm run build

# Start dashboard (dev)
pnpm run dashboard:dev

# Start dashboard (prod)
pnpm run dashboard

# Run tests
pnpm test

# Seed test job (for E2E)
pnpm tsx services/dashboard/scripts/seed-test-job.ts
```

---

## 7. Cross-References

- **Dashboard blueprint:** [dashboard-proposal.md](./dashboard-proposal.md)
- **Stack rationale:** [dashboard-stack-proposal.md](./dashboard-stack-proposal.md)
- **Architecture:** [dashboard-architecture.md](../architecture/dashboard-architecture.md)
- **Decision record:** [post-mvp-options.md](./post-mvp-options.md)
- **Sprint plan:** [Sprint-007 README](../planning/sprints/Sprint-007/README.md)
- **Constitution entrypoints:** [start-here.md](../context/start-here.md), [contracts.md](../architecture/contracts.md)
- **Repo workflows:** the `fyi-studio-monorepo` Hermes skill