---
id: start-here
title: "Start Here - FYI Studio Onboarding"
owner: "Documentation Architect"
status: "active"
version: "1.0.0"
last_updated: "2026-08-05"
review_cycle: "per-sprint"
tags: [onboarding, entry-point, ai-agent, human-engineer]
related_documents:
  - "project-overview.md"
  - "vision.md"
  - "../architecture/system-architecture.md"
  - "../architecture/contracts.md"
  - "../planning/implementation-strategy.md"
  - "../planning/sprints/Sprint-003/README.md"
---

# Start Here: FYI Studio Onboarding Guide

> **For AI Agents and Human Engineers**
>
> This is the canonical entry point. Read this document completely before exploring other documentation.

---

## 1. What Is FYI Studio?

**FYI Studio is an AI Operating System for Distributed Media Production.**

It is **not** an application, wrapper, or automation script. It is an **orchestration microkernel** that abstracts:
- Raw cognitive compute (LLMs: OpenAI, Anthropic, Google, local models)
- Multi-modal generation engines (Voice, Image, Video)
- Data stores (PostgreSQL, S3/R2, Vector DBs)
- Distribution networks (YouTube, TikTok, etc.)

Into a **unified, deterministic runtime**.

**Analogy:** Just as a computer OS manages hardware primitives (CPU, RAM, Disk) to execute software without exposing hardware mechanics, FYI Studio manages creative intelligence primitives to execute content creation pipelines without coupling production logic to specific AI vendors or execution models.

---

## 2. Current State: Milestones 1–3 Complete — Milestone 4 Next

**Milestones 1–3 are COMPLETE.** The Skeleton Run (M1), AI Platform Foundation / BYOAI (M2), and Cognitive Core (M3) are all shipped and verified end-to-end.

**Milestone 1 (Skeleton Run):** Monorepo infra, Postgres+Redis docker-compose, `@fyi/contracts` v1.1, `@fyi/database`, 3 mock workers, supervisor kernel, CLI trigger, E2E tests. *(Sprint-001, issues S1.1–S1.6)*

**Milestone 2 (AI Platform Foundation / BYOAI):** `@fyi/platform` with provider_connections + model_registry + capability_registry tables, Provider Registry (9 providers), Connection Manager (API keys via env, key_ref only in DB), Model Registry + Capability Registry seeded from `model_policy.yaml`, ModelGate v2, CLI `npm run fyi provider connect|list|disconnect|select`. *(Sprint-002, issues S2.1–S2.5)*

**Milestone 3 (Cognitive Core / real AI):** `@fyi/ai` provider adapters via fetch (openai/anthropic/gemini/ollama), real Research worker (`research:real`), real Script worker (`text-synthesis:script:real`), supervisor wiring. Real pipeline verified end-to-end via **Ollama Cloud** (`OLLAMA_BASE_URL=https://ollama.com/v1`, model `deepseek-v4-flash`): `research:real → script:real → COMPLETED` with real research sources + video script. *(Sprint-002 work, completed ahead of schedule)*

> **Provider note:** Cloud free tiers (OpenAI/Gemini/Anthropic) are credit-blocked; **Ollama Cloud is the working free provider**. `model_policy.yaml` defaults for `research:real` and `text-synthesis:script:real` point at `provider: ollama`, `model: deepseek-v4-flash`.

**Current Sprint:** Sprint-003 — **Milestone 4: Knowledge Layer + Memory Management.**

**Next Implementation:** Issue M4.1 — `tenant_context` schema + Prisma migration. See [Sprint-003/README.md](../planning/sprints/Sprint-003/README.md).

---

## 3. Required Reading Order (Mandatory)

Per the AI Constitution, you **must** read in this order before any implementation:

| Order | Document | Purpose |
|-------|----------|---------|
| 1 | [project-overview.md](./project-overview.md) | High-level project summary |
| 2 | [vision.md](./vision.md) | 5-10 year direction |
| 3 | [glossary.md](./glossary.md) | Canonical term definitions |
| 4 | [../architecture/system-architecture.md](../architecture/system-architecture.md) | V1 Hub-and-Spoke architecture |
| 5 | [../architecture/microkernel-architecture.md](../architecture/microkernel-architecture.md) | V2 Microkernel evolution |
| 6 | [../architecture/mvp-architecture.md](../architecture/mvp-architecture.md) | **Current approved MVP architecture** |
| 7 | [../architecture/architecture-manifesto.md](../architecture/architecture-manifesto.md) | Governing invariants & axioms |
| 8 | [../architecture/contracts.md](../architecture/contracts.md) | **Frozen v1.1 contracts** (TaskEnvelope, WorkerResponse, Job Ledger) |
| 9 | [../architecture/engineering-standards.md](../architecture/engineering-standards.md) | Mandatory coding standards |
| 10 | [../architecture/supervisor-design.md](../architecture/supervisor-design.md) | Supervisor logic & MVP implementation |
| 11 | [../architecture/roadmap.md](../architecture/roadmap.md) | Milestones 1-5 |
| 12 | [../planning/implementation-strategy.md](../planning/implementation-strategy.md) | Execution plan (M1–M7 milestone sequence) |
| 13 | [../planning/sprints/Sprint-003/README.md](../planning/sprints/Sprint-003/README.md) | **Current sprint (Sprint-003)** task breakdown — Milestone 4 |
| 14 | [../planning/sprints/Sprint-003/Issue-301.md](../planning/sprints/Sprint-003/Issue-301.md) | **Your first task** (M4.1 `tenant_context` schema) |

> Reading order note: Sprint-001 (M1) and Sprint-002 (M2) plans are archived for reference; the **current sprint is Sprint-003** (Milestone 4).

---

## 4. Key Architectural Decisions (Frozen)

| Decision | Status | Reference |
|----------|--------|-----------|
| **Hub-and-Spoke Orchestrator** with stateless workers | Approved V1 | system-architecture.md |
| **Microkernel V2** (Registry, Router, SDK) | Designed, **NOT in MVP** | microkernel-architecture.md |
| **Thin Orchestrator + BullMQ + PostgreSQL** | **Approved MVP** | mvp-architecture.md |
| **Reference-based data plane** (S3 pointers, no binary in bus) | **Approved MVP** | mvp-architecture.md |
| **model_policy.yaml** instead of Model Router service | **Approved MVP** | mvp-architecture.md |
| **Contracts v1.1** (strict enums, execution_id, attempt, separated usage/performance) | **Frozen** | contracts.md |
| **Engineering Standards v1.0** (snake_case JSON, structured errors, idempotency, PR checklist) | **Mandatory** | engineering-standards.md |

---

## 5. Your First Task

**If you are an AI Coding Agent assigned to the current sprint (Sprint-003 / Milestone 4):**

1. Read [Issue M4.1: `tenant_context` schema + Prisma migration](../planning/sprints/Sprint-003/Issue-301.md)
2. The deliverables are:
   - `tenant_context` table in `packages/database/prisma/schema.prisma` (brand_voice, language, forbidden_terms, constraints per channel/tenant)
   - Prisma migration + regenerated client
   - `@fyi/contracts` remains frozen (v1.1) — Knowledge Layer types live in `@fyi/database` / a knowledge module
3. Acceptance criteria: migration runs against local Postgres, client regenerated, snake_case per Engineering Standards v1.0

**Previous milestones' tasks are complete** — see Sprint-001 (M1) and Sprint-002 (M2) plans for archived details.

---

## 6. How This Repository Works

### For AI Agents
- This `.ai/` folder IS your context. Read it like you would read a codebase.
- Every document has YAML front matter for machine parsing.
- Cross-references use relative paths from repository root.

### For Human Engineers
- Documentation is in `.ai/` following the structure in `prompt.md`
- Architecture decisions → ADRs in `.ai/adr/`
- Sprint plans → `.ai/planning/sprints/`
- Contracts → `.ai/architecture/contracts.md`
- Current state → `.ai/state/current-state.md` (updated after every task)

---

## 7. Critical Rules (from Constitution)

| Rule | Enforcement |
|------|-------------|
| **Documentation First, Code Second** | No implementation without approved docs |
| **Every decision traceable** | ADR required for architecture changes |
| **Contracts are frozen** | v1.1 changes require ADR + all consumers rebuilt |
| **Workers are stateless adapters** | No persistent state in workers |
| **No binary data through Orchestrator** | S3/R2 pointers only |
| **Structured logging mandatory** | Every log line: job_id + execution_id |

---

## 8. Quick Reference: File Structure

```
.fyi-studio/
├── .ai/
│   ├── architecture/          # System design, contracts, standards
│   ├── planning/              # Sprints, issues, implementation strategy
│   ├── context/               # This folder - project context
│   ├── adr/                   # Architecture Decision Records
│   ├── memory/                # Project memory (append-only)
│   ├── state/                 # Current state (updated per task)
│   └── handoff/               # Session handoffs
├── packages/                  # Monorepo packages (to be created)
│   └── contracts/             # @fyi/contracts (first)
├── services/                  # Supervisor, etc. (to be created)
├── workers/                   # Research, Script, Voice (to be created)
└── docker-compose.yml         # Local infra (to be created)
```

---

## 9. Questions? Blockers?

- **Architecture unclear?** → Re-read `architecture-manifesto.md` (axioms/tenets)
- **Contract fields unclear?** → `contracts.md` has full TypeScript + change log v1.0→v1.1
- **Standards violation?** → `engineering-standards.md` has PR checklist
- **Task scope unclear?** → Sprint issue has acceptance criteria + DoD

**Do not assume. If unclear, stop and ask.**

---

*Welcome to FYI Studio. Build boring, predictable, scalable systems.*