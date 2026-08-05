---
title: "Issue M5.4: Video Composer Worker (video:compose)"
issue_id: "M5.4"
sprint: "Sprint-004"
source: "mvp-architecture.md (Reference-Based Data Plane) / ADR-0003"
status: "done"
priority: "P0"
estimated_complexity: "L"
estimated_hours: 14
created: "2026-08-05"
tags: [media-workers, video, ffmpeg, compose, mp4]
---

# Issue M5.4: Video Composer Worker (`video:compose`)

## Goal

Build a `video:compose` worker that renders a finished MP4 via **FFmpeg** — background/color source + narration audio + burned-in subtitles — and returns a **reference**. No asset library in the MVP. No binary through the orchestrator (ADR-0003).

## Scope

- `video:compose` worker resolving and executing
- FFmpeg render: background/color source + audio (from M5.2) + subtitles (from M5.3) → MP4
- Return an MP4 **reference** in `new_references`
- Handle missing ffmpeg / invalid inputs (structured error)
- **NOT in scope:** asset library / B-roll, multi-format platform encoding profiles, overlay system

## Deliverables

- `video:compose` worker implementation
- Unit test(s) for render / ffprobe check / missing-tool error

## Acceptance Criteria

- [ ] Worker capability `video:compose` resolves and executes
- [ ] FFmpeg command renders MP4 (background + audio from M5.2 + subtitles from M5.3)
- [ ] Handles missing ffmpeg / invalid inputs (structured error)
- [ ] Returns an MP4 **reference** in `new_references`
- [ ] Output MP4 exists, non-empty, with audio stream present (ffprobe check)
- [ ] `@fyi/contracts` v1.1 remains frozen

## Security

- Media returned as reference only (ADR-0003); no binary in artifacts.

## Cross-References

- **Sprint:** [Sprint-004/README.md](../README.md)
- **Depends on:** [Issue M5.1](./Issue-401.md), [Issue M5.2](./Issue-402.md), [Issue M5.3](./Issue-403.md)
- **ADR:** [ADR-0003 (Reference-Based Data Plane)](../../adr/ADR-0003-reference-based-data-plane.md)
- **Worker base:** [Issue S1.3](../../sprints/Sprint-001/Issue-003.md)
