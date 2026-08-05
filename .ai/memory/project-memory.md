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
| 2026-08-04 | Implementation | **S1.1 Done:** Root pnpm workspace (`package.json`, `pnpm-workspace.yaml`), `docker-compose.yml` (Postgres 15 + Redis 7, both healthy), `.env.example`. `@fyi/contracts` v1.1.0 created + built (valid `dist/` with type defs). Verified: `pnpm install`, `docker compose up -d`, `pnpm --filter @fyi/contracts build`, runtime export check. |
| 2026-08-04 | Contracts | **Note:** Issue-001.md contains an outdated v1.0 draft (missing `contract_version`, `tenant_id`, `worker_id`, `worker_version`, `new_references`, `WAITING_APPROVAL`, `WorkerError`). Implemented authoritative v1.1 from `contracts.md`/CLAUDE.md instead. |
| 2026-08-04 | Implementation | **S1.2 Done:** `@fyi/database` created. Prisma schema mirrors authoritative `jobs`+`telemetry` from contracts.md (§1.4/§1.6) — JSONB `recipe_snapshot`/`artifacts`, snake_case, indexes, FK cascade, `JobStatus` incl. `WAITING_APPROVAL`. Migrated (`20260804081303_init`), client generated. CRUD smoke test: 14 assertions passed. |
| 2026-08-04 | Implementation | **Note:** pnpm 11 reads build-script allowlist from `pnpm-workspace.yaml` `onlyBuiltDependencies`, NOT `package.json`. Required for prisma/esbuild postinstall engines. |
| 2026-08-04 | Contracts | **Note:** Issue-002.md draft schema is outdated (no `tenant_id`, `current_step_index`, `WAITING_APPROVAL`, `worker_id`/`worker_version`/`provider`/`model` in telemetry). Implemented authoritative v1.1. |
| 2026-08-04 | Implementation | **S1.3 Done:** `@fyi/utils` created (redis factory + pino logger). 3 mock workers (research/script/voice) built as stateless BullMQ adapters, Contracts v1.1, publish to `completion-queue`. Queue smoke tests passed for all 3 (contract_version, execution_id echo, status, usage/performance). Structured JSON logging with job_id+execution_id verified. |
| 2026-08-04 | Contracts | **Note:** Issue-003.md draft worker pattern is outdated (uses `status: 'success'`, `usage.tokens`, `WorkerCapability` enum, `@fyi/utils/redis` path). Implemented authoritative v1.1 (`WorkerStatus`, `usage.tokens_in/out`, `capability: string`, `@fyi/utils`). |
| 2026-08-04 | Dependencies | **Note:** Local MVP workers reference `@fyi/contracts`/`@fyi/utils` via `workspace:*` for dev resolution; published containers should use pinned versions (standalone). pnpm `onlyBuiltDependencies` also needs `msgpackr-extract` (bullmq native dep). |
| 2026-08-04 | Build | **Note:** Root `build`/`typecheck`/`clean` scripts now filter `packages/**`, `workers/**`, `services/**`. |
| 2026-08-04 | Implementation | **S1.4 Done:** `@fyi/supervisor` created. SupervisorKernel (poll+dispatch, context assembly via input_mapping), StepRunner (artifacts merge, telemetry, approval gate, COMPLETED), completion worker, bootstrap. Integration test passes consistently (job PENDING→research→script→voice→COMPLETED, artifacts+_references merged, 3 telemetry rows). |
| 2026-08-04 | Architecture | **Key fix:** Poll loop dispatches ONLY PENDING jobs; RUNNING step chaining is driven exclusively by StepRunner.onStepSucceeded. Initial impl double-dispatched steps (poll loop + completion callback) → race, out-of-order artifacts. Resolved by exclusive single-writer chain. |
| 2026-08-04 | Contracts | **Note:** Issue-004.md draft supervisor is outdated (enum `WorkerCapability`, statuses `RESEARCHING/SCRIPTING/VOICING` not in JobStatus v1.1, `@fyi/utils/redis` path). Implemented authoritative v1.1 (`capability: string`, `JobStatus` RUNNING/WAITING_APPROVAL/COMPLETED/FAILED). |
| 2026-08-04 | Contracts | **Note:** WorkerResponse has no `step_id`; supervisor derives completing step from `job.current_step_index`. |
| 2026-08-04 | Implementation | **S1.5 Done:** `@fyi/cli` created. `npm run start-skeleton ["topic"]` seeds a job, spawns 3 workers + supervisor as child processes, monitors DB every 2s, prints status transitions, exits on COMPLETED with final artifacts. Verified end-to-end; job appears in `jobs` table (COMPLETED, step_index=3) + 3 telemetry rows. |
| 2026-08-04 | Contracts | **Note:** Issue-005.md draft CLI is outdated (`WorkerCapability` enum, statuses `RESEARCHING/SCRIPTING/VOICING`, `SupervisorKernel.startJob()` which doesn't exist). Supervisor polls DB for PENDING jobs, so the CLI seeds a PENDING job and lets workers+supervisor pick it up. |
| 2026-08-04 | Implementation | **Note:** tsx doesn't auto-load `.env`; CLI must `Object.assign(process.env, loadEnv())` before the first prisma query. |
| 2026-08-04 | Implementation | **S1.6 Done:** Vitest E2E suite in `tests/` (`@fyi/tests` package). `npm run test:e2e` spins up 3 workers + supervisor, seeds a job, asserts artifacts (research/script/voice nested + _references), cost aggregation, duration per step, and failure detection (unresolvable capability → FAILED). 4 tests pass consistently. |
| 2026-08-04 | Build | **Milestone 1 COMPLETE:** All 6 Sprint 1 issues done. Skeleton Run works: `npm run start-skeleton "topic"` drives a job through research→script→voice→COMPLETED with artifacts + telemetry. |
| 2026-08-04 | Dependencies | **Note:** `tests/*` must be a workspace member (`packages: ["tests"]`) for `@fyi/*` resolution; the glob is `tests` not `tests/*`. pnpm stale `ignoredBuilds` in `node_modules/.modules.yaml` can break the internal status check — clear the file or `pnpm rebuild` when a newly-added native dep (e.g. esbuild/vitest) isn't in `onlyBuiltDependencies`. |
| 2026-08-04 | Architecture | **ADR-0006 (Accepted):** User-Configurable Provider Connections & Capability-Filtered Model Selection. Founder feature: users connect API keys per provider (like Hermes) + pick models per capability, showing only connected + capable models. Implemented as the Milestone 2 (AI Platform Foundation) foundation. See `.ai/adr/ADR-0006-...md`. |
| 2026-08-04 | Architecture | **ADR-0007 (Accepted):** Milestone 2 redefined as "AI Platform Foundation (BYOAI)" — Provider Registry, Connection Manager, Model Registry, Capability Registry, ModelGate v2. Product pivot to "AI Orchestration Platform for Creative Production". Roadmap expanded to 7 milestones / 16 sprints. Contracts v1.1 remain frozen. |
| 2026-08-04 | Implementation | **Milestone 2 / Sprint 2 Done (S2.1–S2.5):** `@fyi/platform` package. Prisma schema: `provider_connections`, `model_registry`, `capability_registry`. Provider catalog (9 providers), Connection Manager (connect/list/disconnect, key_ref only, no plaintext), Model Registry + Capability Registry seeded from `model_policy.yaml`, ModelGate v2 (capability → connected providers → models → policy → match). CLI `npm run fyi provider connect|list|disconnect|select|models|resolve`. 7 unit tests (ModelGate) + integration smoke pass. |
| 2026-08-04 | Architecture | **Key design:** ModelGate v2 is a utility (not a service), preserving Thin Orchestrator (ADR-0004). For local MVP, API keys live in env vars (.env git-ignored); DB stores only `key_ref`; a real vault (HashiCorp/AWS Secrets Manager) is the production path. |

---

*Append new entries at the top. Never delete or modify historical entries.*