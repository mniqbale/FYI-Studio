# FYI Studio

**AI Operating System for Distributed Media Production**

---

## Quick Start

**New to this repository?** Start at [`.ai/context/start-here.md`](.ai/context/start-here.md) — it contains the mandatory reading order and onboarding path.

---

## What Is This?

FYI Studio is an **orchestration microkernel** that abstracts raw cognitive compute (LLMs), multi-modal generation engines (Voice, Image, Video), data stores, and distribution networks into a unified, deterministic runtime for media production.

It is **not** an application, wrapper, or automation script.

---

## Repository Structure

```
fyi-studio/
├── .ai/                          # AI-Native Knowledge Base (READ THIS FIRST)
│   ├── architecture/             # System design, contracts, standards
│   ├── planning/                 # Sprints, issues, implementation strategy
│   ├── context/                  # Project overview, vision, glossary, goals
│   ├── adr/                      # Architecture Decision Records (immutable)
│   ├── memory/                   # Append-only project memory
│   ├── state/                    # Current state (updated per task)
│   └── handoff/                  # Session handoffs
├── packages/                     # Monorepo packages (to be created in Sprint 1)
│   └── contracts/                # @fyi/contracts (v1.1 frozen)
├── services/                     # Supervisor, etc. (to be created)
├── workers/                      # Research, Script, Voice, etc. (to be created)
├── tests/                        # E2E test suite (to be created)
├── docker-compose.yml            # Local Postgres + Redis (to be created)
└── package.json                  # Root workspace (to be created)
```

---

## Current Status

| Metric | Value |
|--------|-------|
| **Current Milestone** | Milestone 1: Skeleton Run |
| **Current Sprint** | Sprint 1: The Skeleton Run |
| **Architecture** | MVP v1.0 (ADR-0001) |
| **Contracts** | v1.1 Frozen (ADR-0002) |
| **Standards** | v1.0 (ADR-0005) |
| **Next Task** | Issue S1.1: Workspace & Infra Initialization |

---

## Key Documents

| Purpose | Document |
|---------|----------|
| **Start Here (Mandatory)** | [`.ai/context/start-here.md`](.ai/context/start-here.md) |
| **Architecture Overview** | [`.ai/context/project-overview.md`](.ai/context/project-overview.md) |
| **Approved MVP Architecture** | [`.ai/architecture/mvp-architecture.md`](.ai/architecture/mvp-architecture.md) |
| **Frozen Contracts v1.1** | [`.ai/architecture/contracts.md`](.ai/architecture/contracts.md) |
| **Engineering Standards** | [`.ai/architecture/engineering-standards.md`](.ai/architecture/engineering-standards.md) |
| **Sprint 1 Plan** | [`.ai/planning/sprints/Sprint-001/README.md`](.ai/planning/sprints/Sprint-001/README.md) |
| **First Issue (S1.1)** | [`.ai/planning/sprints/Sprint-001/Issue-001.md`](.ai/planning/sprints/Sprint-001/Issue-001.md) |
| **All ADRs** | [`.ai/adr/`](.ai/adr/) |

---

## Governance

- **Constitution:** [`.ai/constitution.md`](.ai/constitution.md) (Concept-Constitution.md)
- **Documentation First** — No implementation without approved docs
- **Contracts Frozen** — v1.1 changes require ADR + all consumers rebuilt
- **ADR Required** — Every architecture change needs an ADR
- **Standards Mandatory** — PR Checklist enforced in CI

---

## For AI Agents

This `.ai/` folder **IS your context**. Read it like a codebase:
- Every document has YAML front matter for machine parsing
- Cross-references use relative paths from repository root
- `start-here.md` defines the mandatory reading order
- `current-state.md` shows real-time progress
- `handoff/` contains session continuity

---

## License

Proprietary — FYI Studio Project