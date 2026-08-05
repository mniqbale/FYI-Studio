---
title: "Issue M6.5: Multi-Tenant E2E"
issue_id: "M6.5"
sprint: "Sprint-005"
source: "mvp-architecture.md (Multi-Tenancy)"
status: "done"
priority: "P0"
estimated_complexity: "L"
estimated_hours: 12
created: "2026-08-05"
tags: [multi-tenant, e2e, isolation, integration, testing]
---

# Issue M6.5: Multi-Tenant E2E

## Goal

Prove isolation end-to-end: seed two tenants with different `tenant_policies` (different `model_preferences`, and one over quota), run a job for each, and assert each resolves its own model and the over-quota tenant is rejected while the other completes.

## Scope

- Two tenants with different `model_preferences` each resolve to their own model (no cross-talk)
- Over-quota tenant's job is rejected (`QUOTA_EXCEEDED`), under-quota tenant's job completes
- Default-scope tenant behaves as M1–M5 (no regression)
- E2E test in `tests/` (parallel with existing E2E suite)
- **NOT in scope:** dashboard UI, A/B framework, Worker Registry v2, publishing schedules

## Deliverables

- Multi-tenant E2E test covering model-preference isolation + quota enforcement

## Acceptance Criteria

- [ ] Two tenants with different `model_preferences` each resolve to their own model (no cross-talk)
- [ ] Over-quota tenant's job is rejected (`QUOTA_EXCEEDED`), under-quota tenant's job completes
- [ ] Default-scope tenant behaves as M1–M5 (no regression)
- [ ] `pnpm run typecheck` and `pnpm run build` pass; E2E passes

## Security

- Strict `tenant_id` scoping asserted by the E2E — tenant A and tenant B never see each other's policy or spend.

## Cross-References

- **Sprint:** [Sprint-005/README.md](../README.md)
- **Depends on:** [Issue M6.3](./Issue-503.md), [Issue M6.4](./Issue-504.md)
- **E2E suite:** [Issue S1.6](../../sprints/Sprint-001/Issue-006.md)
- **Real-AI workers (M3):** [Issue S2.4](../../sprints/Sprint-002/Issue-204.md), `@fyi/ai` adapters
