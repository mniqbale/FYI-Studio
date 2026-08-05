---
title: "Issue S2.2: Provider Registry + Connection Manager"
issue_id: "S2.2"
sprint: "Sprint-002"
source: "ADR-0007 / CHANGELOG-ARM05"
status: "done"
priority: "P0"
estimated_complexity: "M"
estimated_hours: 8
created: "2026-08-04"
tags: [provider-registry, connection-manager, api-keys, secrets, byoai]
---

# Issue S2.2: Provider Registry + Connection Manager

## Goal

Implement the provider catalog and the connection lifecycle (connect / validate / list / disconnect) with secure API key handling.

## Scope

- Provider catalog: OpenAI, Anthropic, Gemini, OpenRouter, Groq, Ollama, Azure, Vertex, Together
- Connection Manager: connect (with validation), list, disconnect
- Secret handling: key stored via secret manager / env, only `key_ref` persisted
- **NOT in scope:** model resolution (S2.4), CLI (S2.5)

## Deliverables

- `packages/database` provider_connections access layer (or a `@fyi/platform` package for registry logic)
- Connection manager module

## Acceptance Criteria

- [ ] Provider catalog includes the 9 providers listed above
- [ ] `connect` validates the API key (health check) before persisting
- [ ] Key material is never stored/logged in plaintext; only `key_ref` in DB
- [ ] `list` returns connected providers + status
- [ ] `disconnect` removes a connection
- [ ] Every log line includes relevant context; no key material ever

## Security (Mandatory)

- Keys come from env/secret manager, never from chat or commit.
- `.env` stays git-ignored.
- Validation failure returns structured error (e.g. `INVALID_CREDENTIALS`, `PROVIDER_UNAVAILABLE`).

## Cross-References

- **Sprint:** [Sprint-002/README.md](../README.md)
- **ADR:** [ADR-0007](../../adr/ADR-0007-ai-platform-foundation.md), [ADR-0006](../../adr/ADR-0006-user-configurable-provider-connection.md)
- **Database:** [Issue S2.1](./Issue-201.md)
