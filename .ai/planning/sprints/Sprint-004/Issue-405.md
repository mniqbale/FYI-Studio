---
title: "Issue M5.5: Wire Full Pipeline research → script → voice → subtitle → video + E2E"
issue_id: "M5.5"
sprint: "Sprint-004"
source: "mvp-architecture.md (Reference-Based Data Plane) / ADR-0003"
status: "done"
priority: "P0"
estimated_complexity: "L"
estimated_hours: 12
created: "2026-08-05"
tags: [media-workers, pipeline, e2e, integration, ffmpeg]
---

# Issue M5.5: Wire Full Pipeline `research → script → voice → subtitle → video` + E2E

## Goal

Hook all three media workers (M5.2–M5.4) into the supervisor routing so a single job flows `research → script → voice → subtitle → video`, and add an E2E test proving the pipeline completes with media artifacts returned as **references** (no binary through the orchestrator).

## Scope

- Supervisor routing + `model_policy.yaml` cover `speech-synthesis:voice`, `subtitle:generate`, `video:compose`
- Full pipeline `research:real → script:real → voice → subtitle → video` reaches COMPLETED
- E2E asserts every media artifact is a reference and the MP4 file exists on disk
- **NOT in scope:** new AI adapters, asset library, platform encoding profiles

## Deliverables

- Supervisor routing / policy wiring for the three media capabilities
- E2E test covering the full media pipeline

## Acceptance Criteria

- [ ] Supervisor routing + `model_policy.yaml` cover `speech-synthesis:voice`, `subtitle:generate`, `video:compose`
- [ ] Full pipeline `research:real → script:real → voice → subtitle → video` reaches COMPLETED
- [ ] E2E asserts every media artifact is a **reference** (no binary in artifacts) and the MP4 file exists on disk
- [ ] No regression to M1–M4 pipelines (research → script → COMPLETED)
- [ ] `@fyi/contracts` v1.1 remains frozen
- [ ] `pnpm run typecheck` and `pnpm run build` pass; E2E passes

## Security

- Reference-only discipline preserved through the pipeline (ADR-0003); no binary in artifacts.

## Cross-References

- **Sprint:** [Sprint-004/README.md](../README.md)
- **Depends on:** [Issue M5.2](./Issue-402.md), [Issue M5.3](./Issue-403.md), [Issue M5.4](./Issue-404.md)
- **ADR:** [ADR-0003 (Reference-Based Data Plane)](../../adr/ADR-0003-reference-based-data-plane.md)
- **Real-AI workers (M3):** [Issue S2.4](../../sprints/Sprint-002/Issue-204.md), `@fyi/ai` adapters
- **E2E suite:** [Issue S1.6](../../sprints/Sprint-001/Issue-006.md)
