---
title: "Issue M5.2: Voice / TTS Worker (speech-synthesis:voice)"
issue_id: "M5.2"
sprint: "Sprint-004"
source: "mvp-architecture.md (Reference-Based Data Plane) / ADR-0003"
status: "done"
priority: "P0"
estimated_complexity: "M"
estimated_hours: 10
created: "2026-08-05"
tags: [media-workers, tts, voice, espeak-ng, speech-synthesis]
---

# Issue M5.2: Voice / TTS Worker (`speech-synthesis:voice`)

## Goal

Build a real `speech-synthesis:voice` worker that turns narration text into an audio file. Use **offline `espeak-ng`** (no API quota, no credits — cloud TTS providers are credit-blocked) to synthesize WAV (optionally MP3) into the media dir and return a **reference**. No binary through the orchestrator (ADR-0003).

## Scope

- `speech-synthesis:voice` worker resolving and executing
- `espeak-ng` renders narration → WAV (and MP3 if ffmpeg/lame available) under `media/<execution_id>/`
- Return an audio **reference** in `new_references`
- Long-text chunking + missing-tool handling
- **NOT in scope:** cloud TTS adapters (ElevenLabs/Azure/OpenAI — post-MVP), Whisper transcription, subtitle generation (M5.3)

## Deliverables

- `speech-synthesis:voice` worker implementation
- Unit test(s) for chunking / reference return / missing-tool error

## Acceptance Criteria

- [ ] Worker capability `speech-synthesis:voice` resolves and executes
- [ ] `espeak-ng` renders narration → WAV (and MP3 when available) under `media/<execution_id>/`
- [ ] Returns an audio **reference** (`media://…` / relative path) in `new_references`
- [ ] Handles missing `espeak-ng` (structured, non-fatal error) and long-text chunking
- [ ] Output file exists and is non-empty; duration roughly matches text length
- [ ] `@fyi/contracts` v1.1 remains frozen

## Security

- Media returned as reference only (ADR-0003); no binary in artifacts.
- No plaintext secrets; local tool execution only.

## Cross-References

- **Sprint:** [Sprint-004/README.md](../README.md)
- **Depends on:** [Issue M5.1](./Issue-401.md)
- **ADR:** [ADR-0003 (Reference-Based Data Plane)](../../adr/ADR-0003-reference-based-data-plane.md)
- **Worker base:** [Issue S1.3](../../sprints/Sprint-001/Issue-003.md)
