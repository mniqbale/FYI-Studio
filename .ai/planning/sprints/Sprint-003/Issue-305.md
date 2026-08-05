---
title: "Issue M4.5: Wire Context Injection into Real Workers + E2E"
issue_id: "M4.5"
sprint: "Sprint-003"
source: "mvp-architecture.md (Context Injection)"
status: "done"
priority: "P0"
estimated_complexity: "M"
estimated_hours: 10
created: "2026-08-05"
tags: [context-injection, research-real, script-real, e2e, integration]
---

# Issue M4.5: Wire Context Injection into Real Workers + E2E

## Goal

Hook the Context Assembly Engine (M4.4) into the real Research (`research:real`) and Script (`text-synthesis:script:real`) workers, and prove end-to-end that context reaches the model call.

## Scope

- Inject assembled `TaskEnvelope.context` into the real workers before the AI call
- Add E2E test: seed tenant context → run pipeline → assert context present
- **NOT in scope:** new AI adapters, analytics, vector DB

## Deliverables

- Wiring between Context Assembly Engine and `research:real` / `text-synthesis:script:real`
- E2E test covering context injection

## Acceptance Criteria

- [ ] `research:real` / `text-synthesis:script:real` receive `TaskEnvelope.context` populated by the engine
- [ ] E2E test seeds a tenant with brand_voice/constraints → runs pipeline → asserts context present in envelope
- [ ] No regression to M3 pipeline (research → script → COMPLETED)
- [ ] `@fyi/contracts` v1.1 remains frozen
- [ ] `pnpm run typecheck` and `pnpm run build` pass; E2E passes

## Security

- Tenant isolation preserved through the pipeline.
- No plaintext secrets in context.

## Cross-References

- **Sprint:** [Sprint-003/README.md](../README.md)
- **Depends on:** [Issue M4.4](./Issue-304.md)
- **Real-AI workers (M3):** [Issue S2.4](../../sprints/Sprint-002/Issue-204.md), `@fyi/ai` adapters
