---
title: "Issue M7.5: Analytics E2E"
issue_id: "M7.5"
sprint: "Sprint-006"
source: "mvp-architecture.md (Analytics & Learning Loop)"
status: "done"
priority: "P0"
estimated_complexity: "L"
estimated_hours: 12
created: "2026-08-05"
tags: [analytics, e2e, integration, testing, learning-loop]
---

# Issue M7.5: Analytics E2E

## Goal

Prove the full analytics loop end-to-end: run a real job (research:real → script:real via Ollama Cloud, or a mock/light path), then assert the telemetry aggregates are correct (per tenant/capability/job), a `memory_entries` `performance` row was written, and `fyi analytics report` prints the expected summary.

## Scope

- A completed job produces correct telemetry aggregates (M7.1)
- A `memory_entries` `performance` row exists for the completed job (M7.3)
- `fyi analytics report` prints a summary matching the seeded/real telemetry (M7.4)
- E2E test in `tests/` (parallel with existing E2E suite)
- **NOT in scope:** external platform analytics ingestion (post-MVP), auto-optimization engine (post-MVP), A/B orchestration (post-MVP)

## Deliverables

- Analytics E2E test covering telemetry aggregation + memory enrichment + CLI report

## Acceptance Criteria

- [ ] A completed job produces correct telemetry aggregates (M7.1)
- [ ] A `memory_entries` `performance` row exists for the completed job (M7.3)
- [ ] `fyi analytics report` prints a summary matching the seeded/real telemetry (M7.4)
- [ ] `pnpm run typecheck` and `pnpm run build` pass; E2E passes

## Security

- Strict `tenant_id` scoping asserted by the E2E — no cross-tenant telemetry or memory leakage in the report/aggregates.

## Cross-References

- **Sprint:** [Sprint-006/README.md](../README.md)
- **Depends on:** [Issue M7.1](./Issue-601.md), [Issue M7.3](./Issue-603.md), [Issue M7.4](./Issue-604.md)
- **E2E suite:** [Issue S1.6](../../sprints/Sprint-001/Issue-006.md)
- **Memory Layer (M4):** [Issue M4.5](../../sprints/Sprint-003/Issue-305.md) — context injection / E2E pattern
