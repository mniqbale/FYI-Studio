---
id: ADR-0007-ai-platform-foundation
title: "Introduce AI Platform Foundation as Milestone 2 (BYOAI Layer)"
status: "Accepted"
date: "2026-08-04"
deciders: ["Founder", "Lead Engineer", "Principal Architect", "CTO"]
tags: [milestone, ai-platform, byoai, provider-registry, model-gate, architecture-review-05]
source_conversation: "Architecture Review Meeting #05"
---

# ADR-0007: Introduce AI Platform Foundation as Milestone 2 (BYOAI Layer)

## Context

During Architecture Review Meeting #05, the founder surfaced a critical product insight: **FYI Studio is evolving from an "AI Video Factory" into an "AI Orchestration Platform for Creative Production."** This requires a foundational layer that gives users control over their AI providers — the "Bring Your Own AI (BYOAI)" concept.

Two existing architecture documents described Milestone 2 differently:
- `contracts.md` / `implementation-strategy.md`: "The Cognitive Core" — integrate real AI providers, replace mock → real
- `roadmap.md`: "Knowledge Layer + Memory Management" — knowledge/memory layers, vector retrieval, context assembly

Both assumed AI providers were already available. However, users currently have no standardized way to:
- Connect their own AI providers
- Manage API Keys
- Choose models
- Define provider preferences
- Define capability routing
- Switch providers
- Manage health status, quotas, secrets

Without this foundation, every worker risks becoming tightly coupled to specific providers, violating **Axiom 2: Providers Are Completely Replaceable** (from `supervisor-design.md`).

## Decision

**Adopt a new Milestone 2: "AI Platform Foundation"** as the immediate next milestone after Milestone 1 (Skeleton Run).

This milestone establishes the AI infrastructure used by every future worker:
1. **Provider Registry** — OpenAI, Anthropic, Google/Gemini, OpenRouter, Groq, Ollama, Azure, Vertex, Together, etc.
2. **Connection Manager** — API Keys, Health Status, Quota, Secret Storage, Connection Validation
3. **Model Registry** — Provider, Model, Version, Pricing, Capabilities, Context Window, Status
4. **Capability Registry** — Reasoning, Vision, Image, Speech, Embedding, Video, Tool Calling, Search, Structured Output
5. **ModelGate v2** — Capability → Connected Providers → Available Models → Policy → Capability Match → Selected Model
6. **Default Provider Policies** — Per-worker recommended defaults with user override freedom (capability-gated)
7. **CLI Commands** — `fyi provider connect|list|disconnect|select`

The milestone sequence is now:
- **M1:** Skeleton Run (Complete)
- **M2:** AI Platform Foundation (BYOAI Layer)
- **M3:** Cognitive Core (Real AI Workers using ModelGate v2)
- **M4:** Knowledge Layer + Memory Management
- **M5:** Media Workers (Voice/Video/Subtitles)
- **M6:** Multi-Tenant Brand Management
- **M7:** Analytics & Learning Loop

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **Proceed with "Cognitive Core" as M2** | Workers would hardcode provider logic; no user control over API keys/models; violates Axiom 2; creates technical debt when provider switching becomes necessary |
| **Proceed with "Knowledge Layer" as M2** | Knowledge Layer needs real AI to extract/synthesize knowledge; putting it before provider infrastructure creates circular dependency |
| **Merge AI Platform into Cognitive Core** | BYOAI is a distinct, foundational concern; merging bloats worker implementation and couples provider management to worker logic |
| **Defer to post-MVP** | Every subsequent milestone depends on provider infrastructure; deferring pushes vendor lock-in deeper into the codebase |

## Consequences

### Easier
- **Multi-provider support** — Vendor swap without code changes (Axiom 2 fulfilled)
- **Per-user/brand model preference** — Multi-tenant readiness from day one
- **User agency over cost/quality** — Axiom 9 (Cost is a First-Class System Metric) enabled at infrastructure level
- **Clean separation** — Workers request capabilities; ModelGate resolves providers/models
- **Foundation for all future work** — M3–M7 all depend on this layer

### Harder / Risks
- **Security is primary risk** — API keys must never be committed, logged, or stored in plaintext. Requires secret manager (env vars for local MVP; encrypted vault for production). Strict policy: `.env`/keys stay git-ignored.
- **Scope creep** — The "menu" could balloon into full UI. Contained by scoping MVP to CLI commands only.
- **New failure mode** — "No connected provider supports capability X" must surface as structured `WorkerError` (non-retryable `PROVIDER_UNAVAILABLE`/`QUOTA_EXHAUSTED` semantics).
- **Model capability metadata maintenance** — Providers evolve; `model_policy.yaml` must be maintained as source of truth for capabilities.

## Implementation Notes

- Replaces/augments the static `CAPABILITY_POLICY` in `services/supervisor/src/config.ts` with a `ModelGate` backed by `model_policy.yaml` + provider-connection store.
- Provider connections persisted in PostgreSQL (new table `provider_connections` storing provider, provider_scope, key_ref, connected_at) with key material referenced (not stored) via secret manager.
- `model_policy.yaml` gains `capabilities` + per-provider `models[].supported_capabilities`.
- CLI additions (Milestone 2 Sprint 2): `fyi provider connect|list|disconnect|select`.
- Contracts v1.1 remain frozen; this ADR does not change `TaskEnvelope`/`WorkerResponse`.
- New ADR-0006 (User-Configurable Provider Connections) is a precursor; this ADR formalizes it as a full milestone.

## Architecture Impact on Existing ADRs

| ADR | Impact |
|-----|--------|
| **ADR-0001 (MVP Architecture)** | Roadmap updated; Milestone 2 redefined; Weeks 2–3 now cover AI Platform Foundation |
| **ADR-0002 (Contracts v1.1)** | No change — contracts frozen; `TaskEnvelope.policy` already supports provider/model resolution |
| **ADR-0003 (Reference Data Plane)** | No change |
| **ADR-0004 (Thin Orchestrator)** | ModelGate v2 remains a utility, not a service — preserves Thin Orchestrator pattern |
| **ADR-0005 (Engineering Standards)** | No change |
| **ADR-0006 (User-Configurable Provider Connections)** | Superseded/elevated to milestone-level decision; ADR-0006 remains as design detail reference |

## Related Documents Updated

- `.ai/architecture/roadmap.md` — New milestone structure
- `.ai/architecture/contracts.md` — Updated implementation strategy milestones
- `.ai/architecture/mvp-architecture.md` — Revised roadmap table
- `.ai/planning/implementation-strategy.md` — Projected milestone sequence
- `.ai/context/project-overview.md` — Development roadmap table
- `.ai/state/current-state.md` — Next milestone updated
- `.ai/architecture/supervisor-design.md` — Provider Registry, Capability Registry, ModelGate v2 added to V2 architecture diagram

---

**Approval:** Founder (Product Direction), Lead Engineer (Implementation Feasibility), Principal Architect (Architectural Integrity), CTO (Scalability & Vendor Independence)