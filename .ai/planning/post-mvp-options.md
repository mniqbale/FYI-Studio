---
id: post-mvp-options
title: "Post-MVP Options & Next Phase Decision"
owner: "Lead Engineer (AI Agent) + Founder"
status: "active"
version: "1.0.0"
last_updated: "2026-08-05"
review_cycle: "per-decision"
tags: [post-mvp, options, roadmap, dashboard, analytics, optimization, hardening]
related_documents:
  - "../state/current-state.md"
  - "../architecture/roadmap.md"
  - "dashboard-proposal.md"
  - "orchestration-delegation-brief.md"
---

# Post-MVP Options & Next Phase Decision

> **Context:** The FYI Studio MVP is **COMPLETE** (all 7 milestones). This document records the candidate post-MVP workstreams, trade-offs, and the Founder's decision on what to pursue next. It is the authoritative record of "what comes after the MVP" — referenced by roadmap, planning, and delegation briefs.

---

## 1. The State of the MVP (recap)

The MVP can, end-to-end:

- **Connect BYOAI providers** (`fyi provider connect|list|disconnect|select`)
- **Resolve models by capability** (ModelGate v2 — only connected + capable models)
- **Inject tenant knowledge** (brand voice, style guide, forbidden terms, constraints — M4)
- **Generate a full video** (research → script → voice → subtitle → video; proven: real MP4)
- **Enforce per-tenant policy + cost quota** (M6)
- **Report cost analytics** (per tenant/capability/job; `fyi analytics report`) (M7)

**Working stack (no cloud credit needed):** Ollama Cloud (AI, `deepseek-v4-flash`) + espeak-ng (TTS) + FFmpeg (video/subtitles). PostgreSQL (Job Ledger) + Redis (BullMQ).

---

## 2. Candidate Post-MVP Workstreams

The following options were considered. Each is scored for **user value**, **effort**, and **fit with the Founder's visual-review workflow**.

| # | Option | What it delivers | User value | Est. effort | Fit with visual review |
|---|--------|------------------|-----------|-------------|------------------------|
| **A** | **Dashboard UI** | Web UI to view jobs, tenants, artifacts, cost analytics, video playback | ⭐⭐⭐⭐⭐ | M (8–16h MVP) | ⭐⭐⭐⭐⭐ (Founder reviews visually) |
| **B** | **External analytics ingestion** (YouTube/TikTok/IG) | Ingest real platform metrics → retention curves → Memory Layer feedback | ⭐⭐⭐⭐ | L (16–24h) | ⭐⭐⭐ (charts, but needs live accounts) |
| **C** | **Auto-optimization engine** | Autonomous recipe mutation (script pacing, thumbnail, voice pitch) from retention data | ⭐⭐⭐⭐ | XL (24–40h) | ⭐⭐ (black-box; needs B first) |
| **D** | **A/B orchestration** | Run recipe variants across tenant cohorts, statistical gating, promotion | ⭐⭐⭐ | L (16–24h) | ⭐⭐ |
| **E** | **Worker Registry v2** | Capability-based worker discovery via `manifest.json` | ⭐⭐⭐ | M (8–16h) | ⭐ (infra, not visual) |
| **F** | **Production hardening** | Retry/backoff, error recovery, idempotency audit, real secret vault, real S3/R2 | ⭐⭐⭐⭐ | L (16–24h) | ⭐ (infra, not visual) |

---

## 3. Dependency Map

```
Dashboard (A) ────────────────► independent (can start now; builds on existing telemetry + artifacts)
External analytics (B) ──────► depends on real platform accounts + API keys
Auto-optimization (C) ───────► depends on B (needs retention data to optimize against)
A/B orchestration (D) ───────► depends on C (needs optimization signals) + M6 policy engine
Worker Registry v2 (E) ──────► independent infra improvement
Production hardening (F) ────► independent; prerequisite for any production deployment
```

**Suggested sequencing if multiple are pursued:**
1. **A (Dashboard)** — highest visible value, independent, matches how the Founder works.
2. **F (Hardening)** — before any real production traffic.
3. **B (External analytics)** — only when live platform accounts are available.
4. **C (Auto-optimization)** — last; depends on B.

---

## 4. Founders' Decision (Decision Log)

| Date | Decision | Notes |
|------|----------|-------|
| 2026-08-05 | **Proceed with Option A — Dashboard UI** | Founder: "karena aku human yang akan menggunakan dan melihat prosesnya secara visual." Rationale: highest fit with the visual-review workflow, builds directly on existing telemetry/artifacts, independent of external accounts/credits. |
| 2026-08-06 | **Post-Dashboard workstreams (from Dashboard review): Settings AI Workspace → Social Publish → Platform Analytics** | Founder review feedback named: (1) a **Settings page** — connect AI providers (Claude/Gemini/Ollama/ChatGPT), assign a model per worker task (capability-gated), and CRUD for brand/tenant; (2) **social account integration + scheduled posting** after approval (YouTube Channel, Facebook, Instagram, TikTok) as the core monetization path; (3) **platform analytics incl. YouTube revenue** per content, feeding the Memory Layer for reflection; (4) Dashboard polish (human-readable artifacts + JSON/ZIP download, bibliography/references on /jobs/:id, and a Revise step before approval). **Youtube quota constraint:** Data API v3 is 10k units/day free, 1.6k per upload — platform APIs must NEVER be called on dashboard page load; use scheduled cron workers writing to local tables. See ADR-0008/0009/0010. |

---

## 5. What This Document Is Not

This is a **decision + options record**, not an implementation plan. For the Dashboard's technical proposal, see **[dashboard-proposal.md](./dashboard-proposal.md)**. For the delegation brief to an external AI agent, see **[orchestration-delegation-brief.md](./orchestration-delegation-brief.md)**.

---

## Cross-References

- **State:** [current-state.md](../state/current-state.md)
- **Roadmap:** [roadmap.md](../architecture/roadmap.md)
- **MVP architecture (data plane, thin orchestrator):** [mvp-architecture.md](../architecture/mvp-architecture.md)
