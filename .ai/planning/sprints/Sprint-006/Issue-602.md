---
title: "Issue M7.2: Cost Intelligence (Unit Economics + Budget Reporting)"
issue_id: "M7.2"
sprint: "Sprint-006"
source: "mvp-architecture.md (Cost Intelligence) / telemetry cost v1.1 / M6 tenant_policies.cost_quota"
status: "done"
priority: "P0"
estimated_complexity: "M"
estimated_hours: 8
created: "2026-08-05"
tags: [analytics, cost-intelligence, unit-economics, budget, cost-quota, reporting]
---

# Issue M7.2: Cost Intelligence (Unit Economics + Budget Reporting)

## Goal

Build Cost Intelligence on top of the M7.1 aggregator — compute unit economics per video, per channel (tenant), and per capability (average cost, average tokens, average duration, per-video totals), and surface budget reporting against the M6 `tenant_policies.cost_quota` (sum spend vs quota). This complements the M6 dispatch-time quota *enforcement* with a *reporting* view.

## Scope

- Unit economics per video (job), per channel (tenant), per capability
- Budget reporting: current spend vs `cost_quota` per tenant (remaining, % used, over/under)
- Derived from telemetry `cost` aggregated in M7.1
- **NOT in scope:** aggregation primitives (M7.1), memory enrichment (M7.3), CLI report (M7.4), E2E (M7.5)

## Deliverables

- Cost Intelligence functions in `@fyi/analytics` (unit economics + budget report)
- Passing unit tests

## Acceptance Criteria

- [ ] Unit economics computed per video (job), per channel (tenant), per capability
- [ ] Budget reporting: current spend vs `cost_quota` per tenant (remaining, % used, over/under)
- [ ] Works with telemetry `cost` data aggregated in M7.1
- [ ] No plaintext secrets; spend strictly scoped by `tenant_id`
- [ ] Unit tests cover per-video/channel/capability unit economics + budget report

## Security

- Spend/unit-economics lookups strictly scoped by `tenant_id`; no tenant sees another's economics.
- No plaintext secrets in cost/budget data.

## Cross-References

- **Sprint:** [Sprint-006/README.md](../README.md)
- **Depends on:** [Issue M7.1](./Issue-601.md)
- **Architecture:** [mvp-architecture.md](../../architecture/mvp-architecture.md) — §Cost Intelligence
- **M6 quota:** [Issue M6.1](../../sprints/Sprint-005/Issue-501.md), [Issue M6.4](../../sprints/Sprint-005/Issue-504.md) — `tenant_policies.cost_quota`
- **Contracts:** [contracts.md](../../architecture/contracts.md) — telemetry `cost` (v1.1)
