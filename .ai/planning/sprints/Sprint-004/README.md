---
title: "Sprint 4: Media Workers (Voice / Video / Subtitles) (Milestone 5) - Sprint Planning"
version: "1.0"
source: "mvp-architecture.md (Reference-Based Data Plane) / ADR-0003"
sprint: "Sprint-004"
status: "in-progress"
created: "2026-08-05"
tags: [sprint-planning, sprint-4, media-workers, voice, video, subtitles, tts, ffmpeg, data-plane]
---

# Sprint 4 Planning: Media Workers (Voice / Video / Subtitles) (Milestone 5)

**Goal:** Take a finished script and produce actual media artifacts — voice narration, subtitle file, and a composed video — without ever moving binary data through the orchestrator. Build three media workers (Voice/TTS, Subtitle, Video Composer) on top of the existing `research → script` pipeline, and wire the full `research → script → voice → subtitle → video` path end-to-end, verified by an E2E test.

**Duration:** 1 Sprint (Milestone 5 spans Sprints 8–10; Sprint-004 covers the MVP scope).

**Primary Metric:** A job that starts with a topic and ends with a composed MP4 whose audio, subtitles, and video were each produced by a separate media worker — all returned as **references** (pointers), with no binary data passing through the supervisor.

> **Data-plane rule (ADR-0003):** No binary data through the Orchestrator. Media workers write their output to the shared media output dir (local `/tmp` for MVP, S3 pointer path in production) and return **reference strings** in `new_references` / artifacts. The supervisor stores and forwards pointers only.

---

## 1. Product Backlog (Sprint 4 / Milestone 5)

| ID | Task Name | Description | Priority |
| :--- | :--- | :--- | :--- |
| **M5.1** | **Media worker scaffolding + data plane** | Shared media output dir, reference/pointer helpers, common media worker base — the plumbing all three workers share | P0 |
| **M5.2** | **Voice / TTS worker** | Real offline TTS via `espeak-ng` (no quota, no credits) writing WAV/MP3 to the media dir, returns reference | P0 |
| **M5.3** | **Subtitle worker** | SRT generation from the script/narration, returns `.srt` reference | P0 |
| **M5.4** | **Video composer worker** | FFmpeg render (background + narration + subtitles) to MP4, returns reference | P0 |
| **M5.5** | **Wire full pipeline + E2E** | `research → script → voice → subtitle → video` wired end-to-end; E2E asserts artifacts are references and the MP4 exists | P0 |

---

## 2. Detailed Task Breakdown & Acceptance Criteria

### Task M5.1: Media Worker Scaffolding + Data Plane
- **Description:** Provide the shared plumbing every media worker needs: a deterministic media output directory (local `/tmp/fyi-media/<execution_id>/` for MVP, an S3 pointer abstraction for production), helpers to build and return **reference pointers** (relative path + URI scheme), and a stateless BullMQ media-worker base that mirrors the existing worker pattern.
- **Acceptance Criteria:**
  - Shared media output dir resolution keyed by `execution_id` (idempotent, no overwrites per ADR-0003)
  - Reference helper returns a pointer (e.g. `media://<uri>` / relative path) that goes into `new_references`, **never** binary content
  - Base media worker listens on its queue, publishes `WorkerResponse` to `completion-queue` (Contracts v1.1)
  - Works with both local `/tmp` (MVP) and an S3-style pointer interface (stub for MVP)
  - `@fyi/contracts` v1.1 remains **frozen** (no contract changes)
- **Dependencies:** S1.3 (worker pattern), S1.2 (`@fyi/database`)
- **Related Issue:** [Issue M5.1](./Issue-401.md)

### Task M5.2: Voice / TTS Worker
- **Description:** A real `speech-synthesis:voice` worker that turns narration text into an audio file. Use **offline `espeak-ng`** (no API quota, no credits) to synthesize WAV (optionally MP3) into the media dir and return a reference. This avoids the credit-blocked cloud TTS providers.
- **Acceptance Criteria:**
  - Worker capability `speech-synthesis:voice` resolves and executes
  - `espeak-ng` renders narration → WAV (and MP3 if ffmpeg/lame available) under `media/<execution_id>/`
  - Returns an audio **reference** (`media://…` / relative path) in `new_references`
  - Handles missing `espeak-ng` (structured error, non-fatal) and long-text chunking
  - Output file exists and is non-empty; duration roughly matches text length
- **Dependencies:** M5.1
- **Related Issue:** [Issue M5.2](./Issue-402.md)

### Task M5.3: Subtitle Worker
- **Description:** A `subtitle:generate` worker that produces an SRT subtitle file from the script/narration (per-line text + timing) and returns an `.srt` reference. No Whisper/transcription in the MVP — timings are derived from the narration/script.
- **Acceptance Criteria:**
  - Worker capability `subtitle:generate` resolves and executes
  - Generates valid SRT (cue numbers, `HH:MM:SS,mmm --> HH:MM:SS,mmm`, text) from script/narration lines
  - Returns an `.srt` **reference** in `new_references`
  - Timings aligned to the voice/narration duration (from M5.2 output or an estimate)
  - Invalid/empty script handled gracefully (structured error)
- **Dependencies:** M5.1, M5.2
- **Related Issue:** [Issue M5.3](./Issue-403.md)

### Task M5.4: Video Composer Worker
- **Description:** A `video:compose` worker that renders a finished MP4 via **FFmpeg** — background/color source + narration audio + burned-in subtitles — and returns a reference. No asset library in the MVP.
- **Acceptance Criteria:**
  - Worker capability `video:compose` resolves and executes
  - FFmpeg command renders MP4 (background + audio from M5.2 + subtitles from M5.3)
  - Handles missing ffmpeg / invalid inputs (structured error)
  - Returns an MP4 **reference** in `new_references`
  - Output MP4 exists, non-empty, with audio stream present (ffprobe check)
- **Dependencies:** M5.1, M5.2, M5.3
- **Related Issue:** [Issue M5.4](./Issue-404.md)

### Task M5.5: Wire Full Pipeline + E2E
- **Description:** Hook all three media workers into the supervisor routing so a single job flows `research → script → voice → subtitle → video`, and add an E2E test proving the pipeline completes with media artifacts returned as references.
- **Acceptance Criteria:**
  - Supervisor routing + `model_policy.yaml` cover `speech-synthesis:voice`, `subtitle:generate`, `video:compose`
  - Full pipeline `research:real → script:real → voice → subtitle → video` reaches COMPLETED
  - E2E asserts every media artifact is a **reference** (no binary in artifacts) and the MP4 file exists on disk
  - No regression to M1–M4 pipelines (research → script → COMPLETED)
  - `pnpm run typecheck` and `pnpm run build` pass; E2E passes
- **Dependencies:** M5.2, M5.3, M5.4
- **Related Issue:** [Issue M5.5](./Issue-405.md)

---

## 3. Recommended Implementation Order (The "Critical Path")

1. **M5.1 (Media scaffolding + data plane)** — shared dir + reference helpers before any worker writes media.
2. **M5.2 (Voice / TTS)** — produces the narration audio everything downstream needs.
3. **M5.3 (Subtitle)** — depends on narration; can be parallel-friendly once M5.1 lands.
4. **M5.4 (Video Composer)** — consumes voice + subtitle outputs.
5. **M5.5 (Wire + E2E)** — full pipeline integration + verification.

---

## 4. Definition of Done (DoD)

A task is "Done" when:
1. Code complies with Engineering Standards v1.0 (naming, logging, errors).
2. Component implements Contracts v1.1 (unchanged — contracts remain frozen).
3. Unit tests pass (if applicable).
4. Security: no binary data through the orchestrator; all media returned as references (ADR-0003); no plaintext secrets.
5. Integration verified (CLI or E2E) for the touched surface — output media file exists and is referenced, not embedded.

---

## 5. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Binary data leaking through orchestrator** | High | Medium | Reference-only discipline (ADR-0003); E2E asserts artifacts are pointers, never binary |
| **FFmpeg / espeak-ng not installed in env** | Medium | Medium | Structured non-fatal errors; document install; fallback to a stub render for CI |
| **Long narration → huge/unwieldy media files** | Medium | Medium | Chunk text in TTS; size limits + cleanup of `media/<execution_id>/` |
| **Contract drift (reference fields)** | Medium | Low | Contracts v1.1 frozen; map into existing `new_references` / artifacts only |
| **Media artifacts lost on worker retry** | Medium | Low | Deterministic per-`execution_id` paths (ADR-0003 idempotency) prevent overwrites; step-level retry |

---

## 6. Cross-References

- **Architecture:** [mvp-architecture.md](../../architecture/mvp-architecture.md) — §Media / Reference-Based Data Plane
- **ADR:** [ADR-0003 (Reference-Based Data Plane)](../../adr/ADR-0003-reference-based-data-plane.md) — no binary through orchestrator
- **Roadmap:** [roadmap.md](../../architecture/roadmap.md) — Milestone 5 (Media Workers)
- **Contracts:** [contracts.md](../../architecture/contracts.md) — `new_references`, `TaskEnvelope`, `WorkerResponse`
- **Engineering Standards:** [engineering-standards.md](../../architecture/engineering-standards.md)
- **Prior sprint:** [Sprint-003/README.md](../Sprint-003/README.md) — Knowledge Layer + Memory (M4)
