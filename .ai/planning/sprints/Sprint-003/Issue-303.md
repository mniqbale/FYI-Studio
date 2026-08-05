---
title: "Issue M4.3: Memory Layer (Historical Performance, Edits, Audience Analytics)"
issue_id: "M4.3"
sprint: "Sprint-003"
source: "mvp-architecture.md (Memory Layer)"
status: "done"
priority: "P1"
estimated_complexity: "M"
estimated_hours: 8
created: "2026-08-05"
tags: [memory-layer, crud, historical-performance, edits, audience-analytics, database]
---

# Issue M4.3: Memory Layer

## Goal

Store historical context — past performance, prior edits, audience analytics — in simple MVP tables with tenant-scoped CRUD. This is the raw material the Context Assembly Engine (M4.4) can later feed to workers.

## Scope

- Tables for `historical_performance`, `edits`/versions, `audience_analytics`
- CRUD operations, tenant-scoped
- **NOT in scope:** analytics ingestion pipeline (deferred to Milestone 7), Context Assembly Engine (M4.4)

## Deliverables

- Prisma models for the memory tables
- CRUD service/API, tenant-scoped
- Unit tests for CRUD + tenant isolation

## Acceptance Criteria

- [ ] `historical_performance`, `edits`, `audience_analytics` models exist
- [ ] CRUD works; tenant-scoped
- [ ] Edits are versioned (immutable history, latest snapshot retrievable)
- [ ] snake_case column naming per Engineering Standards v1.0
- [ ] `@fyi/contracts` v1.1 remains frozen
- [ ] Unit tests pass

## Security

- Mandatory tenant scope on every query.
- No plaintext secrets stored.

## Cross-References

- **Sprint:** [Sprint-003/README.md](../README.md)
- **Architecture:** [mvp-architecture.md](../../architecture/mvp-architecture.md) — Memory Layer
- **Depends on:** [Issue M4.1](./Issue-301.md) (`tenant_context`)
