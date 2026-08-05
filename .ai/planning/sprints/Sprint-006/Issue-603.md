---
title: "Issue M7.3: Memory Enrichment (Performance)"
issue_id: "M7.3"
sprint: "Sprint-006"
source: "mvp-architecture.md (Analytics & Learning Loop) / M4 memory_entries"
status: "done"
priority: "P0"
estimated_complexity: "M"
estimated_hours: 8
created: "2026-08-05"
tags: [analytics, memory-enrichment, memory-entries, performance, knowledge, supervisor]
---

# Issue M7.3: Memory Enrichment (Performance)

## Goal

On job completion, write a `memory_entries` row (kind: `performance`) capturing cost, duration, and status — connecting job results to the M4 Memory Layer so downstream learning/context assembly can consume real performance data. Hooked at the supervisor's job-completion path (single writer to job state per ADR-0004).

## Scope

- A `memory_entries` row (kind: `performance`) written on job completion (cost, duration_ms, status, job_id, tenant_id)
- Written exactly once (idempotent by `job_id`/`execution_id`); no duplicate rows on retry
- Queryable via `@fyi/knowledge` memory APIs (M4)
- Supervisor completion path is the single writer (ADR-0004 preserved)
- Unit test: job completion writes one performance memory row; re-completion does not duplicate
- **NOT in scope:** aggregation (M7.1), cost intelligence (M7.2), CLI report (M7.4), E2E (M7.5)

## Deliverables

- Memory enrichment on the supervisor job-completion path
- Passing unit test

## Acceptance Criteria

- [ ] A `memory_entries` row (kind: `performance`) is written on job completion (cost, duration_ms, status, job_id, tenant_id)
- [ ] Written exactly once (idempotent by `job_id`/`execution_id`); no duplicate rows on retry
- [ ] Row is queryable via `@fyi/knowledge` memory APIs (M4)
- [ ] Supervisor completion path is the single writer (ADR-0004 preserved)
- [ ] Unit test: job completion writes one performance memory row; re-completion does not duplicate

## Security

- Memory rows strictly scoped by `tenant_id`; no cross-tenant performance data exposure.
- No plaintext secrets in performance memory entries.

## Cross-References

- **Sprint:** [Sprint-006/README.md](../README.md)
- **Memory Layer (M4):** [Issue M4.3](../../sprints/Sprint-003/Issue-303.md) — `memory_entries` (kind: performance/edit/analytics)
- **Supervisor (M1):** [Issue S1.4](../../sprints/Sprint-001/Issue-004.md) — single-writer job completion path
- **ADR:** [ADR-0004 (Thin Orchestrator)](../../adr/ADR-0004-thin-orchestrator.md) — supervisor as sole writer to job state
