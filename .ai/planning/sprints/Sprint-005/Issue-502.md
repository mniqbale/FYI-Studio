---
title: "Issue M6.2: Policy Engine in @fyi/platform"
issue_id: "M6.2"
sprint: "Sprint-005"
source: "mvp-architecture.md (Multi-Tenancy) / ADR-0004 (utility-not-service)"
status: "done"
priority: "P0"
estimated_complexity: "M"
estimated_hours: 8
created: "2026-08-05"
tags: [multi-tenant, policy-engine, platform, tenant-registry, cost-quota]
---

# Issue M6.2: Policy Engine in `@fyi/platform`

## Goal

Build the Policy Engine as a utility in `@fyi/platform` (mirroring ModelGate's utility-not-service pattern per ADR-0004) that resolves a tenant's policy, checks the cost quota, and exposes the per-tenant model preference. No tenant policy present → return the global/`default` scope unchanged.

## Scope

- `resolveTenantPolicy(tenant_id)` — load the tenant's policy or fall back to `default` scope
- `checkCostQuota(tenant_id, cost)` — evaluate tracked spend vs `cost_quota` (admit vs reject)
- `getModelPreference(tenant_id)` — per-tenant model preference (or undefined → fallback)
- Unit tests for resolve / quota-check / preference fallback
- **NOT in scope:** ModelGate wiring (M6.3), dispatch-time enforcement (M6.4), E2E (M6.5)

## Deliverables

- Policy Engine utility in `@fyi/platform` (resolve, quota-check, preference)
- Passing unit tests

## Acceptance Criteria

- [ ] `resolveTenantPolicy(tenant_id)` returns the tenant's policy or a `default` scope fallback
- [ ] `checkCostQuota(tenant_id, cost)` evaluates spend vs `cost_quota` (admit vs reject)
- [ ] `getModelPreference(tenant_id)` returns the per-tenant model preference (or undefined → fallback)
- [ ] Handles disabled / missing policies gracefully (default scope)
- [ ] Unit tests cover resolve / quota-check / preference fallback

## Security

- Policy lookups strictly scoped by `tenant_id`; no cross-tenant reads.
- Disabled/missing policy never leaks another tenant's data — falls back to `default` only.

## Cross-References

- **Sprint:** [Sprint-005/README.md](../README.md)
- **Depends on:** [Issue M6.1](./Issue-501.md)
- **Architecture:** [mvp-architecture.md](../../architecture/mvp-architecture.md) — §Multi-Tenancy
- **ADR:** [ADR-0004 (Thin Orchestrator)](../../adr/ADR-0004-thin-orchestrator.md) — utility-not-service
- **ModelGate precedent:** [Issue S2.4](../../sprints/Sprint-002/Issue-204.md)
