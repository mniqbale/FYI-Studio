---
title: "Issue M6.1: tenant_policies Schema + Prisma Migration"
issue_id: "M6.1"
sprint: "Sprint-005"
source: "mvp-architecture.md (Multi-Tenancy) / M4 tenant_context pattern"
status: "done"
priority: "P0"
estimated_complexity: "M"
estimated_hours: 8
created: "2026-08-05"
tags: [multi-tenant, tenant-registry, prisma, schema, migration, database]
---

# Issue M6.1: `tenant_policies` Schema + Prisma Migration

## Goal

Add a `tenant_policies` table to the Prisma schema — the storage backing the Tenant Registry and Policy Engine. Each tenant gets a row keyed by `tenant_id` carrying a per-tenant **model preference** (JSON) and a **cost quota**, plus an `enabled` flag. This mirrors the M4 `tenant_context` pattern (PostgreSQL, no new infra).

## Scope

- Prisma model `tenant_policies` with `tenant_id` (unique), `model_preferences` (JSON), `cost_quota`, `enabled` (boolean)
- Prisma migration + regenerated client
- CRUD smoke test (upsert/get/update/list/disable)
- **NOT in scope:** Policy Engine logic (M6.2), ModelGate wiring (M6.3), quota enforcement (M6.4), E2E (M6.5)

## Deliverables

- `tenant_policies` Prisma model + migration (in `@fyi/database`)
- Passing CRUD smoke test

## Acceptance Criteria

- [ ] `tenant_policies` model with `tenant_id` unique, `model_preferences` JSON, `cost_quota`, `enabled` columns
- [ ] Migration applied; regenerated Prisma client
- [ ] CRUD smoke test (upsert/get/update/list/disable) passes
- [ ] Contracts v1.1 remains frozen (no contract changes)

## Security

- Tenant policies strictly scoped by `tenant_id` — no cross-tenant read/write.
- No plaintext secrets in policy rows (preferences/quota only; credentials stay in `key_ref` / env per ADR-0004).

## Cross-References

- **Sprint:** [Sprint-005/README.md](../README.md)
- **Architecture:** [mvp-architecture.md](../../architecture/mvp-architecture.md) — §Multi-Tenancy
- **M4 pattern:** [Issue M4.1](../../sprints/Sprint-003/Issue-301.md) — `tenant_context` schema
- **Database:** [Issue S1.2](../../sprints/Sprint-001/Issue-002.md) — `@fyi/database` / Prisma
