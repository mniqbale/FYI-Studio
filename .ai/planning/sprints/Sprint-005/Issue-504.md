---
title: "Issue M6.4: Cost Quota Enforcement"
issue_id: "M6.4"
sprint: "Sprint-005"
source: "mvp-architecture.md (Multi-Tenancy) / telemetry.cost (v1.1)"
status: "done"
priority: "P0"
estimated_complexity: "M"
estimated_hours: 8
created: "2026-08-05"
tags: [multi-tenant, cost-quota, enforcement, budget, platform]
---

# Issue M6.4: Cost Quota Enforcement

## Goal

Enforce `cost_quota` — reject/limit a job when the tenant's budget is exceeded. For the MVP this is checked at dispatch / `ModelGate.resolve` against tracked spend (telemetry `cost`); a tenant over quota is refused with a structured, non-retryable error.

## Scope

- Track spend against `cost_quota` (sum of telemetry `cost` for the tenant)
- Evaluate quota at job dispatch / resolve time
- Over-quota tenant → structured `QUOTA_EXCEEDED`-style rejection (non-retryable)
- Tenant with no quota configured → unlimited (default scope), no regression
- Unit tests: over-quota rejected, under-quota admitted, no-quota admitted
- **NOT in scope:** real-time cost intelligence (deferred to M7), E2E (M6.5)

## Deliverables

- Quota enforcement in the Policy Engine / dispatch path
- Passing unit tests

## Acceptance Criteria

- [ ] Spend against `cost_quota` is tracked and evaluated at job dispatch
- [ ] Tenant over quota → structured `QUOTA_EXCEEDED`-style rejection (non-retryable), not silent failure
- [ ] Tenant at/under quota → job proceeds normally
- [ ] Tenant with no quota configured → unlimited (default scope), no regression
- [ ] Unit test: over-quota tenant rejected, under-quota admitted, no-quota admitted

## Security

- Quota lookups strictly scoped by `tenant_id`; no tenant can consume another's budget.
- No plaintext secrets in quota/tracking data.

## Cross-References

- **Sprint:** [Sprint-005/README.md](../README.md)
- **Depends on:** [Issue M6.2](./Issue-502.md)
- **Contracts:** [contracts.md](../../architecture/contracts.md) — telemetry `cost` (v1.1)
- **ADR:** [ADR-0004 (Thin Orchestrator)](../../adr/ADR-0004-thin-orchestrator.md)
- **Cost intelligence (post-MVP):** [roadmap.md](../../architecture/roadmap.md) — Milestone 7
