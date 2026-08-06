---
id: ADR-0008-social-publish-scheduling
title: "Social Publish & Scheduling (YouTube-First Monetization)"
status: "Accepted"
date: "2026-08-06"
deciders: ["Founder", "Lead Engineer", "Principal Architect", "CTO"]
tags: [post-mvp, publish, scheduling, social, youtube, monetization, bullmq, social-accounts]
source_conversation: "Founder post-MVP review feedback (Milestone 8 Dashboard review)"
---

# ADR-0008: Social Publish & Scheduling (YouTube-First Monetization)

> **Status:** ACCEPTED (Founder approval 2026-08-06). This ADR records the architecture for Workstream B — publishing approved content to social platforms (YouTube Channel, Facebook, Instagram, TikTok) on a schedule. YouTube is the primary monetization target.

## Context

The MVP produces a full video (research → script → voice → subtitle → video) and leaves the final artifact in the Job Ledger for human review on the Dashboard. To realize monetization, the Founder must be able to get that approved content onto live social platforms. The current system has **no path from "approved artifact" to "published content"**.

The Founder's post-MVP review feedback explicitly named **Publish & Scheduling** as a core monetization workstream. The primary target is **YouTube Channel**, with Facebook, Instagram, and TikTok as secondary targets.

**Key requirements surfaced during the Dashboard review:**
1. A publishing worker that posts an approved video artifact to a connected social platform.
2. A scheduler that runs approved content at a chosen date/time.
3. A registry of connected social accounts (per tenant), with OAuth credentials.
4. Publishing is a **write operation to an external platform** — it is deliberately NOT part of the read-only Dashboard. It is a background worker concern, triggered on an approved job.

**Design tension with existing invariants:** The Dashboard (Milestone 8 / ADR-0001) is strictly read-only. Publishing must therefore not be implemented as a Dashboard write. Instead, publishing is a **worker + scheduler** concern: an approved job is enqueued to a `publish-queue`, a publishing worker performs the platform API call, and the result is recorded back in the Job Ledger (artifacts + telemetry). The scheduler (BullMQ repeatable jobs, infra already exists per ADR-0004) triggers publication at the scheduled time.

## Decision

**Adopt a Social Publish & Scheduling subsystem built on the existing BullMQ queue infrastructure and a new Publishing Worker.**

### 1. Social Account Registry (new DB table `social_accounts`)
- New Prisma table `social_accounts` storing, per `tenant_id`: platform (`youtube` | `facebook` | `instagram` | `tiktok`), display name, channel/account reference, **OAuth credential reference** (`token_ref`, not plaintext — mirrors the `provider_connections.key_ref` pattern from ADR-0006/0007), `enabled`, `connected_at`, `last_sync_at`.
- Credential material stored via the secret manager path (env vars for local MVP; encrypted vault for production) — same policy as ADR-0006.
- One account row per (tenant, platform) pair; a tenant may connect multiple platforms.

### 2. Scheduled Publishes (new DB table `scheduled_publishes`)
- New Prisma table `scheduled_publishes` storing, per `tenant_id`: `job_id` (the approved job whose video to publish), `social_account_id`, `scheduled_at`, `status` (`scheduled` | `publishing` | `published` | `failed`), `platform_response` (JSONB: platform id, URL, error), `attempts`, timestamps.
- This is the **source of truth** for what to publish and when; the BullMQ repeatable scheduler polls or is fed by this table.

### 3. Publishing Worker (`services/publish` / `workers/publish-real`)
- New worker that consumes a `publish-queue` and performs the platform upload via a platform adapter (YouTube Data API v3 `videos.insert`, etc.).
- Given a `TaskEnvelope`-like job referencing an approved video artifact (file pointer, not binary — honors ADR-0003), it uploads the media to the target platform and writes the resulting platform URL back into `scheduled_publishes.platform_response` and into `jobs.artifacts.published`.
- Platform adapters are pluggable (YouTube-first); Facebook/Instagram/TikTok are follow-on adapters behind the same interface.

### 4. Scheduler (BullMQ repeatable jobs)
- A BullMQ **repeatable job** (per ADR-0004 queue infra) runs on an interval and finds due `scheduled_publishes` rows (`status = scheduled` AND `scheduled_at <= now`), enqueues each to the `publish-queue`, and marks them `publishing`.
- This keeps scheduling decoupled from any interactive UI: no Dashboard write needed to publish.

### 5. Relationship to the read-only Dashboard
- The Dashboard remains read-only (ADR-0001). To schedule a publish, the Founder uses a **new Settings/Write surface** (Workstream A, Milestone 9) or the existing CLI. Publishing itself is **always a background worker** — the Dashboard never calls a platform API.
- This preserves the invariant that platform interactions happen in scheduled cron workers, not on page load.

### 6. YouTube-first monetization
- The first platform adapter targets YouTube Channel via the **YouTube Data API v3** (`videos.insert`). Quota budgeting for this is defined in ADR-0009 (Platform Analytics & Revenue) since uploads share the same quota budget as analytics reads.

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **Publish directly from the Dashboard on click** | Violates the read-only Dashboard invariant (ADR-0001); couples platform calls to page-load/click paths; breaks the "no platform API on page load" constraint. |
| **Use a third-party scheduling SaaS (Buffer/Hootsuite)** | Adds external dependency + cost + vendor lock-in; the orchestration platform should own its publish pipeline for monetization control; YouTube-first needs direct Data API access for revenue analytics (ADR-0009). |
| **File-based publish (manual upload)** | Not scalable for scheduling; no platform API integration for revenue tracking. |
| **Temporal.io / external scheduler** | Overkill; BullMQ repeatable jobs already exist in the stack (ADR-0004); no new infra. |

## Consequences

### Easier
- **Monetization path** — approved content can reach YouTube and drive revenue (primary goal).
- **Reuse of queue infra** — BullMQ repeatable jobs + existing worker pattern (ADR-0004) minimize new moving parts.
- **Decoupled from UI** — publishing is a background worker concern; the Dashboard stays read-only.
- **Pluggable platforms** — a common adapter interface allows Facebook/Instagram/TikTok to be added without re-architecting.

### Harder / Risks
- **OAuth credential security** — the highest risk. Must mirror the ADR-0006/0007 policy: `token_ref` in DB, credential material in the secret manager, never plaintext/logged.
- **Platform API variance** — each platform has different upload semantics, rate limits, and quota. YouTube-first scopes this; others deferred.
- **Failed uploads** — must be retryable with backoff (Supervisor-controlled per ADR-0004) and surface structured `WorkerError`.
- **Quota coupling** — YouTube uploads (1,600 units) share the 10,000 units/day free quota with analytics reads (ADR-0009); publishing cadence must be quota-aware.
- **New tables** — `social_accounts` + `scheduled_publishes` are additive; Contracts v1.1 remain frozen (no change to `TaskEnvelope`/`WorkerResponse`).

## Implementation Notes

- New Prisma migration adds `social_accounts` and `scheduled_publishes`.
- New package `services/publish` (scheduler + worker orchestration) or `workers/publish-real` (platform adapter) — follow the Dashboard/supervisor package pattern.
- YouTube adapter uses YouTube Data API v3 `videos.insert`; scoped to upload for the primary target.
- Scheduler = BullMQ repeatable job on a configurable interval (e.g. every 60s) polling `scheduled_publishes` for due rows.
- On publish success, write the platform video URL to `scheduled_publishes.platform_response` and `jobs.artifacts.published`.
- Contracts v1.1 remain frozen; publishing enqueues reference pointers only (ADR-0003).

## Architecture Impact on Existing ADRs

| ADR | Impact |
|-----|--------|
| **ADR-0001 (MVP Architecture)** | Read-only Dashboard invariant preserved — publishing is a background worker, not a Dashboard write. |
| **ADR-0002 (Contracts v1.1)** | No change — frozen; publishing uses existing `TaskEnvelope`/artifact reference patterns. |
| **ADR-0003 (Reference-Based Data Plane)** | Honored — uploads use file pointers; no binary through the orchestrator. |
| **ADR-0004 (Thin Orchestrator)** | Extends the queue topology with a `publish-queue` + BullMQ repeatable scheduler; Supervisor remains the single-writer to job status. |
| **ADR-0005 (Engineering Standards)** | No change — error handling, logging, testing standards apply to the publish worker. |
| **ADR-0006 / 0007 (Provider Connection)** | Reused pattern for OAuth credential storage (`token_ref`); social accounts are a new credential class alongside provider connections. |
| **ADR-0009 (Platform Analytics)** | Shared YouTube Data API quota budget; uploads (1,600 units) and analytics reads (ADR-0009) must be jointly budgeted. |

## Status

**Proposed** — pending Founder approval. On approval, this is implemented as **Milestone 10 / Sprint 9** (see `.ai/planning/sprints/Sprint-009/`).

---

**Approval:** Founder (Product/Monetization), Lead Engineer (Implementation Feasibility), Principal Architect (Architectural Integrity), CTO (Scalability & Vendor Independence).
