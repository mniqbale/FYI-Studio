---
id: start-here
title: "Start Here - FYI Studio Onboarding"
owner: "Documentation Architect"
status: "active"
version: "1.0.0"
last_updated: "2026-08-04"
review_cycle: "per-sprint"
tags: [onboarding, entry-point, ai-agent, human-engineer]
related_documents:
  - "project-overview.md"
  - "vision.md"
  - "../architecture/system-architecture.md"
  - "../architecture/contracts.md"
  - "../planning/implementation-strategy.md"
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

## 2. Current State: Sprint 1 — "The Skeleton Run"

**Milestone 1 Goal:** Execute a single media production job through three mock workers (Research → Script → Voice) orchestrated by the Supervisor.

**Status:** Architecture approved, contracts frozen (v1.1), engineering standards set, GitHub issues created.

**Next Implementation:** Issue S1.1 — Workspace & Infrastructure Initialization

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
| 12 | [../planning/implementation-strategy.md](../planning/implementation-strategy.md) | Milestone 1 execution plan |
| 13 | [../planning/sprints/Sprint-001/README.md](../planning/sprints/Sprint-001/README.md) | Sprint 1 task breakdown |
| 14 | [../planning/sprints/Sprint-001/Issue-001.md](../planning/sprints/Sprint-001/Issue-001.md) | **Your first task** |

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

**If you are an AI Coding Agent assigned to Sprint 1:**

1. Read [Issue S1.1: Workspace & Infrastructure Initialization](../planning/sprints/Sprint-001/Issue-001.md)
2. The deliverables are:
   - `/package.json` (root workspace config)
   - `/docker-compose.yml` (Postgres 15+, Redis 7+)
   - `/packages/contracts/package.json`
   - `/packages/contracts/src/index.ts` (Contracts v1.1 interfaces)
   - `/packages/contracts/tsconfig.json`
3. Acceptance criteria: `npm install` works, `docker-compose up -d` starts services, `npm run build -w @fyi/contracts` produces valid dist

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