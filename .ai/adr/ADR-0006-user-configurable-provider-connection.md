---
id: ADR-0006-user-configurable-provider-connection
title: "User-Configurable Provider Connections & Capability-Filtered Model Selection"
status: "Proposed"
date: "2026-08-04"
deciders: ["Founder", "Lead Engineer", "Principal Architect"]
tags: [providers, api-keys, model-gate, model-policy, model-selection, multi-provider, security]
source_conversation: "Milestone 2 planning discussion (user feature request)"
---

# ADR-0006: User-Configurable Provider Connections & Capability-Filtered Model Selection

## Context

As FYI Studio moves from mock workers (Milestone 1, complete) toward real AI integration (Milestone 2), the orchestration core needs a way to reach real providers (OpenAI, Anthropic, Google/Gemini, Ollama Cloud, Perplexity, etc.). Two architecture documents currently describe Milestone 2 differently:

- `contracts.md` / `implementation-strategy.md`: "The Cognitive Core" — integrate real AI providers, replace mock → real.
- `roadmap.md`: "Knowledge Layer + Memory Management" — knowledge/memory layers, vector retrieval, context assembly.

The founder surfaced a feature that unifies these: the product must give **the user control over which AI providers/models are connected and used**, in the spirit of the Hermes agent experience. Specifically:

1. A **menu/flow to connect API Keys per provider** — the user decides which providers to connect (e.g. connect Ollama Cloud + Claude + Gemini, each independently).
2. **Model selection freedom with capability gating** — each worker (e.g. Research Worker) has a **default/suggested model**, but the user may pick any other model, subject to two constraints:
   - Only models whose provider is **already connected via API** are shown.
   - Only models **capable of the task** are shown; a model that does not support the capability is **not displayed** to the user.

This turns the existing `ModelGate` + `model_policy.yaml` concept (Axiom 3 / contracts.md §12, which is currently a static `CAPABILITY_POLICY` in `services/supervisor/src/config.ts`) into a **user-facing, runtime-configurable** capability.

## Decision

Adopt a **user-configurable Provider Connection Manager** and **capability-filtered Model Selection** as a first-class component of FYI Studio.

### 1. Provider Connection Registry
- A store of connected providers, each holding an **encrypted API key reference** (never plaintext in DB/logs; key material stored via a secret manager — see Security).
- Each provider entry declares the **capabilities it can serve** and the **models it offers** (a `models` list with per-model capability support).
- Runtime surface (MVP): a CLI command (`@fyi/cli`) to add/list/remove a provider connection and its key. A web "menu" is possible later but is **out of MVP scope** (project is CLI-first per `implementation-strategy.md`).

### 2. ModelGate v2 (capability + connection-aware)
- Extends the current ModelGate: given a `capability` (e.g. `research:real`, `text-synthesis:script`) and a `tenant`, resolve to `{ provider, model, params }`.
- Resolution order:
  1. **Explicit user override** (per capability or per job) if set.
  2. **Default/suggested model** for that capability (from policy).
  3. Only consider providers that are **connected** and models that **support the capability**.
- If no connected provider supports the capability → surface a clear error ("no connected provider supports research:real; connect OpenAI or Gemini first"), NOT a silent fallback.

### 3. Capability-to-model capability metadata
- Add a `model_policy.yaml`-style declarative manifest describing, per provider: `models[].id`, `supported_capabilities[]`, `default_for[]`.
- The selection UI/CLI reads this to build the **filtered** model list per capability.

### 4. Worker integration
- Real workers (Research, Script) call the provider via the resolved `policy` in the `TaskEnvelope` (contract unchanged).
- Mock workers remain for tests; real workers selected by capability (`research:real` vs `research:mock`).

## Alternatives Considered

- **Fixed single-provider integration** (e.g. hardcode OpenAI). Rejected: vendor lock-in, contradicts Axiom 2 ("Providers Are Completely Replaceable") and the founder's explicit requirement for user control.
- **Full web dashboard for key management now.** Deferred: scope creep for MVP; project is CLI-first. A CLI config command + secret store covers the requirement now.
- **Let the user pick any model regardless of capability.** Rejected: a model that can't do the task (e.g. an embedding model used for script writing) would produce failures. Capability gating is required.

## Consequences

### Easier
- Multi-provider support and vendor swap without code changes (Axiom 2).
- Per-user/brand model preference (multi-tenant readiness).
- User agency over cost/quality trade-offs (Axiom 9).
- Foundation for Milestone 2 (Cognitive Core) and later Milestone 4 (multi-tenant model policies).

### Harder / Risks
- **Security is the primary risk:** API keys must never be committed, logged, or stored in plaintext. Requires a secret manager (env vars for local MVP; encrypted vault for production) and strict policy that `.env`/keys stay git-ignored.
- **Scope creep:** the "menu" could balloon into a full UI. Contained by scoping MVP to a CLI command.
- **Nondeterministic real outputs** break the deterministic mock E2E assumptions → tests must use MSW mocks (already the standard per Engineering Standards §5.2); real calls happen only at runtime.
- **New "no connected provider" failure mode** must be handled cleanly (structured WorkerError, non-retryable `PROVIDER_UNAVAILABLE`/`QUOTA_EXHAUSTED` semantics).
- Model capability metadata must be maintained as providers evolve.

## Implementation Notes

- Replaces/augments the static `CAPABILITY_POLICY` in `services/supervisor/src/config.ts` with a `ModelGate` backed by `model_policy.yaml` + a provider-connection store.
- Provider connections persisted in PostgreSQL (new table, e.g. `provider_connections` storing provider, provider_scope, key_ref, connected_at) with key material referenced (not stored) via secret manager.
- `model_policy.yaml` gains `capabilities` + per-provider `models[].supported_capabilities`.
- CLI additions (Milestone 2 Sprint 2): `fyi provider connect|list|disconnect|select` .
- Contracts v1.1 remain frozen; this ADR does not change `TaskEnvelope`/`WorkerResponse`.

## Status of Milestone 2 scope

Because the two architecture docs describe Milestone 2 differently, this ADR records the founder's feature as a **foundation** and notes that **Milestone 2 ordering should be: (1) Provider Connection + Model Selection (this ADR), (2) Cognitive Core (real AI workers), (3) Knowledge Layer + Memory.** A follow-up resolution of the roadmap/contracts Milestone 2 description is recommended.
