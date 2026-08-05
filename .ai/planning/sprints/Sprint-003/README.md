---
title: "Sprint 3: Knowledge Layer + Memory Management (Milestone 4) - Sprint Planning"
version: "1.0"
source: "mvp-architecture.md (The Flattened Brain) / ADR-0007"
sprint: "Sprint-003"
status: "planned"
created: "2026-08-05"
tags: [sprint-planning, sprint-3, knowledge-layer, memory-management, tenant-context, context-assembly]
---

# Sprint 3 Planning: Knowledge Layer + Memory Management (Milestone 4)

**Goal:** Give every job the right *brand, language, and constraint context* before an AI worker runs. Build the Knowledge Layer (brand profiles, style guides, verified facts, asset libraries), the Memory Layer (historical performance, edits, audience analytics), and a Context Assembly Engine that extracts → retrieves → injects context into the `TaskEnvelope` — all policy-driven by tenant scope.

**Duration:** 1 Sprint (Milestone 4 spans Sprints 6–7; Sprint-003 covers the MVP scope).

**Primary Metric:** A real Research or Script worker receives a job whose `TaskEnvelope.context` is populated from the tenant's `tenant_context` (brand_voice, language, constraints) — verified by an E2E test.

---

## 1. Product Backlog (Sprint 3 / Milestone 4)

| ID | Task Name | Description | Priority |
| :--- | :--- | :--- | :--- |
| **M4.1** | **`tenant_context` schema + Prisma migration** | `brand_voice`, `language`, `forbidden_terms`, per-channel/tenant constraints — the "flattened brain" table | P0 |
| **M4.2** | **Knowledge Layer CRUD** | Brand profiles, style guides, verified facts, asset libraries in `@fyi/database` / a knowledge module | P0 |
| **M4.3** | **Memory Layer** | Historical performance, edits, audience analytics — MVP: simple tables + CRUD | P1 |
| **M4.4** | **Context Assembly Engine** | extract → retrieve → inject into `TaskEnvelope.context`; policy-driven tenant-scope filtering | P0 |
| **M4.5** | **Wire context injection into real workers + E2E** | Inject assembled context into `research:real` / `text-synthesis:script:real`; verify end-to-end | P0 |

---

## 2. Detailed Task Breakdown & Acceptance Criteria

### Task M4.1: `tenant_context` Schema + Prisma Migration
- **Description:** Extend the Prisma schema with the `tenant_context` table — the MVP "flattened brain" (per mvp-architecture.md §5). **No vector DB in the MVP.**
- **Acceptance Criteria:**
  - `tenant_context` table (tenant_id, channel_id, brand_voice JSONB, language, forbidden_terms JSONB/array, constraints per channel/tenant)
  - snake_case column naming per Engineering Standards v1.0
  - Migration runs against local Postgres; client regenerated
  - `@fyi/contracts` v1.1 remains **frozen** (no contract changes)
- **Dependencies:** S1.2 (`@fyi/database`)
- **Related Issue:** [Issue M4.1](./Issue-301.md)

### Task M4.2: Knowledge Layer CRUD
- **Description:** CRUD for structured knowledge — brand profiles, style guides, verified facts, asset libraries — so workers can consume brand context.
- **Acceptance Criteria:**
  - Models/tables for brand_profiles, style_guides, verified_facts, asset_libraries
  - CRUD operations (create/read/update/delete/list) per entity, tenant-scoped
  - Data modeled in `@fyi/database` / a knowledge module; no contract changes
- **Dependencies:** M4.1
- **Related Issue:** [Issue M4.2](./Issue-302.md)

### Task M4.3: Memory Layer
- **Description:** Historical context — past performance, prior edits, audience analytics — stored in simple MVP tables with CRUD.
- **Acceptance Criteria:**
  - Tables for historical_performance, edits/versions, audience_analytics
  - CRUD operations tenant-scoped
  - MVP: plain relational tables + CRUD (no analytics pipeline yet — that is Milestone 7)
- **Dependencies:** M4.1
- **Related Issue:** [Issue M4.3](./Issue-303.md)

### Task M4.4: Context Assembly Engine
- **Description:** Assemble the `TaskEnvelope.context` for a job: extract relevant knowledge + memory, retrieve from `tenant_context`, filter by tenant-scope policy, and inject.
- **Acceptance Criteria:**
  - Pipeline: extract → retrieve → inject → (prune/purge)
  - Output populates the `context` field of the `TaskEnvelope` (contracts v1.1 field)
  - Policy-driven filtering by tenant scope; only the tenant's own context is visible
  - Structured error if a tenant has no context (non-fatal — falls back to empty context)
- **Dependencies:** M4.1, M4.2, M4.3
- **Related Issue:** [Issue M4.4](./Issue-304.md)

### Task M4.5: Wire Context Injection + E2E
- **Description:** Hook the Context Assembly Engine into the real Research/Script workers and prove end-to-end that context reaches the model call.
- **Acceptance Criteria:**
  - `research:real` / `text-synthesis:script:real` receive `TaskEnvelope.context` populated by the engine
  - E2E test seeds a tenant with brand_voice/constraints → runs real (or mocked-model) pipeline → asserts context present in the envelope
  - No regression to M3 pipeline (research → script → COMPLETED)
- **Dependencies:** M4.4
- **Related Issue:** [Issue M4.5](./Issue-305.md)

---

## 3. Recommended Implementation Order (The "Critical Path")

1. **M4.1 (Schema)** — `tenant_context` table before any knowledge logic.
2. **M4.2 (Knowledge Layer CRUD)** — structured knowledge entities.
3. **M4.3 (Memory Layer)** — historical context tables (parallel-friendly with M4.2).
4. **M4.4 (Context Assembly Engine)** — the resolver that binds everything.
5. **M4.5 (Wire + E2E)** — integration into real workers + verification.

---

## 4. Definition of Done (DoD)

A task is "Done" when:
1. Code complies with Engineering Standards v1.0 (naming, logging, errors).
2. Component implements Contracts v1.1 (unchanged — contracts remain frozen).
3. Unit tests pass (if applicable).
4. Security: tenant isolation respected; no cross-tenant data leakage; no plaintext secrets.
5. Integration verified (CLI or E2E) for the touched surface.

---

## 5. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Cross-tenant context leakage** | High | Low | Mandatory tenant_id scope filter on every query; E2E isolation test |
| **Context bloat / prompt explosion** | Medium | Medium | Size/prune limits in the Assembly Engine; inject only relevant slices |
| **Outdated / stale memory fed to workers** | Medium | Medium | Version edits in Memory Layer; workers consume latest snapshot |
| **Scope creep into vector DB / analytics** | High | Medium | MVP locked to PostgreSQL `tenant_context` + simple tables; vector/analytics deferred |
| **Contract drift on `context` field** | Medium | Low | Contracts v1.1 frozen; engine maps into existing `context` field only |

---

## 6. Cross-References

- **Architecture:** [mvp-architecture.md](../../architecture/mvp-architecture.md) — §5 "The Knowledge Base (The Flattened Brain)"
- **Roadmap:** [roadmap.md](../../architecture/roadmap.md) — Milestone 4
- **Contracts:** [contracts.md](../../architecture/contracts.md) — `TaskEnvelope.context` field
- **Engineering Standards:** [engineering-standards.md](../../architecture/engineering-standards.md)
- **Prior sprint:** [Sprint-002/README.md](../Sprint-002/README.md) — AI Platform Foundation (M2)
