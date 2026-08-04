---
title: "FYI Studio Roadmap"
version: "1.0"
status: "active"
last_updated: "2026-08-04"
source_documents:
  - "Concept-1.md (Section 14: Roadmap)"
  - "Concept-2.md (System Evolution: V1 vs V2)"
  - "Concept-11.md (Sprint Complexity Estimates)"
cross_references:
  - ".ai/architecture/architecture.md"
  - ".ai/architecture/planning.md"
  - ".ai/context/vision.md"
---

# FYI Studio Roadmap

## Milestones (from Concept-1)

### Milestone 1: Core Orchestrator + Job Queue + Simple Script Worker (Proof of Concept)
**Status:** In Progress (Sprint 1)  
**Goal:** Establish the foundational "Skeleton Run" — monorepo infrastructure, job ledger, mock workers, and supervisor kernel that can execute a minimal end-to-end pipeline.

**Key Deliverables:**
- NPM/PNPM workspace monorepo with `@fyi/contracts` as source of truth
- Docker Compose for Postgres 15+ and Redis 7+
- Prisma ORM schema for Jobs and Telemetry (JSONB artifact storage)
- Three stateless mock workers (Research, Script, Voice) using BullMQ
- Supervisor kernel with step resolver, context assembly, and DB state management
- CLI trigger for skeleton run with real-time status monitoring
- End-to-end test suite (Vitest) validating the full pipeline

**Related Issues:** S1.1 through S1.6

---

### Milestone 2: Knowledge Layer + Memory Management
**Status:** Planned  
**Goal:** Implement the three-tier context assembly (Global Knowledge, Tenant Brand Memory, Project Memory) with Just-In-Time context injection and vector-based semantic retrieval.

**Key Deliverables:**
- Knowledge Layer with Brand Profiles, Style Guides, Verified Facts, Asset Libraries
- Memory Layer for historical performance, edits, and audience analytics
- Context Assembly Engine: extraction → retrieval → pruning → injection → purge
- Vector store integration (Pinecone/Milvus) for semantic search
- Policy-driven context filtering by tenant scope

---

### Milestone 3: Media Workers (Voice / Video / Subtitles)
**Status:** Planned  
**Goal:** Replace mock workers with production-grade media generation capabilities.

**Key Deliverables:**
- Voice Worker: ElevenLabs / Azure TTS / OpenAI TTS adapters via Model Router
- Video Composer Worker: FFmpeg-based rendering, scene composition, overlay system
- Subtitle Worker: Whisper transcription, SRT/VTT generation, timing alignment
- Asset Library Worker: B-roll search, stock footage integration, thumbnail generation
- Multi-format export (MP4, WebM, MOV) with platform-specific encoding profiles

---

### Milestone 4: Multi-Tenant Brand Management (100+ Channels)
**Status:** Planned  
**Goal:** Enable horizontal scaling to hundreds of heterogeneous channels with strict isolation.

**Key Deliverables:**
- Tenant Registry: Channel configurations, brand voices, publishing schedules
- Policy Engine: Per-tenant cost quotas, quality thresholds, model preferences
- Worker Registry v2: Capability-based discovery with `manifest.json` versioning
- A/B testing framework for Production Recipes across tenant cohorts
- Dashboard: Multi-channel monitoring, cost attribution, performance comparison

---

### Milestone 5: Analytics & Learning Loop (Auto-optimization)
**Status:** Planned  
**Goal:** Close the feedback loop — autonomous hypothesis generation, recipe mutation, and A/B execution at scale.

**Key Deliverables:**
- Analytics Workers: Platform API ingestion (YouTube, TikTok, Instagram), retention curves, engagement metrics
- Memory Layer enrichment: Performance data → Knowledge Layer feedback
- Autonomous Optimization Engine: Recipe mutation (script pacing, thumbnail contrast, voice pitch) based on retention graphs
- A/B test orchestration: Statistical significance gating, gradual rollout, automatic promotion
- Cost Intelligence: Unit economics per video, per channel, per capability — real-time budget enforcement

---

## System Evolution: V1 → V2 (from Concept-2)

### V1: Linear Assembly Line
```
Trigger → Orchestrator → Research → Script → Voice → Video → Publish
```
- **Characteristics:** Sequential, hardcoded step order, single workflow template
- **Limitations:** No conditional logic, no capability discovery, direct worker-to-worker coupling, single model per task type, no cost intelligence, no human-in-the-loop

### V2: Central Intelligence Agency (Microkernel Architecture)
```
┌─────────────────────────────────────────────────────────────┐
│                    FYI STUDIO CORE (Microkernel)             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Context    │  │   Model      │  │   Workflow       │  │
│  │   Bus        │  │   Router     │  │   Engine (DAG)   │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Worker     │  │   Cost       │  │   Knowledge      │  │
│  │   Registry   │  │   Intelligence│  │   Layer          │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                          │
│  │   HITL       │  │   Job        │                          │
│  │   Interrupt  │  │   Ledger     │                          │
│  └──────────────┘  └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌───────────┐   ┌───────────┐   ┌───────────┐
       │ Worker A  │   │ Worker B  │   │ Worker N  │
       │(Capability│   │(Capability│   │(Capability│
       │  :type)   │   │  :type)   │   │  :type)   │
       └───────────┘   └───────────┘   └───────────┘
```

**Key V2 Capabilities:**
| Component | V1 | V2 |
|-----------|-----|-----|
| **Worker Discovery** | Hardcoded URLs | Capability-based Registry (`manifest.json`) |
| **Model Selection** | Direct API calls | Policy-driven Model Router (Intent Profiles) |
| **Workflow Definition** | Imperative code | Declarative DAG (YAML/JSON) as `ProductionRecipes` |
| **Extensibility** | Code changes | Plugin SDK (`FYI-Interface`: `init`, `execute`, `telemetry`) |
| **Cost Tracking** | Post-hoc estimates | Real-time unit costing, quota enforcement |
| **Human Integration** | Manual pauses | HITL as first-class "Special Worker" with `WAIT_FOR_SIGNAL` state |
| **Multi-tenancy** | Single config | Tenant-scoped Knowledge, Policies, Workers |

**Trade-offs & Risks (V2):**
1. **Complexity Overhead** — 5-6 internal hops before LLM call  
   *Mitigation:* High-performance gRPC / optimized Redis streams
2. **State Consistency** — Human approval latency (24h) may stale context  
   *Mitigation:* Context Refresh triggers in Workflow Engine
3. **Single Point of Failure** — Orchestrator failure stops all channels  
   *Mitigation:* Stateless Core, horizontal scaling, distributed state (PostgreSQL/Redis)

---

## Sprint Complexity Estimates (from Concept-11)

### Complexity Scale
| Label | Hours | Description |
|-------|-------|-------------|
| **XS** | 2 hours | Trivial, single-file changes, no dependencies |
| **S**  | 4 hours | Small, well-scoped, 1-2 files, clear acceptance criteria |
| **M**  | 8 hours | Medium, multi-file, requires integration, some design decisions |
| **L**  | 16 hours | Large, architectural, multiple components, significant risk |

---

### Sprint 1: The Skeleton Run

| Issue | Title | Complexity | Hours | Dependencies |
|-------|-------|------------|-------|--------------|
| **S1.1** | Workspace & Infrastructure Initialization | **S** | 4h | None |
| **S1.2** | Database Layer Implementation (The Ledger) | **S** | 4h | S1.1 |
| **S1.3** | Mock Worker Suite (Research, Script, Voice) | **M** | 8h | S1.1, S1.2 |
| **S1.4** | Supervisor Kernel (The Core) | **L** | 16h | S1.1, S1.2, S1.3 |
| **S1.5** | Skeleton Run CLI | **XS** | 2h | S1.1, S1.2, S1.4 |
| **S1.6** | End-to-End Test Suite | **S** | 4h | S1.1–S1.5 |

**Sprint 1 Total:** ~38 hours (5 issues: 2×S, 1×M, 1×L, 1×XS, 1×S)

---

## Milestone-to-Sprint Mapping (Projected)

| Milestone | Projected Sprints | Est. Complexity |
|-----------|-------------------|-----------------|
| **M1: Core Orchestrator (PoC)** | Sprint 1 | 38h (completed as S1.1–S1.6) |
| **M2: Knowledge Layer + Memory** | Sprints 2–3 | ~60–80h |
| **M3: Media Workers** | Sprints 4–6 | ~100–140h |
| **M4: Multi-Tenant (100+ Channels)** | Sprints 7–9 | ~120–160h |
| **M5: Analytics & Auto-Optimization** | Sprints 10–12 | ~140–180h |

**Total Projected (M1–M5):** ~450–590 hours across ~12 sprints

---

## Cross-References

- **Architecture:** `.ai/architecture/architecture.md` — Microkernel design, Worker Registry, Model Router, Workflow Engine
- **Planning:** `.ai/architecture/planning.md` — Sprint breakdown, issue sequencing, dependency graph
- **Vision:** `.ai/context/vision.md` — 5-10 year strategic vision (Multi-Modal Plant, Autonomous Loop, Enterprise OS Standard)