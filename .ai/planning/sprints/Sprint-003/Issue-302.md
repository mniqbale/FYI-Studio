---
title: "Issue M4.2: Knowledge Layer CRUD"
issue_id: "M4.2"
sprint: "Sprint-003"
source: "mvp-architecture.md (Knowledge Layer)"
status: "done"
priority: "P0"
estimated_complexity: "M"
estimated_hours: 10
created: "2026-08-05"
tags: [knowledge-layer, crud, brand-profiles, style-guides, verified-facts, asset-libraries, database]
---

# Issue M4.2: Knowledge Layer CRUD

## Goal

Provide tenant-scoped CRUD for the structured knowledge that informs AI workers: brand profiles, style guides, verified facts, and asset libraries.

## Scope

- Models/tables for `brand_profiles`, `style_guides`, `verified_facts`, `asset_libraries`
- CRUD operations (create/read/update/delete/list) per entity, tenant-scoped
- Implemented in `@fyi/database` / a knowledge module (or `@fyi/knowledge`)
- **NOT in scope:** `tenant_context` schema (M4.1), Memory Layer (M4.3), Context Assembly Engine (M4.4)

## Deliverables

- Prisma models for the four knowledge entities
- CRUD service/API (create/read/update/delete/list), tenant-scoped
- Unit tests for CRUD + tenant isolation

## Acceptance Criteria

- [ ] `brand_profiles`, `style_guides`, `verified_facts`, `asset_libraries` models exist
- [ ] CRUD works for all four entities
- [ ] All queries filtered by tenant_id (no cross-tenant leakage)
- [ ] snake_case column naming per Engineering Standards v1.0
- [ ] `@fyi/contracts` v1.1 remains frozen (types live in `@fyi/database` / knowledge module)
- [ ] Unit tests pass

## Security

- Mandatory tenant scope on every query.
- No plaintext secrets stored.

## Cross-References

- **Sprint:** [Sprint-003/README.md](../README.md)
- **Architecture:** [mvp-architecture.md](../../architecture/mvp-architecture.md) — Knowledge Layer
- **Depends on:** [Issue M4.1](./Issue-301.md) (`tenant_context`)
