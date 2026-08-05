---
title: "Issue M5.3: Subtitle Worker (subtitle:generate)"
issue_id: "M5.3"
sprint: "Sprint-004"
source: "mvp-architecture.md (Reference-Based Data Plane) / ADR-0003"
status: "done"
priority: "P0"
estimated_complexity: "S"
estimated_hours: 6
created: "2026-08-05"
tags: [media-workers, subtitles, srt, subtitle]
---

# Issue M5.3: Subtitle Worker (`subtitle:generate`)

## Goal

Build a `subtitle:generate` worker that produces an SRT subtitle file from the script/narration (per-line text + timing) and returns an `.srt` **reference**. **No Whisper/transcription in the MVP** — timings are derived from the narration/script. No binary through the orchestrator (ADR-0003).

## Scope

- `subtitle:generate` worker resolving and executing
- Generate valid SRT from script/narration lines
- Timings aligned to the voice/narration duration (from M5.2 output or an estimate)
- Return an `.srt` **reference** in `new_references`
- **NOT in scope:** Whisper transcription, VTT, timing from audio analysis

## Deliverables

- `subtitle:generate` worker implementation
- Unit test(s) for SRT validity / timing / empty-script error

## Acceptance Criteria

- [ ] Worker capability `subtitle:generate` resolves and executes
- [ ] Generates valid SRT (cue numbers, `HH:MM:SS,mmm --> HH:MM:SS,mmm`, text) from script/narration lines
- [ ] Returns an `.srt` **reference** in `new_references`
- [ ] Timings aligned to the voice/narration duration (from M5.2 output or an estimate)
- [ ] Invalid/empty script handled gracefully (structured error)
- [ ] `@fyi/contracts` v1.1 remains frozen

## Security

- Media returned as reference only (ADR-0003); no binary in artifacts.

## Cross-References

- **Sprint:** [Sprint-004/README.md](../README.md)
- **Depends on:** [Issue M5.1](./Issue-401.md), [Issue M5.2](./Issue-402.md)
- **ADR:** [ADR-0003 (Reference-Based Data Plane)](../../adr/ADR-0003-reference-based-data-plane.md)
- **Worker base:** [Issue S1.3](../../sprints/Sprint-001/Issue-003.md)
