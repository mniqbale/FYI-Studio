---
title: "Issue S2.1: Database Layer for AI Platform Foundation"
issue_id: "S2.1"
sprint: "Sprint-002"
source: "ADR-0007 / CHANGELOG-ARM05"
status: "done"
priority: "P0"
estimated_complexity: "S"
estimated_hours: 4
created: "2026-08-04"
tags: [database, prisma, provider-connections, model-registry, capability-registry, byoai]
---

# Issue S2.1: Database Layer for AI Platform Foundation

## Goal

Extend the Prisma schema with the registries that back the AI Platform Foundation (BYOAI): `provider_connections`, `model_registry`, and `capability_registry`.

## Scope

- Add three tables to `packages/database/prisma/schema.prisma`
- Run migration + regenerate Prisma client
- **NOT in scope:** connection logic, ModelGate v2, CLI

## Deliverables

- `/packages/database/prisma/schema.prisma` (extended)
- Migration files
- Regenerated client

## Acceptance Criteria

- [ ] `provider_connections` table exists (provider, scope, key_ref, status, quota fields, connected_at)
- [ ] `model_registry` table exists (provider, model, version, pricing, capabilities, context_window, status)
- [ ] `capability_registry` table exists (name, description)
- [ ] `prisma migrate dev` succeeds; client regenerated
- [ ] snake_case column naming per Engineering Standards v1.0

## Security

- No API key material stored in the DB — only a `key_ref` pointing to secret storage.
- Never log connection details or key material.

## Cross-References

- **Sprint:** [Sprint-002/README.md](../README.md)
- **ADR:** [ADR-0007](../../adr/ADR-0007-ai-platform-foundation.md)
- **Database base:** [Issue S1.2](../../sprints/Sprint-001/Issue-002.md)
