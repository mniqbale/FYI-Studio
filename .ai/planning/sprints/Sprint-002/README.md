---
title: "Sprint 2: AI Platform Foundation (BYOAI) - Sprint Planning"
version: "1.0"
source: "Architecture Review Meeting #05 / ADR-0007"
sprint: "Sprint-002"
status: "planned"
created: "2026-08-04"
tags: [sprint-planning, sprint-2, ai-platform-foundation, byoai, provider, modelgate]
---

# Sprint 2 Planning: AI Platform Foundation (BYOAI Layer)

**Goal:** Establish the AI infrastructure foundation used by every future worker — Provider Registry, Connection Manager, Model Registry, Capability Registry, and ModelGate v2. This is the "Bring Your Own AI (BYOAI)" layer, per ADR-0007.

**Duration:** 1 Sprint (Milestone 2 spans Sprints 2–3)

**Primary Metric:** A user can connect a provider (API key), see available models for a capability, and have ModelGate v2 resolve a model for a worker — all via CLI.

---

## 1. Product Backlog (Sprint 2)

| ID | Task Name | Description | Priority |
| :--- | :--- | :--- | :--- |
| **S2.1** | **Database Layer** | Prisma schema: `provider_connections`, `model_registry`, `capability_registry` tables | P0 |
| **S2.2** | **Provider Registry + Connection Manager** | Provider catalog + API-key connection with secure (non-plaintext) key handling, validation | P0 |
| **S2.3** | **Model Registry + Capability Registry** | Model catalog (provider/model/version/pricing/capabilities/context window) + capability definitions | P0 |
| **S2.4** | **ModelGate v2** | Capability → connected providers → available models → policy → match → selected model | P0 |
| **S2.5** | **CLI** | `fyi provider connect\|list\|disconnect\|select` | P1 |

---

## 2. Detailed Task Breakdown & Acceptance Criteria

### Task S2.1: Database Layer
- **Description:** Extend Prisma schema with the three registries backing the AI Platform Foundation.
- **Acceptance Criteria:**
  - `provider_connections` table (provider, scope, key_ref, status, quota fields, connected_at)
  - `model_registry` table (provider, model, version, pricing, capabilities, context_window, status)
  - `capability_registry` table (name, description)
  - Migration runs against local Postgres; client regenerated
- **Dependencies:** S1.2 (@fyi/database)
- **Related Issue:** [Issue S2.1](./Issue-201.md)

### Task S2.2: Provider Registry + Connection Manager
- **Description:** Catalog of known providers + connect/disconnect flow with secure API key handling.
- **Acceptance Criteria:**
  - Provider catalog includes OpenAI, Anthropic, Gemini, OpenRouter, Groq, Ollama, Azure, Vertex, Together
  - `connect` validates the key (health check) before persisting; key material never stored/logged in plaintext
  - `list`/`disconnect` operations work
- **Dependencies:** S2.1
- **Related Issue:** [Issue S2.2](./Issue-202.md)

### Task S2.3: Model Registry + Capability Registry
- **Description:** Model catalog with capability metadata + capability definitions.
- **Acceptance Criteria:**
  - Models have provider, version, pricing, context window, status, supported capabilities
  - Capabilities follow the Capability Registry list (reasoning, vision, image, speech, embedding, video, tool calling, search, structured output)
  - Seeded via `model_policy.yaml` as source of truth
- **Dependencies:** S2.1, S2.2
- **Related Issue:** [Issue S2.3](./Issue-203.md)

### Task S2.4: ModelGate v2
- **Description:** The capability resolver. Workers ask for a capability; ModelGate resolves to a concrete provider/model.
- **Acceptance Criteria:**
  - Resolution: capability → connected providers → available models → policy → match → selected model
  - Only connected providers and capability-capable models are considered
  - "No connected provider supports capability X" surfaces a structured error (not silent fallback)
  - Default provider policies per worker with user override (capability-gated)
- **Dependencies:** S2.2, S2.3
- **Related Issue:** [Issue S2.4](./Issue-204.md)

### Task S2.5: CLI
- **Description:** `fyi provider connect|list|disconnect|select` in `@fyi/cli`.
- **Acceptance Criteria:**
  - Connect a provider with API key
  - List connected providers + available models
  - Disconnect a provider
  - Select a default model for a capability (capability-gated: incompatible models not shown/selectable)
- **Dependencies:** S2.2, S2.3, S2.4
- **Related Issue:** [Issue S2.5](./Issue-205.md)

---

## 3. Recommended Implementation Order (The "Critical Path")

1. **S2.1 (DB)** — Registries need tables before logic.
2. **S2.2 (Provider + Connection)** — Connections gate everything.
3. **S2.3 (Model + Capability)** — ModelGate needs model/capability data.
4. **S2.4 (ModelGate v2)** — Core resolver.
5. **S2.5 (CLI)** — User-facing surface.

---

## 4. Definition of Done (DoD)

A task is "Done" when:
1. Code complies with Engineering Standards v1.0 (naming, logging, errors).
2. Component implements Contracts v1.1 (unchanged — contracts remain frozen).
3. Unit tests pass (if applicable).
4. Security: no API key material committed, logged, or stored in plaintext.
5. Integration verified via CLI.

---

## 5. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **API key exposure** | High | Medium | Secret manager; key_ref only in DB; strict git-ignore; never log keys |
| **Model capability metadata drift** | Medium | Medium | `model_policy.yaml` as single source of truth, versioned |
| **"No provider" failure mode** | Medium | High | Structured non-retryable WorkerError (PROVIDER_UNAVAILABLE / QUOTA_EXHAUSTED) |
| **Scope creep into UI** | Medium | Medium | MVP limited to CLI only |

---

## 6. Cross-References

- **ADR:** [ADR-0007](../adr/ADR-0007-ai-platform-foundation.md), [ADR-0006](../adr/ADR-0006-user-configurable-provider-connection.md)
- **Roadmap:** [roadmap.md](../../architecture/roadmap.md) — Milestone 2
- **Change Log:** [CHANGELOG-ARM05.md](../../../CHANGELOG-ARM05.md)
- **Contracts:** [contracts.md](../../architecture/contracts.md)
- **Engineering Standards:** [engineering-standards.md](../../architecture/engineering-standards.md)
