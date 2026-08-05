---
id: orchestration-delegation-brief
title: "Orchestration Delegation Brief — for External AI Agents"
owner: "Founder (orchestrator) + Lead Engineer"
status: "active"
version: "1.0.0"
last_updated: "2026-08-05"
review_cycle: "per-delegation"
tags: [delegation, orchestration, brief, dashboard, ai-agent, knowledge-transfer]
related_documents:
  - "dashboard-proposal.md"
  - "post-mvp-options.md"
  - "../architecture/contracts.md"
  - "../architecture/mvp-architecture.md"
---

# Orchestration Delegation Brief

> **Purpose:** This document is a self-contained brief the **Founder (or any orchestrator) can hand to an external AI agent** to delegate a task — while ensuring the agent has enough context to work without the full session history, and that any knowledge it produces flows back into FYI Studio's constitution (`.ai/`).

---

## 1. How to Use This Brief (for the Orchestrator / Founder)

1. Pick a workstream from [post-mvp-options.md](./post-mvp-options.md) (currently: **Dashboard UI**).
2. Give the external agent THIS brief + the relevant proposal ([dashboard-proposal.md](./dashboard-proposal.md)) + the repo's constitution entrypoints.
3. Tell the agent which **deliverable** to produce and the **output contract** (Section 5).
4. After the agent finishes, review its output and, if accepted, integrate + commit it (or ask the agent to commit if you've granted push access).
5. Record the outcome in the constitution (append to `project-memory.md`, update `current-state.md`).

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
> 6. `.ai/planning/dashboard-proposal.md` (if your task is the Dashboard) — the technical blueprint
> 7. The `fyi-studio-monorepo` skill (`skill_view name='fyi-studio-monorepo'`) for proven repo workflows
>
> **Environment facts:**
> - Working AI provider = Ollama Cloud (`OLLAMA_BASE_URL=https://ollama.com/v1`, model `deepseek-v4-flash`). Media = offline `espeak-ng` + `ffmpeg`. Cloud free tiers (OpenAI/Gemini/Anthropic) are credit-blocked.
> - Stack: TypeScript ESM, Node.js 20+, pnpm workspaces, PostgreSQL (Prisma) + Redis (BullMQ), Vitest, Biome.
> - Repo layout: `packages/{contracts,database,utils,ai,platform,knowledge,media,analytics,cli}`, `workers/{research,script,voice,mock,research-real,script-real,voice-real,subtitle-real,video-real}`, `services/supervisor`.
> - **Verify with:** `pnpm run typecheck` and `pnpm run build`. **Do not commit/push unless explicitly authorized.**
> - **Language:** write code/comments in English; the user communicates in Indonesian but code stays English.

---

## 3. Current Delegated Workstream

### Dashboard UI (Post-MVP Option A)

- **Source of truth for scope:** [dashboard-proposal.md](./dashboard-proposal.md)
- **Goal:** Build a read-only web Dashboard over the existing Job Ledger so the Founder can review pipeline progress, per-step artifacts (including video playback), and cost analytics **visually**.
- **Stack (as decided):** Fastify + server-rendered HTML + vanilla JS + Chart.js, reusing `@fyi/database` + `@fyi/analytics`. No SPA/bundler. No writes to the Job Ledger.
- **Acceptance criteria (from the proposal's DoD):**
  - `npm run dashboard` starts a local server.
  - `/` shows jobs-by-status + cost/token overview.
  - `/jobs/:id` shows a per-step pipeline timeline and plays the generated video.
  - `/tenants` shows tenants + policy + spend-vs-quota.
  - `/analytics` renders charts (cost over time, cost per capability, tokens per worker).
  - No writes to the Job Ledger; `pnpm run typecheck` + `pnpm run build` pass.

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

## 6. Cross-References

- **Dashboard blueprint:** [dashboard-proposal.md](./dashboard-proposal.md)
- **Decision record:** [post-mvp-options.md](./post-mvp-options.md)
- **Constitution entrypoints:** [start-here.md](../context/start-here.md), [contracts.md](../architecture/contracts.md)
- **Repo workflows:** the `fyi-studio-monorepo` Hermes skill
