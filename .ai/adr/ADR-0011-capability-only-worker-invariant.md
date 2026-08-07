---
id: ADR-0011-capability-only-worker-invariant
title: "Capability-Only Worker Invariant (Workers Speak Only to Capabilities)"
status: "Accepted"
date: "2026-08-07"
deciders: ["Founder", "CTO", "Lead Engineer", "Principal Architect"]
tags: [architecture, invariant, vendor-agnostic, byoai, worker, model-gate, engine-adapter, provider-replaceability]
source_conversation: "CTO audit — vendor-agnostic architecture review + Founder architecture decision"
---

# ADR-0011: Capability-Only Worker Invariant

> **Status:** ACCEPTED (Founder decision 2026-08-07). This ADR formalizes a hard architectural invariant for all workers: **a Worker may only speak to a Capability, never to a Vendor or an Engine.** It is the enforceable contract behind Axiom 2 (Providers Are Completely Replaceable, `supervisor-design.md`) and the BYOAI layer (ADR-0007).

## Context

A CTO audit of the current codebase (`2026-08-07`) confirmed partial vendor-agnosticism:

- **LLM Workers (research-real, script-real) ARE capability-driven.** They call `ModelGate.resolve(capability)` → get `{provider, model}` → hand to `AiClient`. Replacing GPT/Gemini/DeepSeek/Ollama requires only a `model_policy.yaml` / registry change — **no worker code change.** ✅
- **Media Workers (voice/subtitle/video) are NOT.** They hardcode an engine (`synthesizeSpeechSmart` → espeak-ng/replicate, `generateSubtitles` → ffmpeg, `composeVideo` → ffmpeg) and bypass ModelGate entirely. Replacing the TTS/video engine requires **editing worker source code** — a direct vendor lock-in. ❌

The Founder stated the north-star decision:

> *"Semua Worker tanpa pengecualian hanya boleh berbicara dengan Capability, bukan Vendor maupun Engine. Kalau setelah itu kita masih harus mengubah kode Worker setiap kali mengganti Dreamina, Seedance, ElevenLabs, atau provider lain, berarti vendor lock-in masih ada."*

## Decision

**Adopt the Capability-Only Worker Invariant:** every Worker, without exception, communicates only with a Capability via the Capability Layer (ModelGate / Registry). Workers MUST NOT reference a vendor name or engine name in their processing logic.

```
Worker ──capability──▶ Capability Layer (ModelGate + Registry) ──▶ Adapter ──▶ Vendor/Engine
       (e.g. voice:tts)        (pick from connected+capable)     (1 adapter = 1 vendor)
```

The Capability Layer is the ONLY place that knows vendor/engine identity. A Worker's flow is always:

1. `gate.resolve(capability, {scope})` → `{provider, model}` (the selected engine).
2. Hand the resolved identity to the appropriate **adapter** selected by the registry.
3. Never branch on `provider`/`model`/engine inside the worker's own logic.

### Acceptance Criteria (testable, machine-checkable)

1. **Zero worker code change for a new/replaced vendor.** Adding a vendor (e.g. ElevenLabs TTS, Seedance video) requires ONLY: (a) a new **adapter**, and (b) a **registry / `model_policy.yaml` entry**. No new import, no new branch, no hardcoded string added inside any Worker source file.
2. **No vendor/engine identifiers in Worker processing logic.** A Worker's `src/*.ts` must not contain a `switch(provider)`, a hardcoded engine/vendor name (e.g. `espeak-ng`, `ffmpeg`, `sora`, `seedance`, `elevenlabs`), or a direct call to a vendor-specific SDK, EXCEPT inside an adapter module it delegates to by capability. Grep for vendor names in `workers/*/src/*.ts` must yield no processing-logic hits.
3. **Media engines are resolved via ModelGate**, identical to LLM models. Assigning a media model in the Dashboard (voice:tts / subtitle / video) must actually change the engine used — not be cosmetic.
4. **Registry is the single source of truth** for provider/engine base URL, metadata, and capabilities. No duplicated base-URL/endpoint maps in `AiClient`, dashboard, or validate paths.

### Scope boundary
- This invariant applies to **all current and future Workers** (LLM, media, publish, subtitle, video).
- **Adapters** are intentionally vendor-aware — they are the single allowed place to know a vendor's wire format. Adapters are not "Workers."
- Contracts v1.1 remain frozen (ADR-0002). This is an application-layer architecture decision; it does not alter `TaskEnvelope`/`WorkerResponse`.

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **Keep media engines hardcoded in workers; only fix LLM path** | Leaves the biggest vendor lock-in (TTS/video/subtitle) unaddressed; a media engine swap still requires editing worker code; contradicts the Founder's stated invariant |
| **Full vendor-agnosticism with zero adapter awareness** | Impossible — something must translate a capability to a vendor's wire protocol. The invariant correctly localizes that to the adapter layer |
| **Refactor all three media workers at once** | Higher blast radius; the Founder explicitly chose to validate the pattern on one worker (voice:tts) before replicating |

## Consequences

### Easier
- **Vendor/engine replaceability without touching workers** (Axiom 2 fully honored) — swap espeak-ng→ElevenLabs, ffmpeg→Seedance/Dreamina by registering a new adapter + registry entry.
- **Single source of truth** for provider/engine metadata (ADR-0007 foundation, no duplicated maps).
- **Dashboard media-model assignment becomes real**, not cosmetic.
- **Testable invariant** — automated check can grep workers for vendor names and verify adapters are the only vendor-aware layer.

### Harder / Risks
- **Media engine abstraction** is the hard part: a "voice engine" adapter must present a uniform interface (e.g. `synthesize(text, voice) → audio`) that both offline (espeak-ng) and cloud (ElevenLabs/Replicate) can satisfy. Similar uniform interfaces needed for subtitle (ASR) and video engines.
- **Reference implementation discipline** — must validate the pattern on `voice:tts` first, prove it clean, THEN replicate to subtitle/video (per Founder directive).
- **Adapter explosion** — each vendor needs an adapter; must keep them thin and uniform.
- **Registry maintenance** — `model_policy.yaml` + capability metadata must stay authoritative and current.

## Implementation Plan (reference implementation first)

1. **ADR recorded (this document)** — contract locked.
2. **Engine interface + adapter pattern** in `@fyi/media` (or a new `@fyi/engines`): define a uniform `VoiceEngine` interface (`synthesize`) implemented by `espeakEngine` and `replicateKokoroEngine`.
3. **Reference implementation: `voice:tts` worker** — resolve engine via ModelGate, delegate to the adapter by resolved identity. Prove: adding a voice engine = new adapter + registry entry, worker untouched.
4. **Validate the pattern** (typecheck + test + a media E2E), then **replicate** to `subtitle:generate` (ASR engine) and `video:compose` (video engine).
5. **Remove duplicated vendor maps** — `AiClient`, dashboard, validate paths consume `@fyi/platform` registry instead of declaring their own.

## Architecture Impact on Existing ADRs

| ADR | Impact |
|-----|--------|
| **ADR-0001 (MVP Architecture)** | Reinforces Axiom 2 as a hard invariant; media workers become capability-driven |
| **ADR-0002 (Contracts v1.1)** | No change — frozen |
| **ADR-0003 (Reference Data Plane)** | No change — engine adapters operate on file references |
| **ADR-0004 (Thin Orchestrator)** | ModelGate/Registry remains a utility; invariants apply to workers, not the orchestrator |
| **ADR-0005 (Engineering Standards)** | Adds an automated invariant check (grep workers for vendor names) to the PR checklist |
| **ADR-0007 (AI Platform Foundation)** | Extends BYOAI to media engines; ModelGate becomes the sole capability resolver for ALL workers |
| **ADR-0010 (HITL)** | No conflict — orthogonal write surface |

---

**Approval:** Founder (Product Direction), CTO (Architectural Integrity & Vendor Independence), Lead Engineer (Implementation Feasibility), Principal Architect (Architectural Integrity).
