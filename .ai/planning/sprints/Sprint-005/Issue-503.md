---
title: "Issue M6.3: Wire Tenant Policy into ModelGate.resolve"
issue_id: "M6.3"
sprint: "Sprint-005"
source: "mvp-architecture.md (Multi-Tenancy) / M2 ModelGate v2"
status: "done"
priority: "P0"
estimated_complexity: "M"
estimated_hours: 8
created: "2026-08-05"
tags: [multi-tenant, modelgate, model-preference, isolation, platform]
---

# Issue M6.3: Wire Tenant Policy into `ModelGate.resolve`

## Goal

Extend `ModelGate.resolve(capability, ...)` so a tenant's **model preference** overrides the global `default` scope when set, and otherwise falls back to the existing M3 default-scope resolution. This is the key isolation point: tenant A can prefer `deepseek-v4-flash` while tenant B prefers a different model, without touching the global policy.

## Scope

- `ModelGate.resolve` accepts the tenant's resolved policy / preference
- Tenant preference overrides global default when set
- Disabled tenant → default scope (no stale preference leakage)
- **NOT in scope:** quota enforcement (M6.4), E2E (M6.5)

## Deliverables

- ModelGate integration honoring per-tenant model preference with default fallback
- Regression-safe (existing ModelGate tests still pass)

## Acceptance Criteria

- [ ] Tenant with `model_preferences` set resolves to the tenant's preferred model/capability
- [ ] Tenant without an explicit preference falls back to the global `default` scope (M3 behavior unchanged)
- [ ] Disabled tenant → default scope (no leakage of a stale tenant preference)
- [ ] Existing ModelGate unit tests still pass (no regression)
- [ ] `pnpm run typecheck` and `pnpm run build` pass

## Security

- Tenant preference lookup strictly scoped by `tenant_id`; default-scope fallback never reads a specific tenant's policy.
- Disabled/missing tenant never inherits another tenant's preference.

## Cross-References

- **Sprint:** [Sprint-005/README.md](../README.md)
- **Depends on:** [Issue M6.2](./Issue-502.md), [Issue S2.4](../../sprints/Sprint-002/Issue-204.md) (ModelGate v2)
- **Architecture:** [mvp-architecture.md](../../architecture/mvp-architecture.md) — §Multi-Tenancy
- **M3 behavior:** [Sprint-004/README.md](../Sprint-004/README.md) / model_policy `default` scope
