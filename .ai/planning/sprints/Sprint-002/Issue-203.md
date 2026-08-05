---
title: "Issue S2.3: Model Registry + Capability Registry"
issue_id: "S2.3"
sprint: "Sprint-002"
source: "ADR-0007 / CHANGELOG-ARM05"
status: "done"
priority: "P0"
estimated_complexity: "M"
estimated_hours: 8
created: "2026-08-04"
tags: [model-registry, capability-registry, model-policy, byoai]
---

# Issue S2.3: Model Registry + Capability Registry

## Goal

Implement the model catalog (with capability metadata) and the capability definitions that ModelGate v2 will use.

## Scope

- Model Registry: provider, model, version, pricing, capabilities, context window, status
- Capability Registry: reasoning, vision, image, speech, embedding, video, tool calling, search, structured output
- Seed via `model_policy.yaml` as the single source of truth
- **NOT in scope:** ModelGate v2 resolution logic (S2.4), CLI (S2.5)

## Deliverables

- `model_policy.yaml` (capabilities + per-provider models with supported_capabilities)
- Model Registry + Capability Registry modules backed by the DB
- Seed logic to load `model_policy.yaml` into the registries

## Acceptance Criteria

- [ ] `model_policy.yaml` is the source of truth for model + capability metadata
- [ ] Registry exposes models by provider and by capability
- [ ] Capabilities match the Capability Registry list in ADR-0007
- [ ] Only capability-capable models are surfaced for a given capability
- [ ] Registry data versioned for future provider evolution

## Cross-References

- **Sprint:** [Sprint-002/README.md](../README.md)
- **ADR:** [ADR-0007](../../adr/ADR-0007-ai-platform-foundation.md)
- **Database:** [Issue S2.1](./Issue-201.md)
- **Provider:** [Issue S2.2](./Issue-202.md)
