---
title: "Issue M7.1: @fyi/analytics Aggregation Module"
issue_id: "M7.1"
sprint: "Sprint-006"
source: "mvp-architecture.md (Analytics & Learning Loop) / telemetry v1.1"
status: "done"
priority: "P0"
estimated_complexity: "M"
estimated_hours: 8
created: "2026-08-05"
tags: [analytics, aggregation, cost, tokens, duration, database, telemetry]
---

# Issue M7.1: `@fyi/analytics` Aggregation Module

## Goal

Create a new `@fyi/analytics` package containing the aggregation module — query the Job Ledger `telemetry` table (v1.1: `worker_id`, `provider`, `model`, `tokens_in`/`tokens_out`, `seconds`, `cost`, `duration_ms`, `started_at`, `finished_at`) and aggregate by tenant/capability/job into `cost`, `tokens`, `duration`, `count` summaries. This is the reusable read-core every downstream M7 task consumes.

## Scope

- New `@fyi/analytics` workspace package (mirroring `@fyi/knowledge`/`@fyi/platform` structure)
- `aggregateByTenant`, `aggregateByCapability`, `aggregateByJob` functions returning cost/tokens/duration/count
- Aggregation keyed by `tenant_id` (via `TaskEnvelope`/job) and `worker_capability`
- Deterministic handling of zero-row and null-cost telemetry
- Unit tests for per-tenant/capability/job aggregation + empty-input cases
- **NOT in scope:** unit economics / budget reporting (M7.2), memory enrichment (M7.3), CLI report (M7.4), E2E (M7.5)

## Deliverables

- `@fyi/analytics` package with the aggregation module
- Passing unit tests

## Acceptance Criteria

- [ ] `@fyi/analytics` package registered in the workspace (like `@fyi/knowledge`/`@fyi/platform`)
- [ ] `aggregateByTenant`, `aggregateByCapability`, `aggregateByJob` functions returning cost/tokens/duration/count
- [ ] Aggregates derive from telemetry rows keyed by `tenant_id` and `worker_capability`
- [ ] Aggregation is deterministic and handles zero-row / null-cost telemetry gracefully
- [ ] Unit tests cover per-tenant/capability/job aggregation + empty-input cases
- [ ] Contracts v1.1 remains frozen (no contract changes)

## Security

- Aggregations strictly scoped by `tenant_id` — no cross-tenant data exposure.
- No plaintext secrets in analytics data (telemetry fields only).

## Cross-References

- **Sprint:** [Sprint-006/README.md](../README.md)
- **Architecture:** [mvp-architecture.md](../../architecture/mvp-architecture.md) — §Analytics & Learning Loop
- **Contracts:** [contracts.md](../../architecture/contracts.md) — telemetry (v1.1)
- **Database:** [Issue S1.2](../../sprints/Sprint-001/Issue-002.md) — `@fyi/database` / Job Ledger
- **Tenant scoping pattern:** [Issue M6.1](../../sprints/Sprint-005/Issue-501.md) — `tenant_policies` / `tenant_id`
