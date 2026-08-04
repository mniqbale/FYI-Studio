---
id: memory-readme
title: "Project Memory Index"
owner: "Documentation Architect"
status: "active"
version: "1.0.0"
last_updated: "2026-08-04"
review_cycle: "per-sprint"
tags: [memory, project-history, decisions, lessons-learned]
---

# Project Memory

> **Append-only.** Never remove history. Store major decisions, architecture evolution, lessons learned, rejected ideas, important discoveries.

---

## Memory Log

| Date | Category | Entry |
|------|----------|-------|
| 2026-08-04 | Architecture | **ADR-0001:** Adopted Thin Orchestrator MVP Architecture over full Microkernel V2. Consensus from Founder, CTO, PE, SRE. |
| 2026-08-04 | Contracts | **ADR-0002:** Froze Contracts v1.1 with strict enums, execution_id, attempt tracking, separated usage/performance, worker identity. |
| 2026-08-04 | Data Plane | **ADR-0003:** Mandated Reference-Based Data Plane (S3 pointers only). No binary data through Orchestrator. |
| 2026-08-04 | Orchestrator | **ADR-0004:** Thin Orchestrator with BullMQ + PostgreSQL. Supervisor = sole writer to job status. |
| 2026-08-04 | Standards | **ADR-0005:** Adopted Engineering Standards v1.0 (naming, errors, idempotency, logging, testing, deps, PR checklist). |
| 2026-08-04 | Architecture | **Rejected:** Full Microkernel V2 (Worker Registry, Model Router Service, Plugin SDK, Cost Intelligence Layer) — over-engineering for 0 users. |
| 2026-08-04 | Architecture | **Rejected:** Chained Worker Architecture — no central state awareness, cascade failures. |
| 2026-08-04 | Architecture | **Rejected:** Hardcoded GPT-4o everywhere — vendor lock-in, dead in 6 months per CTO. |
| 2026-08-04 | Data Plane | **Rejected:** Data Bus (binary through Orchestrator) — egress costs bankrupt us at scale. |
| 2026-08-04 | Architecture | **Key Insight (CTO):** "Orchestration Tax" will kill us at scale — centralized orchestration is bottleneck. Mitigation: Thin Orchestrator. |
| 2026-08-04 | Architecture | **Key Insight (PE):** "Model Router is a solution looking for a problem." → `model_policy.yaml` + `ModelGate`. |
| 2026-08-04 | Architecture | **Key Insight (SRE):** "If 1GB video render fails at 99%, stateless worker starts over = $2 + 20min gone." → Job Ledger with step-level retry. |
| 2026-08-04 | Architecture | **Key Insight (CTO):** "We are a Media OS. Media means Gigabytes." → Reference Bus (S3 pointers). |
| 2026-08-04 | Architecture | **Key Insight (PE):** "Plugin SDK for ghost developers is over-engineering." → Monorepo functions only. |
| 2026-08-04 | Contracts | **Design Decision:** Enums over string unions — single source of truth for values, ripples through system. |
| 2026-08-04 | Contracts | **Design Decision:** `Record<string, unknown>` over `any` — forces validation, prevents silent type assumptions. |
| 2026-08-04 | Contracts | **Design Decision:** `snake_case` for all contract fields — consistency with JSON/DB and external AI APIs. |
| 2026-08-04 | Standards | **Design Decision:** Workers don't retry themselves — flag `retryable`, Supervisor controls backoff. |
| 2026-08-04 | Standards | **Design Decision:** Idempotency keyed by `execution_id` — S3 paths include execution_id to prevent overwrites. |
| 2026-08-04 | Standards | **Design Decision:** pino for structured JSON logging — mandatory `job_id` + `execution_id` in every log line. |

---

*Append new entries at the top. Never delete or modify historical entries.*