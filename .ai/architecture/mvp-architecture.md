---
id: mvp-architecture
title: FYI Studio MVP Architecture v1.0
owner: Founder, CTO, Principal Engineer, SRE
status: Approved
version: 1.0.0
last_updated: "2026-08-05"
review_cycle: per-sprint
tags: [architecture, mvm, orchestrator, worker-interface, data-plane, model-config, knowledge-base, hitl, observability, roadmap]
related_documents:
  - system-architecture.md
  - microkernel-architecture.md
  - architecture-manifesto.md
  - contracts.md
related_adr: []
related_sprint:
  - "../planning/sprints/Sprint-001"
  - "../planning/sprints/Sprint-002"
  - "../planning/sprints/Sprint-003"
---

# Purpose

This document captures the consensus MVP Architecture v1.0 for FYI Studio, resulting from the Internal Architecture Review (Meeting #04). It replaces the V1 Manifesto for the purposes of the MVP and defines the minimal, shippable architecture that all four roles (Founder, CTO, Principal Engineer, SRE) can build, monitor, and scale.

# Background

The debate centered on the "Battle of the Bus" - whether to build the full Microkernel V2 (Model Router, Worker Registry, Plugin SDK) or ship a simplified version. The consensus: strip the SDK, Registry Service, and complex Router. Build a "Thin Orchestrator" with a persistent Job Ledger, Sidecar Worker pattern, Reference-Based Data Plane, and a YAML-based Model Config.

# Architecture Overview

## 1. The "Thin" Orchestrator (The Supervisor)

### Logic

A simple Node.js/Python service using **BullMQ** (Redis) for job persistence.

### Role

It reads a "Production Recipe" (JSON) and moves a Job through states: `PENDING` -> `RESEARCHING` -> `SCRIPTING` -> etc.

### State Management

Every step's output is saved to a **Job Ledger** (PostgreSQL). If a step fails, the SRE can trigger a retry from that specific step.

## 2. The Worker Interface (The "Sidecar" Pattern)

### Implementation

No SDK. Workers are standalone web services (FastAPI/Express) deployed in containers.

### Standard Interface

Every worker must have one endpoint: `POST /execute`.

### Payload

It receives a `TaskEnvelope` containing:

1. `metadata`: (TenantID, JobID)
2. `payload`: (The actual text/data to process)
3. `references`: (S3 URIs for any media files)

### Statelessness

Workers can have a **Local Cache** for performance but must treat every request as a new task.

## 3. Data Plane (The Pointer System)

### The Law

No binary data (images/video/audio) ever travels through the Orchestrator.

### Mechanism

Workers write to a shared S3/R2 bucket and return the URI to the Orchestrator. The Orchestrator passes that URI to the next Worker.

## 4. The Model Config (The "Poor Man's Router")

Instead of a complex Router service, a `model_policy.yaml` file maps Capabilities to Providers.

- `scripting: gpt-4o`
- `summarization: claude-3-haiku`

Workers call a single internal `ModelGate` utility that reads this config.

## 5. The Knowledge Base (The Flattened Brain)

### MVP Scope

A PostgreSQL table called `tenant_context`.

### Context Injection

When the Orchestrator calls the "Script Worker," it simply queries the `tenant_context` for `brand_voice` and appends it to the prompt. No vector DB for the MVP unless the niche specifically requires long-term memory.

## 6. Human-In-The-Loop (The "Pause" State)

- Workflows can have a `type: human_approval` step.
- The Job status moves to `AWAITING_APPROVAL`. The Queue stops.
- A simple Dashboard UI allows a human to edit the result in the `Job Ledger` and click "Resume," which pushes the Job back into the active queue.

## 7. Observability & Costs

### Telemetry

Every Worker must return `usage` (tokens/seconds) in its response.

### Logging

Centralized logs via Loki/Datadog. Every log line must include `Job_ID`.

# Revised Roadmap (The "Ship-Fast" Plan, Updated per Architecture Review Meeting #05)

| Phase | Focus | Deliverables | Status |
|-------|-------|--------------|--------|
| **Sprint 1** | **The Kernel (Milestone 1)** | Setup PostgreSQL, BullMQ, and the "Supervisor" core. Define the `Job Ledger` schema. `TaskEnvelope`/`WorkerResponse` contracts. ModelGate + `model_policy.yaml`. Mock workers. E2E test. | ✅ **Complete** |
| **Sprints 2–3** | **AI Platform Foundation (Milestone 2)** | Provider Registry, Connection Manager, Model Registry, Capability Registry, ModelGate v2, CLI for provider management. | ✅ **Complete** |
| **Sprints 4–5** | **The Cognitive Core (Milestone 3)** | Research Worker (real AI), Script Worker (real AI). Real AI integration end-to-end via Ollama Cloud. | ✅ **Complete** |
| **Sprints 6–7** | **Knowledge Layer + Memory (Milestone 4)** | Brand Profiles, Style Guides, `tenant_context` table, Context Assembly Engine, Memory Layer. **NO vector DB in MVP.** | 🔄 **In Progress / Next** |
| **Sprints 8–10** | **The Media Stack (Milestone 5)** | Voice Worker (ElevenLabs → S3). Video Composer (FFmpeg, downloads from S3). Subtitle Worker. Asset Library Worker. Pointer system validated. | Planned |
| **Sprints 11–13** | **Multi-Tenant Scale (Milestone 6)** | Tenant Registry, Policy Engine, Worker Registry v2, A/B Testing, Dashboard UI. | Planned |
| **Sprints 14–16** | **Analytics & Learning Loop (Milestone 7)** | Analytics Workers, Auto-Optimization Engine, Cost Intelligence, A/B Orchestration. | Planned |

# Final Decision Request

**Founder:** "I can sell this. It's fast."

**SRE:** "I can monitor this. It's traceable."

**PE:** "I can build this. It's simple."

**CTO:** "I can scale this. The foundations are solid."

**Do you approve the MVP Architecture v1.0? If so, we move to Phase 2: Defining the Schema for the Job Ledger and the Task Envelope.**

# References

- Concept-5.md (source conversation: Internal Architecture Review Meeting #04)
- system-architecture.md (V1 foundation)
- microkernel-architecture.md (V2 evolution - reference for what was explicitly removed)
- architecture-manifesto.md (governing principles)