---
title: "Issue M7.4: CLI fyi analytics report"
issue_id: "M7.4"
sprint: "Sprint-006"
source: "mvp-architecture.md (Analytics & Learning Loop) / M7.1 / M7.2"
status: "done"
priority: "P0"
estimated_complexity: "S"
estimated_hours: 4
created: "2026-08-05"
tags: [analytics, cli, report, cost-intelligence, command]
---

# Issue M7.4: CLI `fyi analytics report`

## Goal

Add `fyi analytics report` to `@fyi/cli` — print a per tenant/capability/job summary from the M7.1/M7.2 aggregators (cost, tokens, duration, count; optional `--tenant`, `--capability`, `--job` filters; budget vs quota where applicable).

## Scope

- `fyi analytics report` prints aggregate summaries (per tenant/capability/job)
- Optional `--tenant`, `--capability`, `--job` filters
- Deterministic, human-readable table output reusing M7.1/M7.2 functions
- Follows existing `@fyi/cli` conventions (S1.5 / S2.5 / M6 pattern)
- Smoke test: report prints correct numbers for a seeded telemetry set
- **NOT in scope:** aggregation (M7.1), cost intelligence internals (M7.2), memory enrichment (M7.3), E2E (M7.5)

## Deliverables

- `fyi analytics report` command in `@fyi/cli`
- Passing smoke test

## Acceptance Criteria

- [ ] `fyi analytics report` prints aggregate summaries (per tenant/capability/job)
- [ ] Supports optional `--tenant`, `--capability`, `--job` filters
- [ ] Output is deterministic and human-readable (table), reuses M7.1/M7.2 functions
- [ ] CLI follows existing `@fyi/cli` conventions (S1.5 / S2.5 / M6 pattern)
- [ ] Smoke test: report prints correct numbers for a seeded telemetry set

## Security

- Report output strictly scoped by `tenant_id`; filters never leak another tenant's data.
- No plaintext secrets in report output.

## Cross-References

- **Sprint:** [Sprint-006/README.md](../README.md)
- **Depends on:** [Issue M7.1](./Issue-601.md), [Issue M7.2](./Issue-602.md)
- **CLI pattern:** [Issue S1.5](../../sprints/Sprint-001/Issue-005.md), [Issue S2.5](../../sprints/Sprint-002/Issue-205.md)
- **Architecture:** [mvp-architecture.md](../../architecture/mvp-architecture.md) — §Analytics & Learning Loop
