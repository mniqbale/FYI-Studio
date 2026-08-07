---
id: rc1-baseline
title: "FYI Studio RC1 — AI Platform Foundation Baseline"
owner: "CTO"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-07"
review_cycle: "per-release"
tags: [rc1, release-candidate, baseline, ai-platform-foundation, freeze, governance]
related_documents:
  - "current-state.md"
  - "project-memory.md"
  - "ADR-0011-capability-only-worker-invariant.md"
  - "ADR-0012-media-engine-unified-lifecycle.md"
  - "youtube-oauth-provisioning.md"
---

# FYI Studio RC1 — AI Platform Foundation Baseline

> **Status:** PROPOSED (pending Founder approval at Sprint Review). This document
> defines the **RC1 baseline** — a stable, frozen foundation that subsequent
> milestones build upon. RC1 is NOT a feature release; it is a **governance
> freeze** of the AI Platform Foundation + the capability-only architecture.

---

## 1. Purpose

RC1 locks the architectural foundation so that:
- Every future milestone builds on a **stable, verified baseline**.
- No contract or architecture decision silently drifts.
- The team can point to a single, reproducible state as "the foundation."

RC1 is the answer to: *"What is the minimum stable core we can build everything
else on?"*

---

## 2. Scope (What RC1 Covers)

### 2.1 Architecture Invariants (Frozen)
| Invariant | ADR | Status |
|-----------|-----|--------|
| Workers speak only to Capabilities (never Vendor/Engine) | ADR-0011 | ✅ Implemented + verified |
| MediaEngine unifies lifecycle (standardize process, not data) | ADR-0012 | ✅ Implemented + verified |
| Single source of truth for policy + provider base URLs | Perbaikan D | ✅ Implemented |
| Contracts v1.1 frozen | ADR-0002 | ✅ |

### 2.2 Capability-Only Workers (All 5 real workers)
- **research-real** — capability `research:real`
- **script-real** — capability `text-synthesis:script:real`
- **voice-real** — capability `voice:tts` (MediaEngine)
- **subtitle-real** — capability `subtitle:generate` (MediaEngine)
- **video-real** — capability `video:compose` (MediaEngine)

All verified: **zero vendor/engine identifiers in worker logic** (grep-clean).

### 2.3 MediaEngine (ADR-0012)
- `runMediaEngine` lifecycle runner (resolve → select → run → error → telemetry → cost → refs)
- Voice/Subtitle/Video engines implement the unified contract
- Video multi-asset payload stays typed (anti-leaky-abstraction)

### 2.4 Single Source of Truth
- **Policy:** `model_policy.yaml` (via `loadModelPolicy` / `resolvePolicy`)
- **Provider base URLs:** `getProviderBaseUrl` (provider-registry)
- **Capability → queue:** `CAPABILITY_QUEUE` (supervisor config)

### 2.5 Dashboard (read-only surface)
- AI Providers table + usability badges
- Model Assignment for all workers
- Tenants CRUD, social accounts, schedule calendar, platform analytics
- HITL Approve/Revise (ADR-0010)
- Opt-in auth (`DASHBOARD_AUTH_TOKEN`)

### 2.6 OAuth YouTube + Real Analytics (workstream 1→2→3)
- OAuth provisioning (Connect YouTube button)
- Real analytics ingestion via OAuth token
- Dashboard wiring (YouTube Connected status)

---

## 3. Verification Evidence (RC1 Gate)

| Check | Result |
|-------|--------|
| `pnpm run typecheck` (full monorepo) | ✅ exit 0 |
| `pnpm run build` (full monorepo) | ✅ exit 0 |
| Unit tests | ✅ **124 pass** (platform 20, ai 7, media 15, publish 33, dashboard 36, analytics 13) |
| ADR-0011 #2 (grep vendor in workers) | ✅ PASS (all 5 workers clean) |
| ADR-0012 (runMediaEngine in all media workers) | ✅ PASS |
| Working tree | ✅ clean |
| Git tag | `rc1` |

---

## 4. Out of Scope (Deferred to Next Milestones)

- **OAuth YouTube live credentials** — code is ready; needs `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` provisioned (see `youtube-oauth-provisioning.md`).
- **Secret vault** (HashiCorp Vault / AWS Secrets Manager) — currently AES-256-GCM + env.
- **Observability** (log aggregation, metrics, alerting).
- **Learning loop / knowledge graph** (the "media intelligence platform" north-star).
- **Image/Music/Avatar engines** — MediaEngine contract is ready for them.

---

## 5. RC1 Definition of Done

- [x] All architecture invariants (ADR-0011/0012) implemented + verified
- [x] Single source of truth for policy + base URLs
- [x] Full typecheck + build pass
- [x] 124 unit tests pass
- [x] Working tree clean
- [x] Git tag `rc1` created
- [x] Sprint Review document produced
- [ ] **Founder approval** (this document status → Accepted)

---

## 6. Approval

**RC1 baseline is approved when the Founder signs off at the Sprint Review.**
Upon approval, this document's status changes to **Accepted** and the git tag
`rc1` becomes the official baseline for all subsequent milestones.
