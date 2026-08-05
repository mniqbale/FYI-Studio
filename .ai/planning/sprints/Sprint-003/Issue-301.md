---
title: "Issue M4.1: tenant_context Schema + Prisma Migration"
issue_id: "M4.1"
sprint: "Sprint-003"
source: "mvp-architecture.md (The Flattened Brain, §5)"
status: "done"
priority: "P0"
estimated_complexity: "S"
estimated_hours: 6
created: "2026-08-05"
tags: [knowledge-layer, prisma, tenant-context, database, mvp, flattened-brain]
---

# Issue M4.1: `tenant_context` Schema + Prisma Migration

## Goal

Add the `tenant_context` table — the MVP "flattened brain" (per mvp-architecture.md §5). Stores brand voice, language, forbidden terms, and per-channel/tenant constraints. **No vector DB in the MVP.**

## Scope

- Add `tenant_context` table to `packages/database/prisma/schema.prisma`
- Run migration + regenerate Prisma client
- **NOT in scope:** Knowledge Layer CRUD (M4.2), Memory Layer (M4.3), Context Assembly Engine (M4.4), worker wiring (M4.5)

## Deliverables

- `/packages/database/prisma/schema.prisma` (extended with `tenant_context`)
- Migration files
- Regenerated client

## Acceptance Criteria

- [ ] `tenant_context` table exists (tenant_id, channel_id, brand_voice JSONB, language, forbidden_terms, constraints per channel/tenant)
- [ ] `prisma migrate dev` succeeds; client regenerated
- [ ] snake_case column naming per Engineering Standards v1.0
- [ ] `@fyi/contracts` v1.1 remains frozen (no contract changes)
- [ ] Indexes on tenant_id / channel_id for scoped lookups

## Security

- Tenant isolation: every row is keyed by tenant_id; no cross-tenant reads.
- No plaintext secrets stored in the table.

## Cross-References

- **Sprint:** [Sprint-003/README.md](../README.md)
- **Architecture:** [mvp-architecture.md](../../architecture/mvp-architecture.md) — §5 Knowledge Base (Flattened Brain)
- **Database base:** [Issue S1.2](../../sprints/Sprint-001/Issue-002.md)
