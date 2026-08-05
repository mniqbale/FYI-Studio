---
title: "Sprint 6: Analytics & Cost Intelligence (Cost Intelligence + Memory enrichment + analytics CLI) (Milestone 7) - Sprint Planning"
version: "1.0"
source: "mvp-architecture.md (Analytics & Learning Loop) / telemetry v1.1 / M4 memory_entries / M6 tenant_policies cost_quota"
sprint: "Sprint-006"
status: "in-progress"
created: "2026-08-05"
tags: [sprint-planning, sprint-6, analytics, cost-intelligence, memory-enrichment, cli, learning-loop, budget]
---

# Sprint 6 Planning: Analytics & Cost Intelligence (Cost Intelligence + Memory enrichment + analytics CLI) (Milestone 7)

**Goal:** Close the MVP feedback loop by capturing, aggregating, and enriching cost/performance analytics from the Job Ledger `telemetry` table. Build the `@fyi/analytics` aggregation module, deliver **Cost Intelligence** (unit economics per video/channel/capability + budget enforcement building on the M6 `tenant_policies.cost_quota` spend tracking), enrich the M4 Memory Layer by writing a `memory_entries` row (kind: `performance`) on job completion, surface everything via a `fyi analytics report` CLI, and verify the whole loop with an analytics E2E test. **M7 is the final milestone for MVP — MVP completion is pending this sprint.**

**Duration:** 1 Sprint (Milestone 7 spans Sprints 14–16 in the original estimate; Sprint-006 covers the MVP scope — Cost Intelligence + Memory enrichment + analytics CLI).

**Primary Metric:** A completed job's telemetry aggregates (per tenant/capability/job) are queryable and correct, cost unit economics per video/channel/capability are reportable, a `memory_entries` `performance` row is written on completion, and `fyi analytics report` prints a correct per-tenant/capability/job summary — verified end-to-end.

> **MVP scope (per mvp-architecture.md):** Cost Intelligence (telemetry aggregation + unit economics + budget enforcement) + Memory enrichment (performance memory writes) + analytics CLI (`fyi analytics report`). External platform analytics ingestion (YouTube/TikTok/IG), the autonomous auto-optimization engine, and A/B test orchestration are **deferred** to post-MVP.

---

## 1. Product Backlog (Sprint 6 / Milestone 7)

| ID | Task Name | Description | Priority |
| :--- | :--- | :--- | :--- |
| **M7.1** | **`@fyi/analytics` aggregation module** | New `@fyi/analytics` package: aggregate telemetry per tenant/capability/job (cost, tokens, duration, count) — the reusable core | P0 |
| **M7.2** | **Cost Intelligence (unit economics + budget reporting)** | Unit economics per video/channel/capability (avg cost, tokens, duration) + budget reporting against `tenant_policies.cost_quota` | P0 |
| **M7.3** | **Memory enrichment (performance)** | On job completion, write a `memory_entries` row (kind: `performance`) capturing cost/duration/status — connects job results to the M4 Memory Layer | P0 |
| **M7.4** | **CLI `fyi analytics report`** | Per tenant/capability/job summary report command in `@fyi/cli` | P0 |
| **M7.5** | **Analytics E2E** | Run a job, verify telemetry aggregates + memory written + report output — end-to-end | P0 |

---

## 2. Detailed Task Breakdown & Acceptance Criteria

### Task M7.1: `@fyi/analytics` Aggregation Module
- **Description:** Create a new `@fyi/analytics` package containing the aggregation module — query the Job Ledger `telemetry` table (v1.1: worker_id, provider, model, tokens_in/out, seconds, cost, duration_ms, started_at, finished_at) and aggregate by tenant/capability/job into `cost`, `tokens`, `duration`, `count` summaries. This is the reusable read-core every downstream task uses.
- **Acceptance Criteria:**
  - `@fyi/analytics` package registered in the workspace (like `@fyi/knowledge`/`@fyi/platform`)
  - `aggregateByTenant`, `aggregateByCapability`, `aggregateByJob` functions returning cost/tokens/duration/count
  - Aggregates derive from telemetry rows keyed by `tenant_id` (via `TaskEnvelope`/job) and `worker_capability`
  - Aggregation is deterministic and handles zero-row / null-cost telemetry gracefully
  - Unit tests cover per-tenant/capability/job aggregation + empty-input cases
  - Contracts v1.1 remains **frozen** (no contract changes)
- **Dependencies:** S1.2 (`@fyi/database` / Job Ledger `telemetry`), M4 (`tenant_id` pattern)
- **Related Issue:** [Issue M7.1](./Issue-601.md)

### Task M7.2: Cost Intelligence (Unit Economics + Budget Reporting)
- **Description:** Build Cost Intelligence on top of the M7.1 aggregator — compute unit economics per video, per channel (tenant), and per capability (average cost, average tokens, average duration, per-video totals), and surface budget reporting against the M6 `tenant_policies.cost_quota` (sum spend vs quota). This complements the M6 dispatch-time quota *enforcement* with a *reporting* view.
- **Acceptance Criteria:**
  - Unit economics computed per video (job), per channel (tenant), per capability
  - Budget reporting: current spend vs `cost_quota` per tenant (remaining, % used, over/under)
  - Works with telemetry `cost` data aggregated in M7.1
  - No plaintext secrets; spend strictly scoped by `tenant_id`
  - Unit tests cover per-video/channel/capability unit economics + budget report
- **Dependencies:** M7.1, M6 (tenant_policies / Policy Engine spend)
- **Related Issue:** [Issue M7.2](./Issue-602.md)

### Task M7.3: Memory Enrichment (Performance)
- **Description:** On job completion, write a `memory_entries` row (kind: `performance`) capturing cost, duration, and status — connecting job results to the M4 Memory Layer so downstream learning/context assembly can consume real performance data. Hooked at the supervisor's job-completion path (single writer to job state per ADR-0004).
- **Acceptance Criteria:**
  - A `memory_entries` row (kind: `performance`) is written on job completion (cost, duration_ms, status, job_id, tenant_id)
  - Written exactly once (idempotent by `job_id`/`execution_id`); no duplicate rows on retry
  - Row is queryable via `@fyi/knowledge` memory APIs (M4)
  - Supervisor completion path is the single writer (ADR-0004 preserved)
  - Unit test: job completion writes one performance memory row; re-completion does not duplicate
- **Dependencies:** M4 (memory_entries), S1.4 (supervisor completion path)
- **Related Issue:** [Issue M7.3](./Issue-603.md)

### Task M7.4: CLI `fyi analytics report`
- **Description:** Add `fyi analytics report` to `@fyi/cli` — print a per tenant/capability/job summary from the M7.1/M7.2 aggregators (cost, tokens, duration, count; optional `--tenant`, `--capability`, `--job` filters; budget vs quota where applicable).
- **Acceptance Criteria:**
  - `fyi analytics report` prints aggregate summaries (per tenant/capability/job)
  - Supports optional `--tenant`, `--capability`, `--job` filters
  - Output is deterministic and human-readable (table), reuses M7.1/M7.2 functions
  - CLI follows existing `@fyi/cli` conventions (S1.5 / S2.5 / M6 pattern)
  - Smoke test: report prints correct numbers for a seeded telemetry set
- **Dependencies:** M7.1, M7.2
- **Related Issue:** [Issue M7.4](./Issue-604.md)

### Task M7.5: Analytics E2E
- **Description:** Prove the full analytics loop end-to-end: run a real job (research:real → script:real via Ollama Cloud, or a mock/light path), then assert the telemetry aggregates are correct (per tenant/capability/job), a `memory_entries` `performance` row was written, and `fyi analytics report` prints the expected summary.
- **Acceptance Criteria:**
  - A completed job produces correct telemetry aggregates (M7.1)
  - A `memory_entries` `performance` row exists for the completed job (M7.3)
  - `fyi analytics report` prints a summary matching the seeded/real telemetry (M7.4)
  - E2E passes; `pnpm run typecheck` and `pnpm run build` pass
- **Dependencies:** M7.1, M7.3, M7.4
- **Related Issue:** [Issue M7.5](./Issue-605.md)

---

## 3. Recommended Implementation Order (The "Critical Path")

1. **M7.1 (`@fyi/analytics` aggregation module)** — the read-core every downstream task uses.
2. **M7.2 (Cost Intelligence)** — unit economics + budget reporting on top of M7.1.
3. **M7.3 (Memory enrichment)** — write `performance` memory rows on job completion.
4. **M7.4 (CLI `fyi analytics report`)** — surface aggregates/reporting via the CLI.
5. **M7.5 (Analytics E2E)** — run a job, verify aggregates + memory + report end-to-end.

---

## 4. Definition of Done (DoD)

A task is "Done" when:
1. Code complies with Engineering Standards v1.0 (naming, logging, errors).
2. Component implements Contracts v1.1 (unchanged — contracts remain frozen).
3. Unit tests pass (if applicable).
4. Security: no plaintext secrets; analytics/memory/budget scoped strictly by `tenant_id`; no cross-tenant data leakage.
5. Integration verified (unit/E2E) for the touched surface — telemetry aggregates are correct, performance memory is written exactly once, and the report output matches real data.

---

## 5. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Cross-tenant analytics/memory leakage** | High | Low | Strict `tenant_id` scoping on every aggregation/memory write; E2E asserts isolation |
| **Incorrect telemetry aggregation** | Medium | Medium | Unit tests for per-tenant/capability/job aggregates; deterministic queries; handle null-cost/zero-row input |
| **Duplicate performance memory rows** | Medium | Medium | Idempotent write keyed by `job_id`/`execution_id`; supervisor is the single writer (ADR-0004) |
| **Cost data gaps / inaccurate unit economics** | Medium | Medium | Telemetry `cost` is the source; aggregation derives from v1.1 rows; refine precision post-MVP |
| **Budget reporting diverges from quota enforcement** | Medium | Medium | Both read the same spend source; M7.2 reporting and M6 enforcement share `tenant_policies.cost_quota` semantics |
| **Contract drift (analytics fields)** | Medium | Low | Contracts v1.1 frozen; analytics/memory are DB-only, never contract field changes |

---

## 6. Cross-References

- **Architecture:** [mvp-architecture.md](../../architecture/mvp-architecture.md) — §Analytics & Learning Loop / Cost Intelligence
- **Roadmap:** [roadmap.md](../../architecture/roadmap.md) — Milestone 7 (Analytics & Learning Loop), final for MVP
- **Contracts:** [contracts.md](../../architecture/contracts.md) — telemetry (worker_id, provider, model, tokens_in/out, seconds, cost, duration_ms, started_at, finished_at)
- **Engineering Standards:** [engineering-standards.md](../../architecture/engineering-standards.md)
- **Prior sprint:** [Sprint-005/README.md](../Sprint-005/README.md) — Multi-Tenant (M6, `tenant_policies.cost_quota`)
- **Memory Layer (M4):** [Sprint-003/README.md](../Sprint-003/README.md) — `memory_entries` (kind: performance/edit/analytics)
- **Supervisor (M1):** [Sprint-001/README.md](../Sprint-001/README.md) — single-writer job completion path (ADR-0004)
