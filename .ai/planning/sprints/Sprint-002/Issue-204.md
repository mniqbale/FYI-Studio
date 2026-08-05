---
title: "Issue S2.4: ModelGate v2 (Capability Resolver)"
issue_id: "S2.4"
sprint: "Sprint-002"
source: "ADR-0007 / CHANGELOG-ARM05"
status: "done"
priority: "P0"
estimated_complexity: "L"
estimated_hours: 16
created: "2026-08-04"
tags: [modelgate, model-resolution, capability, provider-policy, byoai]
---

# Issue S2.4: ModelGate v2 (Capability Resolver)

## Goal

Implement the capability-based model resolver. Workers ask for a capability; ModelGate v2 resolves to a concrete provider/model using connected providers, available models, and policy.

## Scope

- Resolution pipeline: capability → connected providers → available models → policy → capability match → selected model
- Default provider policies per worker capability
- User override with capability-gating (incompatible models excluded)
- Structured error when no connected provider supports the capability
- **NOT in scope:** CLI surface (S2.5), real worker integration (Milestone 3)

## Deliverables

- ModelGate v2 module (replaces/augments static `CAPABILITY_POLICY` in `services/supervisor/src/config.ts`)
- Policy resolution + override logic
- Unit tests for resolution paths and failure modes

## Acceptance Criteria

- [ ] `resolve(capability, tenant, override?)` returns `{ provider, model, params }`
- [ ] Only connected providers and capability-capable models are considered
- [ ] Default per-worker model applies when no override
- [ ] Override allowed only if model supports the capability
- [ ] No provider available → structured error (`PROVIDER_UNAVAILABLE`, non-retryable semantics)
- [ ] Contracts v1.1 unchanged — `TaskEnvelope.policy` already carries the resolved model

## Cross-References

- **Sprint:** [Sprint-002/README.md](../README.md)
- **ADR:** [ADR-0007](../../adr/ADR-0007-ai-platform-foundation.md), [ADR-0006](../../adr/ADR-0006-user-configurable-provider-connection.md)
- **Model/Capability:** [Issue S2.3](./Issue-203.md)
- **Current ModelGate:** `services/supervisor/src/config.ts`
