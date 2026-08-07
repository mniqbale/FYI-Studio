---
id: ADR-0012-media-engine-unified-lifecycle
title: "MediaEngine — Unified Engine Lifecycle (Standardize the Process, Not the Data)"
status: "Accepted"
date: "2026-08-07"
deciders: ["Founder", "CTO", "Lead Engineer", "Principal Architect"]
tags: [architecture, media-engine, adapter, capability-only, byoai, anti-leaky-abstraction, media]
source_conversation: "Architecture Review — MediaEngine extraction after Rule of Three (voice + subtitle + video)"
---

# ADR-0012: MediaEngine — Unified Engine Lifecycle

> **Status:** ACCEPTED (Founder decision 2026-08-07). This ADR extracts a single **MediaEngine** lifecycle contract from three real implementations (VoiceEngine, SubtitleEngine, VideoEngine — ADR-0011), under a strict anti-leaky-abstraction constraint: **MediaEngine standardizes the engine lifecycle (process), never the payload/metadata (data).**

## Context

Per ADR-0011, all media workers must be capability-only. We implemented three real engines under the same pattern (Rule of Three):

| Engine | Input | Output | Adapter layer |
|--------|-------|--------|---------------|
| VoiceEngine | single text + `{voice,speed}` | `audio_path, voice_id` | `voice-engine.ts` |
| SubtitleEngine | single text + `{language}` | `srt_path, subtitle_text` | `subtitle-engine.ts` |
| VideoEngine | **multi-asset** `{audio,srt,title,res}` | `video_path, format` | `video-engine.ts` |

The contract comparison showed ~80–90% overlap in the **lifecycle** (resolve capability → select adapter → run → error handling → telemetry → cost → publish artifacts), while the **payload/metadata** differ (video is a deliberate stress test with multi-asset input).

A naive extraction would force all engines into a single `payload: Record<string,unknown>` + shared metadata shape — a **leaky abstraction** that erases each engine's real, useful type safety. The Founder rejected this: MediaEngine must unify the *process*, leaving the *data* free.

## Decision

**Adopt a single `MediaEngine` lifecycle contract** that standardizes the *process* of running any media engine, while explicitly NOT standardizing the *payload/metadata*.

### What IS standardized (the lifecycle)
1. **Resolve capability** — via ModelGate → `{provider, model}`.
2. **Select adapter** — via a registry/factory keyed by resolved identity.
3. **Run the engine** — a single `run()` entry point invoked uniformly.
4. **Error handling** — uniform mapping to `WorkerResponse` status/error shape (fail → `WorkerStatus.FAILURE` + structured error; never throw out).
5. **Retry semantics** — uniform `retryable` flag on errors.
6. **Telemetry** — uniform capture (duration, tokens/seconds, provider, model) into the `performance` + ledger.
7. **Cost reporting** — uniform `cost_estimate` field.
8. **Artifact publishing** — uniform `new_references` emission (`refs`) from engine outputs.

### What is NOT standardized (per-engine freedom)
1. **Payload shape** — each engine declares its OWN typed input (`VoiceEngineInput`, `VideoEngineInput`, ...). No forced `Record<string,unknown>`.
2. **Engine-specific options** — voice `{voice,speed}`, subtitle `{language}`, video `{resolution,title}` stay per-engine.
3. **Engine-specific metadata** — `voice_id`, `cue count`, `format`, etc. remain engine-typed, carried opaquely (never flattened into a shared schema).

> **Principle: standardize the process, not the data.** An engine's payload/metadata is its private concern; the lifecycle is the shared contract. This keeps TTS/Subtitle/Video/Image/Music/Avatar engines on ONE consistent lifecycle without losing their individual flexibility.

### Structural shape (conceptual)

```
MediaEngine {
  provider, model
  run(ctx: EngineContext): Promise<EngineOutcome>
}

EngineContext  = { execution_id, job_id, tenant_id }   // lifecycle-injected
EngineOutcome  = { refs: Record<string,string>,          // artifact publishing (std)
                   cost_estimate: number,                 // cost reporting (std)
                   telemetry: {...},                      // telemetry (std)
                   metadata?: unknown }                   // engine-specific (NOT std)

A lifecycle runner (shared by all media workers) performs the standardized
process: resolve → select → run → handle error → telemetry → cost → refs.

Each engine still exposes its OWN typed input/output at its call-site, so a
VoiceEngine takes VoiceEngineInput and VideoEngine takes VideoEngineInput —
the lifecycle runner never sees (or forces) a common payload schema.
```

### Worker becomes lifecycle-only
A media worker no longer hand-writes resolve→factory→response. It declares:
- its capability + queue,
- how to build its engine-specific input from the envelope,
- its engine adapter registry,
then delegates the whole lifecycle to the shared runner.

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **Force a common `payload`/metadata schema across all engines** | Leaky abstraction — erases real type safety (video multi-asset vs voice text); video stress test showed the payload is genuinely different; violates the Founder's anti-leaky-abstraction requirement |
| **Keep three separate engine contracts (no extraction)** | Redundant — the lifecycle is ~90% identical; every new media engine (image/music/avatar) would re-implement the same resolve→run→error→telemetry→cost→refs boilerplate |
| **Extract only a shared factory, keep worker logic per-engine** | Leaves the most error-prone boilerplate (error mapping, telemetry, cost, response building) duplicated in every worker |

## Consequences

### Easier
- **One lifecycle for ALL media capabilities** — TTS, Subtitle, Video, Image, Music, Avatar each plug in as an engine; the worker lifecycle is written once.
- **Adding a media engine** = adapter + registry entry + (new) typed input/outcome; worker lifecycle untouched (ADR-0011 acceptance #1 fully honored).
- **Type safety preserved** — each engine keeps its own typed payload/metadata; no lossy `Record` cast.
- **Consistent telemetry/cost/errors/artifacts** across every media worker.

### Harder / Risks
- **Discipline to NOT leak** — the runner must treat engine metadata as opaque `unknown`; team must resist widening `EngineOutcome.metadata` into a shared schema as "convenience."
- **Input construction still per-worker** — each worker keeps a thin "build input from envelope" step; this is intentionally per-engine, not extracted.
- **Migration** — VoiceEngine/SubtitleEngine/VideoEngine are refactored to conform to `MediaEngine` (they become adapter instances of the single contract). This is the extraction the Founder approved after the stress test.

## Implementation Notes

- New `packages/media/src/media-engine.ts`: `MediaEngine` interface + `EngineOutcome` + a `runMediaEngine` lifecycle helper (resolve→select→run→error→telemetry→cost→refs).
- `voice-engine.ts`, `subtitle-engine.ts`, `video-engine.ts` are refactored to implement `MediaEngine` (each keeps its own typed input/outcome), and their factories remain the adapter registries.
- Media workers (voice/subtitle/video) delegate their whole lifecycle to the runner, keeping only: capability, queue, input-builder, engine-registry.
- **No change** to contracts v1.1 (ADR-0002), `TaskEnvelope`/`WorkerResponse`, or the data plane (ADR-0003).
- Automated invariant (ADR-0005 PR checklist): grep media workers for vendor names must stay empty (ADR-0011 acceptance #2).

## Architecture Impact on Existing ADRs

| ADR | Impact |
|-----|--------|
| **ADR-0011 (Capability-Only Worker Invariant)** | MediaEngine is the concrete lifecycle that makes ADR-0011 enforceable for media; workers stay capability-only |
| **ADR-0001 (MVP Architecture)** | Media workers share one lifecycle; engine variety (TTS/subtitle/video/image/music/avatar) is a registry concern, not a worker concern |
| **ADR-0002 (Contracts v1.1)** | No change — frozen |
| **ADR-0003 (Reference Data Plane)** | No change — refs still carry file:// pointers |
| **ADR-0007 (AI Platform Foundation)** | MediaEngine is the BYOAI adapter contract for media capabilities |

---

**Approval:** Founder (Product Direction + anti-leaky-abstraction constraint), CTO (Architectural Integrity), Lead Engineer (Implementation Feasibility), Principal Architect (Architectural Integrity).
