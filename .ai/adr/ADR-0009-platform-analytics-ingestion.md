---
id: ADR-0009-platform-analytics-ingestion
title: "Scheduled Platform Analytics Ingestion (YouTube Revenue, Quota-Budgeted)"
status: "Proposed"
date: "2026-08-06"
deciders: ["Founder", "Lead Engineer", "Principal Architect", "CTO"]
tags: [post-mvp, analytics, ingestion, youtube, revenue, quota, cron, memory-layer]
source_conversation: "Founder post-MVP review feedback (Milestone 8 Dashboard review)"
---

# ADR-0009: Scheduled Platform Analytics Ingestion (YouTube Revenue, Quota-Budgeted)

> **Status:** PROPOSED (pending Founder approval). This ADR records the architecture for Workstream C — ingesting platform analytics (views, likes, comments, watch time, **YouTube revenue per video**) into local tables, under a hard API-quota budget. Results feed back to the Memory Layer as reflection for producing future content.

## Context

The MVP's analytics (Milestone 7) aggregates **internal** telemetry (cost, tokens, duration) from the Job Ledger. It does **not** capture **external** content performance — how many views, likes, comments, minutes of watch time, or how much **revenue** a published video earned. Without this external feedback loop, the platform cannot learn which content performs and which doesn't.

The Founder's post-MVP review feedback named **Platform analytics & content performance** (views, likes, comments, watch time, **YouTube revenue per video**) as a critical workstream. The primary external source is YouTube (via the YouTube Data API v3), consistent with ADR-0008's YouTube-first monetization.

**Critical constraint surfaced in review — YouTube Data API v3 quota:**
- Free quota is **10,000 units/day**.
- **1,600 units per video upload** (ADR-0008).
- Most reads (videos.list, etc.) cost ~1–100 units each depending on the endpoint and parts requested.
- Therefore, the **Dashboard must NEVER call platform APIs on page load**. All platform API calls happen in **scheduled cron workers** that write results to **local tables**. The Dashboard reads only from those local tables.

## Decision

**Adopt a scheduled, cron-driven analytics ingestion pipeline that writes to local tables and feeds the Memory Layer — with a strict YouTube quota budget.**

### 1. Analytics ingestion worker (cron / BullMQ repeatable)
- A new ingestion worker runs on a schedule (BullMQ repeatable job per ADR-0004 infra, or a cron interval) and calls the YouTube Data API v3 to fetch:
  - Per-video stats: views, likes, comments, watch time (minutes), revenue (via YouTube Analytics API when available).
- Results are written to **local PostgreSQL tables** (`platform_metrics`, `video_revenue` — see below).
- The Dashboard and any other read surface read ONLY from these local tables — never from the platform API on page load.

### 2. New DB tables (local analytics store)
- **`platform_metrics`** — per (`tenant_id`, `video_id`, `platform`): snapshot date, views, likes, comments, watch_time_minutes, retention/engagement fields, `fetched_at`.
- **`video_revenue`** — per (`tenant_id`, `video_id`, `platform`): revenue amount, currency, period, `fetched_at`. This is the monetization source for "YouTube revenue per video".
- **`analytics_ingestion_log`** — per run: start/end time, units consumed, status, errors. Used for quota accounting and observability.

### 3. Quota budgeting (hard constraint)
- An ingestion planner maintains a running **quota ledger** for the day (10,000 units/day free).
- Before any run, it checks remaining units; it skips or defers fetches that would exceed the budget rather than risk quota exhaustion.
- **Uploads (1,600 units, ADR-0008) and analytics reads share the same daily budget** — the ledger is joint across both workstreams.
- Configurable per-tenant ingestion cadence (e.g. daily for all videos, more frequent for priority tenants).

### 4. Memory Layer reflection (feedback loop)
- On successful ingestion, the worker writes a `memory_entries` row (kind: `analytics` — the M7/M4 memory pattern) summarizing content performance.
- This reflection is available to the Context Assembly Engine (M4) for producing **future content** — closing the learning loop from performance data back into research/script generation.

### 5. Dashboard integration (read-only)
- The Dashboard gains read-only views of the local `platform_metrics`/`video_revenue` tables (charts: views over time, revenue per video, engagement).
- It NEVER calls a platform API; it only SELECTs from the local tables populated by the ingestion cron. This preserves the read-only invariant (ADR-0001) and the no-platform-API-on-page-load constraint.

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **Dashboard calls the YouTube API on page load** | Violates the hard quota constraint (10k/day free); a single page load burst could exhaust the day's quota and break uploads; explicitly rejected by the Founder. |
| **Eager real-time ingestion on every page view** | Same quota problem; no caching; unpredictable cost. |
| **Third-party analytics SaaS (YouTube Analytics via partner)** | External cost + vendor lock-in; the platform should own its analytics; direct Data API is free within quota. |
| **Store external metrics only in Memory Layer, no local tables** | Loses structured queryability for the Dashboard and quota accounting; local tables are the source of truth for read surfaces. |

## Consequences

### Easier
- **Revenue visibility** — YouTube revenue per video becomes a first-class, queryable metric (primary monetization signal).
- **Dashboard stays fast & safe** — reads come from local tables; page loads never consume platform quota.
- **Learning loop** — performance data feeds the Memory Layer for future content (ADR-0004 memory enrichment pattern extended).
- **Predictable quota usage** — the ledger makes daily consumption explicit and prevents surprise exhaustion.

### Harder / Risks
- **Quota pressure** — the 10k/day budget is shared with uploads (1,600 each). Cadence and parts-selection must be tuned to stay within budget; mitigation is the quota ledger + skip/defer logic.
- **YouTube Analytics API availability** — revenue data requires the YouTube Analytics API, which may require additional permissions/channel eligibility; must be handled gracefully (field may be null).
- **Data latency** — metrics are as fresh as the last cron run (e.g. daily), not real-time; acceptable for content-performance analytics but must be documented.
- **New tables** — `platform_metrics`, `video_revenue`, `analytics_ingestion_log` are additive; Contracts v1.1 remain frozen.
- **Ingestion worker correctness** — must be idempotent (upsert by `video_id` + snapshot date) to avoid double-counting on retries.

## Implementation Notes

- New Prisma migration adds `platform_metrics`, `video_revenue`, `analytics_ingestion_log`.
- New package `services/analytics-ingest` (cron/worker) or extend `@fyi/analytics` with ingestion functions; follow existing package patterns.
- YouTube Data API v3 + YouTube Analytics API clients via `@fyi/ai`-style fetch adapters (no heavy SDK unless preferred).
- Scheduler = BullMQ repeatable job (per ADR-0004) or Node cron; interval configurable.
- Upsert idempotency keyed by (`video_id`, `platform`, snapshot date).
- Write `memory_entries` (kind: `analytics`) on each successful ingestion cycle.
- Contracts v1.1 remain frozen.

## Architecture Impact on Existing ADRs

| ADR | Impact |
|-----|--------|
| **ADR-0001 (MVP Architecture)** | Dashboard remains read-only; platform analytics are ingested locally, never fetched on page load. |
| **ADR-0002 (Contracts v1.1)** | No change — frozen; ingestion reads existing job/artifact reference fields to correlate videos. |
| **ADR-0003 (Reference-Based Data Plane)** | No change — ingestion works from platform IDs/URLs, not binary. |
| **ADR-0004 (Thin Orchestrator)** | Adds an ingestion queue/repeatable job alongside the existing queue topology; Supervisor remains single-writer to job status. |
| **ADR-0005 (Engineering Standards)** | No change — standards apply to the ingestion worker. |
| **ADR-0006 / 0007 (Provider Connection)** | YouTube credential reuse; ingestion is a new consumer of the connected-account (OAuth) credential. |
| **ADR-0008 (Social Publish & Scheduling)** | **Joint quota budget** — uploads (1,600 units) and analytics reads share the same 10k/day YouTube quota; ingestion planner must account for scheduled publishes. |

## Status

**Proposed** — pending Founder approval. On approval, this is implemented as **Milestone 11 / Sprint 10** (see `.ai/planning/sprints/Sprint-010/`).

---

**Approval:** Founder (Product/Revenue), Lead Engineer (Implementation Feasibility), Principal Architect (Architectural Integrity), CTO (Scalability & Cost Control).
