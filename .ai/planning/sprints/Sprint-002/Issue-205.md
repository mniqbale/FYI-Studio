---
title: "Issue S2.5: CLI — fyi provider connect|list|disconnect|select"
issue_id: "S2.5"
sprint: "Sprint-002"
source: "ADR-0007 / CHANGELOG-ARM05"
status: "done"
priority: "P1"
estimated_complexity: "S"
estimated_hours: 4
created: "2026-08-04"
tags: [cli, provider, model-selection, byoai]
---

# Issue S2.5: CLI — fyi provider connect|list|disconnect|select

## Goal

Provide a user-facing CLI to manage provider connections and default model selection.

## Scope

- `fyi provider connect <provider>` — connect with API key
- `fyi provider list` — show connected providers + available models
- `fyi provider disconnect <provider>` — remove a connection
- `fyi provider select <capability> <model>` — set a default model for a capability
- **NOT in scope:** web UI (MVP is CLI-first)

## Deliverables

- CLI commands in `@fyi/cli`
- Capability-gated model selection (incompatible models not shown/selectable)

## Acceptance Criteria

- [ ] `connect` prompts for/reads API key securely, validates, persists key_ref
- [ ] `list` shows connected providers and models for each capability
- [ ] `disconnect` removes connection
- [ ] `select` sets a default model; rejects incompatible models
- [ ] No key material printed/logged

## Security (Mandatory)

- API key read from env/secret prompt, never from CLI arg that ends up in shell history.
- Never log keys.

## Cross-References

- **Sprint:** [Sprint-002/README.md](../README.md)
- **ADR:** [ADR-0007](../../adr/ADR-0007-ai-platform-foundation.md)
- **Connection:** [Issue S2.2](./Issue-202.md)
- **Model/Capability:** [Issue S2.3](./Issue-203.md)
- **ModelGate:** [Issue S2.4](./Issue-204.md)
