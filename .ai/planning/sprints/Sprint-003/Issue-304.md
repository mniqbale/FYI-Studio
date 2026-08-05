---
title: "Issue M4.4: Context Assembly Engine"
issue_id: "M4.4"
sprint: "Sprint-003"
source: "mvp-architecture.md (Context Injection)"
status: "done"
priority: "P0"
estimated_complexity: "L"
estimated_hours: 14
created: "2026-08-05"
tags: [context-assembly, context-injection, taskenvelope, policy, tenant-scope]
---

# Issue M4.4: Context Assembly Engine

## Goal

Assemble the `TaskEnvelope.context` for a job: extract relevant knowledge + memory, retrieve from `tenant_context`, filter by tenant-scope policy, and inject. This is the bridge between the stored "flattened brain" and the real AI workers.

## Scope

- Pipeline: extract → retrieve → inject → (prune/purge)
- Populate the `context` field of the `TaskEnvelope` (contracts v1.1 field)
- Policy-driven filtering by tenant scope
- **NOT in scope:** worker wiring (M4.5), analytics, vector DB

## Deliverables

- Context Assembly Engine (in `@fyi/database` / a knowledge module / supervisor)
- Assembly unit tests (extract/retrieve/inject, policy filtering, prune)

## Acceptance Criteria

- [ ] Engine extracts relevant knowledge (M4.2) + memory (M4.3) for a tenant/job
- [ ] Retrieves base context from `tenant_context` (M4.1): brand_voice, language, forbidden_terms, constraints
- [ ] Inject assembled result into the `TaskEnvelope.context` field
- [ ] Policy-driven filtering by tenant scope; only the tenant's own context is visible
- [ ] Non-fatal fallback: no tenant context → empty context (job still runs)
- [ ] Size/prune limits prevent prompt bloat
- [ ] `@fyi/contracts` v1.1 remains frozen
- [ ] Unit tests pass

## Security

- Tenant isolation enforced in every retrieval.
- No cross-tenant data leakage.

## Cross-References

- **Sprint:** [Sprint-003/README.md](../README.md)
- **Contracts:** [contracts.md](../../architecture/contracts.md) — `TaskEnvelope.context`
- **Depends on:** [Issue M4.1](./Issue-301.md), [Issue M4.2](./Issue-302.md), [Issue M4.3](./Issue-303.md)
