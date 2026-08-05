---
title: "Sprint 5: Multi-Tenant Brand Management (Tenant Registry + Policy Engine) (Milestone 6) - Sprint Planning"
version: "1.0"
source: "mvp-architecture.md (Multi-Tenancy) / M4 (tenant_context) / M2 (ModelGate v2)"
sprint: "Sprint-005"
status: "in-progress"
created: "2026-08-05"
tags: [sprint-planning, sprint-5, multi-tenant, policy-engine, tenant-registry, cost-quota, model-preference]
---

# Sprint 5 Planning: Multi-Tenant Brand Management (Tenant Registry + Policy Engine) (Milestone 6)

**Goal:** Enable horizontal scaling to hundreds of heterogeneous channels with strict isolation by giving each tenant its own policy — a **per-tenant model preference** and a **cost quota** — and enforcing that policy everywhere the platform resolves models and admits jobs. Build the Tenant Registry (`tenant_policies` schema) and the Policy Engine (in `@fyi/platform`), wire tenant policy into `ModelGate.resolve` so a tenant preference overrides the global default when set, enforce cost quotas, and verify isolation with a two-tenant E2E test.

**Duration:** 1 Sprint (Milestone 6 spans Sprints 11–13 in the original estimate; Sprint-005 covers the MVP scope — Tenant Registry + Policy Engine only).

**Primary Metric:** Two tenants with different policies run the same pipeline and produce isolated behavior — each resolves its own preferred model and neither can spend past its quota — with the global `default` scope untouched for tenants without an explicit policy.

> **MVP scope (per mvp-architecture.md):** Tenant Registry + Policy Engine (per-tenant model preference + cost quota). The full A/B testing framework, dashboard UI, Worker Registry v2, and publishing schedules are **deferred** to post-MVP.

---

## 1. Product Backlog (Sprint 5 / Milestone 6)

| ID | Task Name | Description | Priority |
| :--- | :--- | :--- | :--- |
| **M6.1** | **`tenant_policies` schema + migration** | Prisma model `tenant_policies` (tenant_id unique, model_preferences JSON, cost_quota, enabled) + migration | P0 |
| **M6.2** | **Policy Engine in `@fyi/platform`** | Resolve a tenant's policy, check cost quota, and surface the enforced per-tenant model preference — the reusable core | P0 |
| **M6.3** | **Wire tenant policy into ModelGate.resolve** | Tenant preference overrides the global `default` scope when set; falls back to global default otherwise | P0 |
| **M6.4** | **Cost quota enforcement** | Reject/limit job admission when a tenant's budget is exceeded (checked at dispatch / ModelGate resolve) | P0 |
| **M6.5** | **Multi-tenant E2E** | Two tenants with different policies produce isolated behavior (different models, quota rejection) — end-to-end | P0 |

---

## 2. Detailed Task Breakdown & Acceptance Criteria

### Task M6.1: `tenant_policies` Schema + Prisma Migration
- **Description:** Add a `tenant_policies` table to the Prisma schema — `tenant_id` (unique, FK-adjacent to the M4 `tenant_context`), `model_preferences` (JSON), `cost_quota` (numeric/JSON for per-capability or total), `enabled` (boolean) — plus a migration and client regeneration.
- **Acceptance Criteria:**
  - `tenant_policies` model with `tenant_id` unique, `model_preferences` JSON, `cost_quota`, `enabled` columns
  - Migration applied; regenerated Prisma client
  - CRUD smoke test (upsert/get/update/list/disable) passes
  - Contracts v1.1 remains **frozen** (no contract changes)
- **Dependencies:** S1.2 (`@fyi/database`), M4 (`tenant_context` pattern from Sprint-003)
- **Related Issue:** [Issue M6.1](./Issue-501.md)

### Task M6.2: Policy Engine in `@fyi/platform`
- **Description:** Build the Policy Engine as a utility in `@fyi/platform` (mirroring ModelGate's utility-not-service pattern per ADR-0004): load/resolve a tenant's policy, check the cost quota, and expose the per-tenant model preference. No tenant policy present → return the global/default scope unchanged.
- **Acceptance Criteria:**
  - `resolveTenantPolicy(tenant_id)` returns the tenant's policy or a `default` scope fallback
  - `checkCostQuota(tenant_id, cost)` evaluates spend vs `cost_quota` (admit vs reject)
  - `getModelPreference(tenant_id)` returns the per-tenant model preference (or undefined → fallback)
  - Handles disabled / missing policies gracefully (default scope)
  - Unit tests cover resolve / quota-check / preference fallback
- **Dependencies:** M6.1
- **Related Issue:** [Issue M6.2](./Issue-502.md)

### Task M6.3: Wire Tenant Policy into ModelGate.resolve
- **Description:** Extend `ModelGate.resolve(capability, ...)` so a tenant's model preference **overrides** the global default when set; otherwise fall back to the existing `default` scope resolution (M3 behavior preserved). This is the key isolation point — tenant A can prefer `deepseek-v4-flash` while tenant B prefers a different model, without touching the global policy.
- **Acceptance Criteria:**
  - Tenant with `model_preferences` set resolves to the tenant's preferred model/capability
  - Tenant without an explicit preference falls back to the global `default` scope (M3 behavior unchanged)
  - Disabled tenant → default scope (no leakage of a stale tenant preference)
  - Existing ModelGate unit tests still pass (no regression)
  - `pnpm run typecheck` and `pnpm run build` pass
- **Dependencies:** M6.2, S2.4 (ModelGate v2)
- **Related Issue:** [Issue M6.3](./Issue-503.md)

### Task M6.4: Cost Quota Enforcement
- **Description:** Enforce `cost_quota` — reject/limit a job (or resolve-time admission) when the tenant's budget is exceeded. For the MVP this is checked at dispatch / ModelGate resolve against tracked spend; a tenant over quota is refused with a structured, non-retryable error.
- **Acceptance Criteria:**
  - Spend against `cost_quota` is tracked and evaluated at job dispatch
  - Tenant over quota → structured `QUOTA_EXCEEDED`-style rejection (non-retryable), not silent failure
  - Tenant at/under quota → job proceeds normally
  - Tenant with no quota configured → unlimited (default scope), no regression
  - Unit test: over-quota tenant rejected, under-quota admitted, no-quota admitted
- **Dependencies:** M6.2
- **Related Issue:** [Issue M6.4](./Issue-504.md)

### Task M6.5: Multi-Tenant E2E
- **Description:** Prove isolation end-to-end: seed two tenants with different `tenant_policies` (different `model_preferences`, and one over quota), run a job for each, and assert each resolves its own model and the over-quota tenant is rejected while the other completes.
- **Acceptance Criteria:**
  - Two tenants with different `model_preferences` each resolve to their own model (no cross-talk)
  - Over-quota tenant's job is rejected (`QUOTA_EXCEEDED`), under-quota tenant's job completes
  - Default-scope tenant behaves as M1–M5 (no regression)
  - E2E passes; `pnpm run typecheck` and `pnpm run build` pass
- **Dependencies:** M6.3, M6.4
- **Related Issue:** [Issue M6.5](./Issue-505.md)

---

## 3. Recommended Implementation Order (The "Critical Path")

1. **M6.1 (`tenant_policies` schema)** — the storage every downstream task reads/writes.
2. **M6.2 (Policy Engine)** — resolve + quota-check + preference, the reusable core in `@fyi/platform`.
3. **M6.3 (ModelGate integration)** — tenant preference overrides global default; the isolation point.
4. **M6.4 (Cost quota enforcement)** — rejects/limits over-budget tenants at dispatch.
5. **M6.5 (Multi-tenant E2E)** — two-tenant isolation verification.

---

## 4. Definition of Done (DoD)

A task is "Done" when:
1. Code complies with Engineering Standards v1.0 (naming, logging, errors).
2. Component implements Contracts v1.1 (unchanged — contracts remain frozen).
3. Unit tests pass (if applicable).
4. Security: no plaintext secrets; tenant policies scoped strictly by `tenant_id`; no cross-tenant data leakage.
5. Integration verified (unit/E2E) for the touched surface — tenant A and tenant B never see each other's policy or spend.

---

## 5. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Cross-tenant policy leakage** | High | Low | Strict `tenant_id` scoping on every query; E2E asserts isolation; default-scope fallback never reads a specific tenant's policy |
| **Tenant preference silently ignored** | Medium | Medium | M6.3 unit tests assert override + fallback; ModelGate regression suite |
| **Quota enforcement blocks legitimate jobs** | Medium | Medium | Quota checked at dispatch; structured non-retryable error; no-quota = unlimited default |
| **Contract drift (policy fields)** | Medium | Low | Contracts v1.1 frozen; policy is DB-only, never a contract field change |
| **Cost tracking inaccurate in MVP** | Medium | Medium | MVP tracks telemetry `cost` vs quota (simple sum); refine cost intelligence post-MVP (M7) |

---

## 6. Cross-References

- **Architecture:** [mvp-architecture.md](../../architecture/mvp-architecture.md) — §Multi-Tenancy
- **Roadmap:** [roadmap.md](../../architecture/roadmap.md) — Milestone 6 (Multi-Tenant)
- **Contracts:** [contracts.md](../../architecture/contracts.md) — `TaskEnvelope.tenant_id`, telemetry `cost`
- **Engineering Standards:** [engineering-standards.md](../../architecture/engineering-standards.md)
- **Prior sprint:** [Sprint-004/README.md](../Sprint-004/README.md) — Media Workers (M5)
- **Knowledge Layer (M4):** [Sprint-003/README.md](../Sprint-003/README.md) — `tenant_context` / `tenant_id` pattern
- **ModelGate v2 (M2):** [Issue S2.4](../../sprints/Sprint-002/Issue-204.md) — capability resolver, scope fallback
