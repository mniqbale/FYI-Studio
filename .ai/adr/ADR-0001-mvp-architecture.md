---
id: ADR-0001-mvp-architecture
title: "Adopt Thin Orchestrator MVP Architecture"
status: "Accepted"
date: "2026-08-04"
deciders: ["Founder", "CTO", "Principal Engineer", "SRE"]
tags: [architecture, mvp, orchestrator, microkernel, supervisor]
source_conversation: "Concept-5.md (Internal Architecture Review Meeting #04)"
---

# ADR-0001: Adopt Thin Orchestrator MVP Architecture

## Context

The Architecture Review Board (Founder, CTO, Principal Engineer, SRE) debated the "Battle of the Bus" — whether to build the full Microkernel V2 architecture (Model Router, Worker Registry, Plugin SDK, Cost Intelligence Layer) or ship a simplified version.

**Key concerns raised:**
- **Founder:** "We're two weeks in and don't have a video yet. The Manifesto is great for Series B pitch, but it's slowing us down. Why am I hearing about a 'Model Router'? Just use GPT-4o. I need a video on a channel by Friday."
- **Principal Engineer:** "The Model Router is a solution looking for a problem. A `config.json` with a mapping is a router. A class called `ModelRouter` with an interface and three adapters is a waste of my life."
- **CTO:** "If we hardcode GPT-4o, we're dead in six months when a cheaper model comes out and we have to rewrite 12 workers. We need a thin abstraction. It's not just about choice; it's about *swapping* when rate limits hit."
- **SRE:** "If the 'CEO' Orchestrator is doing everything, and it fails, I have zero visibility into where the job died. If a 1GB video render fails at 99%, does the 'Stateless Worker' just start over? Because that's $2 in compute and 20 minutes of time gone."
- **Principal Engineer:** "That's why the 'Context Bus' is a bad idea. We shouldn't be passing data. If I have to pass a 500MB video file through a Redis-backed bus to a Subtitle Worker, the SRE is going to have a heart attack."
- **SRE:** "The egress alone will bankrupt us."

**Consensus reached:** Strip the SDK, Registry Service, and complex Router. Build a "Thin Orchestrator" with a persistent Job Ledger, Sidecar Worker pattern, Reference-Based Data Plane, and a YAML-based Model Config.

## Decision

**Adopt the MVP Architecture v1.0 as defined in Concept-5.md:**

### 1. Thin Orchestrator (Supervisor)
- Simple Node.js service using **BullMQ (Redis)** for job persistence
- Reads "Production Recipe" (JSON) and moves Job through states: `PENDING` → `RESEARCHING` → `SCRIPTING` → etc.
- Every step's output saved to **Job Ledger** (PostgreSQL)
- Failed steps retryable from that specific step

### 2. Worker Interface (Sidecar Pattern)
- **No SDK.** Workers are standalone web services (FastAPI/Express) deployed in containers
- Standard interface: `POST /execute` endpoint
- Receives `TaskEnvelope` with: `metadata` (TenantID, JobID), `payload`, `references` (S3 URIs)
- Workers can have **Local Cache** for performance but treat every request as new task

### 3. Data Plane (Reference-Based / Pointer System)
- **LAW:** No binary data (images/video/audio) ever travels through the Orchestrator
- Workers write to shared S3/R2 bucket and return URI to Orchestrator
- Orchestrator passes URI to next Worker

### 4. Model Config (Poor Man's Router)
- Instead of Router service: `model_policy.yaml` maps Capabilities to Providers
  - `scripting: gpt-4o`
  - `summarization: claude-3-haiku`
- Workers call single internal `ModelGate` utility that reads this config

### 5. Knowledge Base (Flattened Brain)
- MVP Scope: PostgreSQL table `tenant_context`
- Context Injection: Supervisor queries `tenant_context` for `brand_voice` and appends to prompt
- No vector DB for MVP unless niche specifically requires long-term memory

### 6. Human-In-The-Loop (Pause State)
- Workflows can have `type: human_approval` step
- Job status moves to `AWAITING_APPROVAL`, Queue stops
- Simple Dashboard UI allows human to edit result in Job Ledger and click "Resume"

### 7. Observability & Costs
- Every Worker returns `usage` (tokens/seconds) in response
- Centralized logs via Loki/Datadog; every log line includes `Job_ID`

### 8. Revised Roadmap (Ship-Fast Plan)
| Week | Focus | Deliverables |
|------|-------|--------------|
| 1 | The Kernel | PostgreSQL, BullMQ, Supervisor core, Job Ledger schema |
| 2 | Creative Stack | Research, Script, Voice Workers; hardcode YouTube API for one channel |
| 3 | Media Stack | Video Composer (FFmpeg), Subtitle Worker |
| 4 | The Loop | UI Dashboard for Human Approval, first End-to-End production run |

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **Full Microkernel V2** (Registry, Router, SDK, Cost Intelligence) | Over-engineering for zero users/revenue; 3+ months to build "ghost developer" interfaces; "Orchestration Tax" bottleneck at scale |
| **Hardcode GPT-4o everywhere** | Vendor lock-in; no swap capability when rate limits hit; dead in 6 months per CTO |
| **Chained Worker Architecture** (Worker A calls Worker B) | No central state awareness; cascade failures; cross-contamination of logic across 100+ channels |

## Consequences

### Positive
- **Shippable in 4 weeks** — All four roles (Founder, CTO, PE, SRE) can build/monitor/scale this
- **Traceable** — Every step in Job Ledger, SRE can retry from failure point
- **Cost-aware** — Telemetry per job from day one
- **No data gravity bankruptcy** — Reference-based data plane eliminates egress costs
- **Extensible** — Can add Registry/Router/SDK later when actually needed

### Negative
- **Manual model switching** — Edit YAML instead of policy engine (acceptable for MVP)
- **No capability discovery** — Static worker map (acceptable for <10 workers)
- **No plugin ecosystem** — Monorepo functions only (acceptable for internal team)

## Implementation Notes

1. **First code task:** Issue S1.1 — Workspace & Infrastructure Initialization
2. **Contracts v1.1 frozen** — See ADR-0002
3. **Reference-based data plane mandated** — See ADR-0003
4. **Thin Orchestrator pattern** — See ADR-0004
5. **Engineering Standards v1.0 mandatory** — See ADR-0005

---

**Approval:** Founder ("I can sell this. It's fast."), SRE ("I can monitor this. It's traceable."), PE ("I can build this. It's simple."), CTO ("I can scale this. The foundations are solid.")