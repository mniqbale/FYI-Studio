---
id: orchestration-delegation-brief
title: "Orchestration Delegation Brief — for External AI Agents"
owner: "Founder (orchestrator) + Lead Engineer"
status: "active"
version: "3.0.0"
last_updated: "2026-08-06"
review_cycle: "per-delegation"
tags: [delegation, orchestration, brief, settings, publish, analytics, ai-agent, knowledge-transfer]
related_documents:
  - "post-mvp-options.md"
  - "dashboard-stack-proposal.md"
  - "dashboard-architecture.md"
  - "settings-ai-workspace-stack-proposal.md"
  - "social-publish-stack-proposal.md"
  - "platform-analytics-stack-proposal.md"
  - "../architecture/settings-ai-workspace-architecture.md"
  - "../architecture/social-publish-architecture.md"
  - "../architecture/platform-analytics-architecture.md"
  - "../architecture/contracts.md"
  - "../architecture/mvp-architecture.md"
  - "../planning/sprints/Sprint-008/README.md"
  - "../planning/sprints/Sprint-009/README.md"
  - "../planning/sprints/Sprint-010/README.md"
  - "../adr/ADR-0008-social-publish-scheduling.md"
  - "../adr/ADR-0009-platform-analytics-ingestion.md"
  - "../adr/ADR-0010-hitl-revise-approve.md"
---

# Orchestration Delegation Brief

> **Purpose:** This document is a self-contained brief the **Founder (or any orchestrator) can hand to an external AI agent** to delegate a task — while ensuring the agent has enough context to work without the full session history, and that any knowledge it produces flows back into FYI Studio's constitution (`.ai/`).

---

## 1. How to Use This Brief (for the Orchestrator / Founder)

1. Pick a workstream from [post-mvp-options.md](./post-mvp-options.md). The current post-MVP workstreams are **Settings AI Workspace (Sprint 8)**, **Social Publish & Scheduling (Sprint 9)**, and **Platform Analytics & Revenue (Sprint 10)**.
2. Give the external agent THIS brief + the relevant proposals ([settings-ai-workspace-stack-proposal.md](./settings-ai-workspace-stack-proposal.md), [social-publish-stack-proposal.md](./social-publish-stack-proposal.md), [platform-analytics-stack-proposal.md](./platform-analytics-stack-proposal.md)) + the architecture docs ([settings-ai-workspace-architecture.md](../architecture/settings-ai-workspace-architecture.md), [social-publish-architecture.md](../architecture/social-publish-architecture.md), [platform-analytics-architecture.md](../architecture/platform-analytics-architecture.md)) + the repo's constitution entrypoints.
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
2. **Scope is fixed** — work only the delegated deliverable (currently one of the post-MVP workstreams: Settings AI Workspace per [settings-ai-workspace-architecture.md](../architecture/settings-ai-workspace-architecture.md) and Sprint 8 issues; or Social Publish per [social-publish-architecture.md](../architecture/social-publish-architecture.md) and Sprint 9; or Platform Analytics per [platform-analytics-architecture.md](../architecture/platform-analytics-architecture.md) and Sprint 10). Do NOT expand into other workstreams.
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
> 6. `.ai/planning/post-mvp-options.md` + the relevant workstream docs (decision + technical blueprint + stack rationale + architecture) — for the delegated workstream, read its stack proposal + architecture + ADR:
>    - **Settings AI Workspace:** `.ai/planning/settings-ai-workspace-stack-proposal.md` + `.ai/architecture/settings-ai-workspace-architecture.md` + `.ai/adr/ADR-0010-hitl-revise-approve.md`
>    - **Social Publish:** `.ai/planning/social-publish-stack-proposal.md` + `.ai/architecture/social-publish-architecture.md` + `.ai/adr/ADR-0008-social-publish-scheduling.md`
>    - **Platform Analytics:** `.ai/planning/platform-analytics-stack-proposal.md` + `.ai/architecture/platform-analytics-architecture.md` + `.ai/adr/ADR-0009-platform-analytics-ingestion.md`
> 7. `.ai/planning/sprints/Sprint-008/README.md` (Settings) + `Issue-801.md`..`Issue-805.md`; or `Sprint-009/README.md` + `Issue-901.md`..`Issue-905.md` (Publish); or `Sprint-010/README.md` + `Issue-1001.md`..`Issue-1005.md` (Analytics) — implementation plan
> 8. **THIS brief (Section 1a ROLES & ORCHESTRATION PROTOCOL)** — your role as Executor and the requirement to **return work to the Orchestrator/Lead Engineer** (do NOT merge/commit/push unless explicitly authorized)
> 9. The `fyi-studio-monorepo` skill (`skill_view name='fyi-studio-monorepo'`) for proven repo workflows
>
> **Your role:** You are the **Executor** of a scoped deliverable. You produce a candidate deliverable + any knowledge docs, return them per the output contract, and do NOT self-integrate into `main` unless authorized.
>
> **Environment facts:**
> - Working AI provider = Ollama Cloud (`OLLAMA_BASE_URL=https://ollama.com/v1`, model `deepseek-v4-flash`). Media = offline `espeak-ng` + `ffmpeg`. Cloud free tiers (OpenAI/Gemini/Anthropic) are credit-blocked.
> - Stack: TypeScript ESM, Node.js 20+, pnpm workspaces, PostgreSQL (Prisma) + Redis (BullMQ), Vitest, Biome.
> - Repo layout: `packages/{contracts,database,utils,ai,platform,knowledge,media,analytics,cli}`, `workers/{research,script,voice,mock,research-real,script-real,voice-real,subtitle-real,video-real,publish-real}`, `services/{supervisor,dashboard,settings,publish,analytics-ingest}`, `tests/`.
> - **Verify with:** `pnpm run typecheck` and `pnpm run build`. **Do not commit/push unless explicitly authorized.**
> - **Language:** write code/comments in English; the user communicates in Indonesian but code stays English.

---

## 3. Current Delegated Workstream

> **Note:** The Milestone 8 **Dashboard UI** (Sprint 7) is **COMPLETE**. The three post-MVP workstreams below are the active/next delegated workstreams (proposed, pending Founder approval). Each is self-contained; delegate one at a time.

### 3A. Settings AI Workspace (Sprint 8 / Milestone 9)

- **Source of truth for scope:** [settings-ai-workspace-architecture.md](../architecture/settings-ai-workspace-architecture.md) + [Sprint-008 README](../planning/sprints/Sprint-008/README.md) + Issues 801-805
- **Goal:** A web Settings surface to connect AI providers (Claude, Gemini, Ollama, ChatGPT) via UI, assign a model per worker/task via ModelGate + tenant `model_preferences`, and full CRUD for Brand/Tenant context + policy. **Folds in Dashboard polish (Workstream D):** readable artifacts + Download JSON, References/Bibliography, HITL Revise/Approve (ADR-0010).
- **Stack (as decided):** Fastify + server-rendered HTML + native forms + `@fyi/database` + `@fyi/platform` (Connection Manager, ModelGate, Policy Engine).
- **Key invariants:** all writes route via `@fyi/platform`; no raw arbitrary writes; HITL approve/revise is the deliberate write exception (ADR-0010) delegating to the Supervisor/StepRunner.
- **Acceptance criteria (from Sprint 8 DoD):** provider connect/disconnect; capability-gated model assignment; Brand/Tenant + policy full CRUD; readable artifacts + Download JSON (zip/individual); References section; Revise re-runs a step + Approve resumes a job; typecheck/build pass.

### 3B. Social Publish & Scheduling (Sprint 9 / Milestone 10)

- **Source of truth for scope:** [social-publish-architecture.md](../architecture/social-publish-architecture.md) + [Sprint-009 README](../planning/sprints/Sprint-009/README.md) + Issues 901-905
- **Goal:** Publish approved content to social platforms (YouTube Channel, Facebook, Instagram, TikTok) on schedule. **YouTube is the primary monetization target** (ADR-0008).
- **Stack (as decided):** BullMQ repeatable scheduler + `services/publish` + `workers/publish-real` + YouTube Data API v3 (`videos.insert`); new tables `social_accounts` + `scheduled_publishes`.
- **Key invariants:** publishing is always a background worker (never on Dashboard page load); uploads use file pointers (ADR-0003); YouTube quota shared with analytics (ADR-0009).
- **Acceptance criteria (from Sprint 9 DoD):** account registry CRUD; schedule a publish; scheduler fires; worker uploads (YouTube-first, mock or real); platform URL written back; no page-load platform API; typecheck/build pass.

### 3C. Platform Analytics & Revenue (Sprint 10 / Milestone 11)

- **Source of truth for scope:** [platform-analytics-architecture.md](../architecture/platform-analytics-architecture.md) + [Sprint-010 README](../planning/sprints/Sprint-010/README.md) + Issues 1001-1005
- **Goal:** Ingest content performance (views, likes, comments, watch time, **YouTube revenue per video**) into local tables under a hard YouTube API quota budget; feed the Memory Layer for future content.
- **Stack (as decided):** BullMQ repeatable/cron + `services/analytics-ingest` + YouTube Data API v3 + YouTube Analytics API; new tables `platform_metrics` + `video_revenue` + `analytics_ingestion_log`.
- **Key invariants:** **Dashboard NEVER calls a platform API on page load** (reads local tables only); joint quota ledger (10k units/day shared with uploads, 1,600/upload — ADR-0008/0009); idempotent ingestion; memory feedback.
- **Acceptance criteria (from Sprint 10 DoD):** ingestion worker upserts stats + revenue idempotently; quota ledger respected; memory feedback written; Dashboard platform views read local tables only; typecheck/build pass.

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

## 6. Sprint Implementation Details (for the Executor)

### 6A. Sprint 8 — Settings AI Workspace (Milestone 9)

| Issue | Task | Key Files to Create |
|-------|------|---------------------|
| **8.1** | Scaffold `services/settings` package | `services/settings/{package.json,tsconfig.json,.env.example,src/index.ts,src/routes/*.ts,src/templates/*.ts,src/client/*.ts,src/utils/*.ts,public/assets/style.css}` |
| **8.2** | Provider + Model Assignment UI | `src/routes/{providers,models}.ts`, `src/utils/platform.ts`, templates |
| **8.3** | Brand/Tenant Context + Policy CRUD | `src/routes/{tenants,policy}.ts`, templates |
| **8.4** | Dashboard polish (readable artifacts + References + Download JSON) | `services/dashboard/src/utils/artifacts.ts`, `templates/job-detail-partials/{artifacts,references}.ts`, `routes/jobs.ts` |
| **8.5** | HITL Revise/Approve (ADR-0010) | `services/supervisor/src/step-runner.ts` (reRunStep), `routes/jobs.ts` (approve/revise), `client/job-detail.ts` |

**Key patterns:** native HTML forms + Fastify POST (server-side validation); all writes route via `@fyi/platform`; HITL approve/revise delegates to Supervisor/StepRunner (supervisor stays sole writer to `jobs.status` — ADR-0004).

### 6B. Sprint 9 — Social Publish & Scheduling (Milestone 10)

| Issue | Task | Key Files to Create |
|-------|------|---------------------|
| **9.1** | Social Account + Schedule Schema | `packages/database/prisma/schema.prisma` (`social_accounts`, `scheduled_publishes`) + migration |
| **9.2** | Social Account Registry CRUD | `services/settings/src/routes/social-accounts.ts`, `utils/secret.ts` (token ref) |
| **9.3** | Publishing Worker + YouTube Adapter | `workers/publish-real/src/{index.ts,adapters/youtube.ts,adapters/types.ts,publish.ts}` |
| **9.4** | Scheduler + Scheduled-Publish Flow | `services/publish/src/{index.ts,scheduler.ts,handler.ts,utils/*}` |
| **9.5** | Publish E2E + Verification | `tests/e2e/publish.test.ts`, `adapters/youtube.mock.ts` |

**Key patterns:** BullMQ repeatable scheduler; uploads via file pointer (ADR-0003); YouTube `videos.insert` (1,600 units, ADR-0009); OAuth token ref in DB; result written back to `scheduled_publishes.platform_response` + `jobs.artifacts.published`.

### 6C. Sprint 10 — Platform Analytics & Revenue (Milestone 11)

| Issue | Task | Key Files to Create |
|-------|------|---------------------|
| **10.1** | Analytics Store Schema | `packages/database/prisma/schema.prisma` (`platform_metrics`, `video_revenue`, `analytics_ingestion_log`) + migration |
| **10.2** | YouTube Client + Quota Ledger | `services/analytics-ingest/src/{utils/youtube.ts,quota.ts}` |
| **10.3** | Ingestion Worker | `services/analytics-ingest/src/{scheduler.ts,ingest.ts,revenue.ts}` |
| **10.4** | Memory Feedback + Dashboard Views | `services/analytics-ingest/src/utils/memory.ts`, `services/dashboard/src/routes/platform.ts`, `templates/platform.ts` |
| **10.5** | Ingestion E2E + Quota Verification | `tests/e2e/analytics-ingest.test.ts`, `utils/youtube.mock.ts` |

**Key patterns:** BullMQ repeatable daily cycle; **Dashboard NEVER calls platform API on page load** (reads local tables only); joint quota ledger (10k units/day shared with uploads, 1,600/upload); idempotent upsert keyed by `video_id` + platform + snapshot/period; `memory_entries` kind: `analytics`.

### Commands to Run

```bash
# Install deps
pnpm install

# Typecheck
pnpm run typecheck

# Build
pnpm run build

# Run tests
pnpm test

# Settings (Sprint 8)
pnpm run settings:dev        # http://localhost:3002

# Publish (Sprint 9)
pnpm run publish:dev
pnpm run worker:publish-real

# Analytics ingest (Sprint 10)
pnpm run analytics-ingest:dev
```

---

## 7. Cross-References

- **Decision record:** [post-mvp-options.md](./post-mvp-options.md)
- **Settings blueprint + stack:** [settings-ai-workspace-architecture.md](../architecture/settings-ai-workspace-architecture.md) + [settings-ai-workspace-stack-proposal.md](./settings-ai-workspace-stack-proposal.md)
- **Publish blueprint + stack:** [social-publish-architecture.md](../architecture/social-publish-architecture.md) + [social-publish-stack-proposal.md](./social-publish-stack-proposal.md)
- **Analytics blueprint + stack:** [platform-analytics-architecture.md](../architecture/platform-analytics-architecture.md) + [platform-analytics-stack-proposal.md](./platform-analytics-stack-proposal.md)
- **Sprint plans:** [Sprint-008 README](../planning/sprints/Sprint-008/README.md) · [Sprint-009 README](../planning/sprints/Sprint-009/README.md) · [Sprint-010 README](../planning/sprints/Sprint-010/README.md)
- **ADRs:** [ADR-0008 (Publish)](../adr/ADR-0008-social-publish-scheduling.md) · [ADR-0009 (Analytics/quota)](../adr/ADR-0009-platform-analytics-ingestion.md) · [ADR-0010 (HITL write exception)](../adr/ADR-0010-hitl-revise-approve.md)
- **Constitution entrypoints:** [start-here.md](../context/start-here.md), [contracts.md](../architecture/contracts.md)
- **Repo workflows:** the `fyi-studio-monorepo` Hermes skill