---
title: "Issue M5.1: Media Worker Scaffolding + Data Plane"
issue_id: "M5.1"
sprint: "Sprint-004"
source: "mvp-architecture.md (Reference-Based Data Plane) / ADR-0003"
status: "done"
priority: "P0"
estimated_complexity: "M"
estimated_hours: 8
created: "2026-08-05"
tags: [media-workers, scaffolding, data-plane, references, utils]
---

# Issue M5.1: Media Worker Scaffolding + Data Plane

## Goal

Provide the shared plumbing every media worker needs — a deterministic media output directory, reference/pointer helpers, and a stateless BullMQ media-worker base. **No binary data through the orchestrator** (ADR-0003): workers write media to local `/tmp` (MVP) or S3 (production) and return **reference pointers only**.

## Scope

- Shared media output dir resolution keyed by `execution_id`
- Reference helper that builds a pointer string (e.g. `media://<uri>` / relative path) for `new_references`
- Base media worker (stateless BullMQ adapter, listens on `<x>-queue`, publishes `WorkerResponse` to `completion-queue`)
- Media output dir helpers + reference helpers in `@fyi/utils` (or a new `@fyi/media` package)
- **NOT in scope:** Voice/TTS (M5.2), Subtitle (M5.3), Video Composer (M5.4), pipeline wiring (M5.5)

## Deliverables

- Media output dir + reference/pointer helpers (in `@fyi/utils` or `@fyi/media`)
- Base media worker template used by M5.2–M5.4

## Acceptance Criteria

- [ ] Media output dir resolves deterministically per `execution_id` (idempotent, no overwrites per ADR-0003)
- [ ] Reference helper returns a pointer, never binary content
- [ ] Base media worker publishes `WorkerResponse` to `completion-queue` (Contracts v1.1)
- [ ] Works with local `/tmp` (MVP) and an S3-style pointer interface (stub for MVP)
- [ ] `@fyi/contracts` v1.1 remains frozen (no contract changes)

## Security

- No binary data through the orchestrator; artifacts are references only (ADR-0003).
- No plaintext secrets in references or helpers.

## Cross-References

- **Sprint:** [Sprint-004/README.md](../README.md)
- **Architecture:** [mvp-architecture.md](../../architecture/mvp-architecture.md) — Reference-Based Data Plane
- **ADR:** [ADR-0003 (Reference-Based Data Plane)](../../adr/ADR-0003-reference-based-data-plane.md)
- **Worker base:** [Issue S1.3](../../sprints/Sprint-001/Issue-003.md)
