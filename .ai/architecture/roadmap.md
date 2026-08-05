---
title: "FYI Studio Roadmap"
version: "1.1"
status: "active"
last_updated: "2026-08-05"
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

## Milestones (from Concept-1, updated per Architecture Review Meeting #05)

### Milestone 1: Skeleton Run
**Status:** Complete (Sprint 1)  
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

### Milestone 2: AI Platform Foundation
**Status:** Complete (Sprints 2–3)  
**Goal:** Establish the AI infrastructure foundation used by every future worker — Provider Registry, Connection Manager, Model Registry, Capability Registry, and ModelGate v2. This is the "Bring Your Own AI (BYOAI)" layer.

**Key Deliverables:**
- **Provider Registry:** OpenAI, Anthropic, Google/Gemini, OpenRouter, Groq, Ollama, Azure, Vertex, Together, etc.
- **Connection Manager:** API Keys, Health Status, Quota, Secret Storage, Connection Validation
- **Model Registry:** Provider, Model, Version, Pricing, Capabilities, Context Window, Status
- **Capability Registry:** Reasoning, Vision, Image, Speech, Embedding, Video, Tool Calling, Search, Structured Output
- **ModelGate v2:** Capability → Connected Providers → Available Models → Policy → Capability Match → Selected Model
- **Default Provider Policies:** Per-worker recommended defaults with user override freedom (capability-gated)
- **CLI Commands:** `fyi provider connect|list|disconnect|select`

**Architecture Impact:** This milestone was introduced per Architecture Review Meeting #05 (ADR-0007) to decouple provider management from worker implementation and prevent vendor lock-in at the infrastructure level.

---

### Milestone 3: The Cognitive Core (Real AI Workers)
**Status:** Complete (Sprints 4–5, implemented ahead of schedule)  
**Goal:** Replace mock workers with production-grade AI workers using the AI Platform Foundation from Milestone 2.

**Key Deliverables:**
- Research Worker: Perplexity / Gemini / OpenAI adapters via ModelGate v2
- Script Worker: OpenAI / Claude / Gemini adapters via ModelGate v2
- Workers call ModelGate for capability-based model resolution
- Real AI integration validated end-to-end

**Dependencies:** Milestone 2 (AI Platform Foundation)

---

### Milestone 4: Knowledge Layer + Memory Management
**Status:** Complete (Sprint 3)  
**Goal:** Implement the three-tier context assembly (Global Knowledge, Tenant Brand Memory, Project Memory) with Just-In-Time context injection and vector-based semantic retrieval.

**Key Deliverables:**
- Knowledge Layer with Brand Profiles, Style Guides, Verified Facts, Asset Libraries
- Memory Layer for historical performance, edits, and audience analytics
- Context Assembly Engine: extraction → retrieval → pruning → injection → purge
- Policy-driven context filtering by tenant scope
- **MVP scope (per mvp-architecture.md):** the "flattened brain" is a PostgreSQL `tenant_context` table — **NO vector DB** (Pinecone/Milvus deferred to post-MVP unless long-term memory is specifically required)

**Dependencies:** Milestone 3 (Cognitive Core provides real AI for knowledge extraction)

---

### Milestone 5: Media Workers (Voice / Video / Subtitles)
**Status:** Complete (Sprint 4)  
**Goal:** Add production-grade media generation capabilities using the AI Platform Foundation.

**Key Deliverables (MVP-scoped per mvp-architecture.md / ADR-0003):**
- Media Worker scaffolding + shared media output dir / reference helpers (no binary through the orchestrator — workers write media to local `/tmp` or S3 and return pointers only)
- Voice/TTS Worker: real offline TTS via `espeak-ng` (no quota) writing WAV/MP3, returns reference
- Subtitle Worker: SRT generation from script/narration, returns `.srt` reference
- Video Composer Worker: FFmpeg render (background + narration + subtitles) to MP4, returns reference
- Full pipeline `research → script → voice → subtitle → video` wired + E2E test
- **Deferred (post-MVP):** ElevenLabs/Azure/OpenAI TTS adapters, Whisper transcription, Asset Library B-roll, multi-format platform encoding profiles

---

### Milestone 6: Multi-Tenant Brand Management (100+ Channels)
**Status:** Complete (Sprint 5)  
**Goal:** Enable horizontal scaling to hundreds of heterogeneous channels with strict isolation.

**Key Deliverables (MVP-scoped per mvp-architecture.md / ADR-0003):**
- **Tenant Registry:** `tenant_policies` schema — per-tenant model preferences (JSON), cost quota, enabled flag (leveraging the `tenant_id` already in `TaskEnvelope` / `tenant_context` from M4)
- **Policy Engine (in `@fyi/platform`):** resolve a tenant's policy, check cost quota, enforce the per-tenant model preference
- **ModelGate integration:** tenant preference overrides the global default when set (falls back to global/default scope otherwise)
- **Cost quota enforcement:** reject/limit jobs when a tenant's budget is exceeded
- **Multi-tenant E2E:** two tenants with different policies produce isolated behavior
- **Deferred (post-MVP):** full A/B testing framework, dashboard UI, Worker Registry v2, publishing schedules

---

### Milestone 7: Analytics & Learning Loop (Auto-optimization)
**Status:** Complete (Sprint 6) — **MVP COMPLETE**  
**Goal:** Close the feedback loop — capture, aggregate, and enrich cost/performance analytics and drive MVP-level cost intelligence and learning-loop foundations. **MVP completion is pending this milestone.**

**Key Deliverables (MVP-scoped per mvp-architecture.md):**
- **Analytics aggregation module (`@fyi/analytics`):** aggregate telemetry per tenant/capability/job (cost, tokens, duration, count) from the Job Ledger `telemetry` table (v1.1: worker_id, provider, model, tokens_in/out, seconds, cost, duration_ms, started_at, finished_at)
- **Cost Intelligence:** unit economics per video, per channel, per capability — real-time budget enforcement (builds on the M6 `tenant_policies.cost_quota` spend tracking)
- **Memory enrichment:** on job completion, write a `memory_entries` row (kind: `performance`) capturing cost/duration/status — connecting job results to the M4 Memory Layer
- **Analytics CLI:** `fyi analytics report` — per tenant/capability/job summary
- **Analytics E2E:** run a job, verify telemetry aggregates + memory written + report output
- **Deferred (post-MVP):** external platform analytics ingestion (YouTube, TikTok, Instagram) with retention curves/engagement metrics, autonomous auto-optimization engine (recipe mutation — script pacing, thumbnail contrast, voice pitch — based on retention), A/B test orchestration (statistical significance gating, gradual rollout, automatic promotion)

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
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Provider   │  │   Capability │  │   HITL           │  │
│  │   Registry   │  │   Registry   │  │   Interrupt      │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
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
| **Provider Discovery** | Hardcoded | Provider Registry (connected providers) |
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

## Sprint Complexity Estimates (from Concept-11, updated for new milestone structure)

### Complexity Scale
| Label | Hours | Description |
|-------|-------|-------------|
| **XS** | 2 hours | Trivial, single-file changes, no dependencies |
| **S**  | 4 hours | Small, well-scoped, 1-2 files, clear acceptance criteria |
| **M**  | 8 hours | Medium, multi-file, requires integration, some design decisions |
| **L**  | 16 hours | Large, architectural, multiple components, significant risk |

---

### Sprint 1: The Skeleton Run (Milestone 1)

| Issue | Title | Complexity | Hours | Dependencies |
|-------|-------|------------|-------|--------------|
| **S1.1** | Workspace & Infrastructure Initialization | **S** | 4h | None |
| **S1.2** | Database Layer Implementation (The Ledger) | **S** | 4h | S1.1 |
| **S1.3** | Mock Worker Suite (Research, Script, Voice) | **M** | 8h | S1.1, S1.2 |
| **S1.4** | Supervisor Kernel (The Core) | **L** | 16h | S1.1, S1.2, S1.3 |
| **S1.5** | Skeleton Run CLI | **XS** | 2h | S1.1, S1.2, S1.4 |
| **S1.6** | End-to-End Test Suite | **S** | 4h | S1.1–S1.5 |

**Sprint 1 Total:** ~38 hours (6 issues: 2×S, 1×M, 1×L, 1×XS, 1×S)

---

### Projected Sprint Mapping (Updated per Architecture Review Meeting #05)

| Milestone | Projected Sprints | Est. Complexity |
|-----------|-------------------|-----------------|
| **M1: Skeleton Run** | Sprint 1 — ✅ **Complete** | 38h (completed as S1.1–S1.6) |
| **M2: AI Platform Foundation** | Sprints 2–3 — ✅ **Complete** | ~60–80h (completed as S2.1–S2.5) |
| **M3: Cognitive Core (Real AI Workers)** | Sprints 4–5 — ✅ **Complete** | ~80–100h (implemented ahead of schedule) |
| **M4: Knowledge Layer + Memory** | Sprints 6–7 — ✅ **Complete** | ~80–100h (completed as Sprint-003, MVP-scoped) |
| **M5: Media Workers** | Sprints 8–10 — ✅ **Complete** | ~100–140h (completed as Sprint-004, MVP-scoped via espeak-ng + FFmpeg) |
| **M6: Multi-Tenant (100+ Channels)** | Sprint 5 — ✅ **Complete** | ~40–60h (completed as Sprint-005, MVP-scoped to Tenant Registry + Policy Engine) |
| **M7: Analytics & Learning Loop** | Sprint 6 — ✅ **Complete** | ~40–60h (completed as Sprint-006, MVP-scoped to Cost Intelligence + Memory enrichment + analytics CLI) |

**Total Projected (M1–M7, MVP):** ~478–598 hours across ~11 sprints (M7 now MVP-scoped to Sprint 6, ~40–60h; the original ~140–180h across Sprints 14–16 estimate for the full auto-optimization scope is deferred to post-MVP)

---

## Cross-References

- **Architecture:** `.ai/architecture/architecture.md` — Microkernel design, Worker Registry, Model Router, Workflow Engine
- **Planning:** `.ai/architecture/planning.md` — Sprint breakdown, issue sequencing, dependency graph
- **Vision:** `.ai/context/vision.md` — 5-10 year strategic vision (Multi-Modal Plant, Autonomous Loop, Enterprise OS Standard)
- **ADR:** `.ai/adr/ADR-0007-ai-platform-foundation.md` — Milestone 2 restructuring decision