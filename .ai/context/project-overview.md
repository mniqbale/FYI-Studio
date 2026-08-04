---
id: project-overview
title: "FYI Studio Project Overview"
owner: "Documentation Architect"
status: "active"
version: "1.0.0"
last_updated: "2026-08-04"
review_cycle: "per-sprint"
tags: [overview, summary, scope, mission]
related_documents:
  - "vision.md"
  - "goals.md"
  - "../architecture/system-architecture.md"
  - "../architecture/mvp-architecture.md"
  - "../planning/implementation-strategy.md"
---

# FYI Studio Project Overview

## Mission Statement

Build an **AI Operating System for Distributed Media Production** that enables deterministic, scalable, and cost-effective creation of video/audio content across hundreds of heterogeneous channels — without vendor lock-in, context bloat, or orchestration fragility.

---

## What Problem Does It Solve?

| Problem | Current State | FYI Studio Solution |
|---------|---------------|---------------------|
| **Agentic Chaos** | Autonomous agents in unconstrained loops → non-deterministic behavior, runaway costs, hallucination cascades | **Deterministic orchestration** over stochastic workers; every step tracked, retryable, auditable |
| **Vendor Lock-in** | Direct coupling to OpenAI/Anthropic/ElevenLabs APIs → broken on deprecation/price changes | **Capability-based abstraction**; swap providers via config, not code |
| **Context Bloat** | Monolithic conversation histories passed to every step → token costs compound, model focus dilutes | **Just-In-Time Context Assembly**; minimal envelope injected per step |
| **Scale Invalidation** | Single-channel systems collapse at 100+ channels with distinct brands/languages/niches | **Multi-tenant from Day 1**; tenant-aware schema, brand isolation policies |

---

## Core Concept (The "Operating System" Analogy)

```
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                        │
│         (YouTube Shorts, Documentaries, Podcasts)           │
├─────────────────────────────────────────────────────────────┤
│                   FYI STUDIO OS                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Workflow     │  │ Model Router │  │ Knowledge Layer  │  │
│  │ Engine       │  │              │  │                  │  │
│  ├──────────────┤  ├──────────────┤  ├──────────────────┤  │
│  │ Worker       │  │ Cost         │  │ Job Ledger       │  │
│  │ Registry     │  │ Intelligence │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                   CAPABILITY ADAPTERS                       │
│         (LLMs, Voice Synthesis, Renderers, Social APIs)     │
└─────────────────────────────────────────────────────────────┘
```

---

## Current Architecture: MVP v1.0 (Approved)

**Source:** [MVP Architecture](../architecture/mvp-architecture.md) — consensus from Founder, CTO, Principal Engineer, SRE.

### Key Components

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| **Supervisor (Thin Orchestrator)** | Node.js + BullMQ (Redis) | Job state machine, queue dispatching, context assembly |
| **Workers (Sidecar Pattern)** | FastAPI/Express in containers | Stateless adapters: `POST /execute` → `WorkerResponse` |
| **Job Ledger** | PostgreSQL (Prisma) | Source of truth: jobs, artifacts, status, recipes |
| **Telemetry** | PostgreSQL | Per-step cost, tokens, latency, provider |
| **Data Plane** | S3/R2 (local `/tmp` for MVP) | Binary assets via pointers only |
| **Model Config** | `model_policy.yaml` + `ModelGate` | Capability → Provider mapping |
| **Knowledge Base** | PostgreSQL `tenant_context` table | Brand voice, constraints per channel |

### What Was Explicitly Removed (from Microkernel V2)
- ❌ Worker Registry Service (→ static map)
- ❌ Model Router Service (→ YAML config)
- ❌ Plugin SDK (→ monorepo functions)
- ❌ Vector DB for Knowledge (→ Postgres table for MVP)
- ❌ Cost Intelligence Layer service (→ telemetry table)

---

## Development Roadmap

| Milestone | Focus | Timeline | Status |
|-----------|-------|----------|--------|
| **1: Skeleton Run** | Infra, Contracts, Mock Workers, Supervisor, CLI, E2E Test | Sprint 1 | **Complete** |
| **2: AI Platform Foundation** | Provider Registry, Connection Manager, Model Registry, Capability Registry, ModelGate v2 (BYOAI) | Sprints 2–3 | Planned |
| **3: Cognitive Core** | Research Worker (Real AI), Script Worker (Real AI) via ModelGate | Sprints 4–5 | Planned |
| **4: Knowledge Layer + Memory** | Brand Profiles, Vector Store, Context Assembly Engine | Sprints 6–7 | Planned |
| **5: Media Workers** | Voice (ElevenLabs), Video Composer (FFmpeg), Subtitles, Asset Library | Sprints 8–10 | Planned |
| **6: Multi-Tenant Brand Management** | Tenant Registry, Policy Engine, Worker Registry v2, A/B Testing, Dashboard | Sprints 11–13 | Planned |
| **7: Analytics & Learning Loop** | Analytics Workers, Memory Enrichment, Auto-Optimization, Cost Intelligence | Sprints 14–16 | Planned |

---

## Team & Roles (Constitutional Governance)

| Role | Responsibility | Decision Authority |
|------|----------------|-------------------|
| **Founder (CEO)** | Product direction, PMF, go-to-market | L2-L5 (Strategic) |
| **AI CTO** | Architecture, technical strategy, standards | L2-L5 (Technical) |
| **Human Architects** | L2-L5 decisions, ADR approval, cross-system design | L2-L5 |
| **AI Builders** | L1 implementation (code, tests, docs) | L1 |

**Governance Model:** Hybrid Human-AI teams. Human Architects own L2-L5 decisions. AI Builders execute L1 implementation with full autonomy within approved contracts/standards.

---

## Technology Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Language** | TypeScript (ESM) | Type-safe contracts, shared across Supervisor/Workers |
| **Runtime** | Node.js 20 LTS | Stable, native fetch, good TS support |
| **Database** | PostgreSQL 15+ | Relational + JSONB, RLS-ready, Supabase-compatible |
| **Queue** | BullMQ + Redis 7+ | Reliable, priority queues, retries, observability |
| **ORM** | Prisma | Type-safe DB access, migrations, JSONB support |
| **Monorepo** | pnpm workspaces | Fast, disk-efficient, native workspace support |
| **Contracts** | `@fyi/contracts` package | Single source of truth, compile-time validation |
| **Logging** | pino (JSON) | Structured, `job_id`/`execution_id` mandatory |
| **Testing** | Vitest + MSW | Fast, native ESM, HTTP mocking |
| **Lint/Format** | Biome | All-in-one, fast, strict |

---

## Repository Structure (Target)

```
fyi-studio/
├── .ai/                          # AI-Native Knowledge Base (THIS FOLDER)
│   ├── architecture/             # System design, contracts, standards
│   ├── planning/                 # Sprints, issues, strategy
│   ├── context/                  # Project overview, vision, glossary
│   ├── adr/                      # Architecture Decision Records
│   ├── memory/                   # Append-only project memory
│   ├── state/                    # Current state (per task)
│   └── handoff/                  # Session handoffs
├── packages/
│   ├── contracts/                # @fyi/contracts (v1.1 frozen)
│   ├── database/                 # @fyi/database (Prisma client)
│   ├── utils/                    # @fyi/utils (shared: redis, logging)
│   └── cli/                      # @fyi/cli (trigger-run, provider management)
├── services/
│   └── supervisor/               # Supervisor Kernel
├── workers/
│   ├── research/                 # Research Worker
│   ├── script/                   # Script Worker
│   ├── voice/                    # Voice Worker
│   ├── video/                    # Video Composer
│   ├── subtitle/                 # Subtitle Worker
│   └── asset/                    # Asset Library Worker
├── tests/
│   └── e2e/                      # E2E test suite
├── docker-compose.yml            # Local Postgres + Redis
├── package.json                  # Root workspace
└── turbo.json                    # Turborepo (future)
```

---

## Success Metrics (Definition of Done for Project)

| Metric | Target |
|--------|--------|
| **Time to First Completed Job (TFCJ)** | < 4 weeks (Sprint 1) |
| **Cost per Video (at scale)** | < $0.50 for short-form |
| **Orchestrator Availability** | 99.9% |
| **Worker Swap Time** | < 5 min (config change only) |
| **Channel Onboarding** | < 1 hour (tenant config only) |
| **Zero Vendor Lock-in** | All providers behind Capability interface |

---

## Cross-References

- [Vision (5-10 Year)](../context/vision.md)
- [MVP Architecture](../architecture/mvp-architecture.md)
- [Contracts v1.1](../architecture/contracts.md)
- [Engineering Standards](../architecture/engineering-standards.md)
- [Sprint 1 Plan](../planning/sprints/Sprint-001/README.md)
- [System Architecture V1](../architecture/system-architecture.md)
- [Microkernel Architecture V2](../architecture/microkernel-architecture.md)