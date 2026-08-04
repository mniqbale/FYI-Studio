---
title: "Implementation Strategy: Milestone 1 - The Skeleton Run"
version: "1.0"
source: "Concept-7.md"
created: "2026-08-04"
status: "active"
tags: [implementation-strategy, milestone-1, skeleton-run, planning]
---

# Implementation Strategy: Milestone 1 - "The Skeleton Run"

## Executive Summary

As Lead Engineer, my goal is to eliminate all friction. We are building the plumbing, not the penthouse. We will use a **Monorepo** to share TypeScript interfaces across the Supervisor and Workers, ensuring contract compliance from day zero.

---

## 1. Repository Structure (Monorepo)

We will use a simple directory-based monorepo. No complex build tools like Turborepo yet—just npm workspaces.

```text
/fyi-studio
  /packages
    /contracts (Shared TS Interfaces: TaskEnvelope, WorkerResponse)
    /database  (Prisma/Drizzle schema & migrations)
  /services
    /supervisor (The Core Kernel)
  /workers
    /research (Mock)
    /script   (Mock)
    /voice    (Mock)
  docker-compose.yml
  package.json
```

---

## 2. Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Language** | TypeScript | Type-safe contracts across services |
| **Runtime** | Node.js | Mature ecosystem, native TypeScript support |
| **Database** | PostgreSQL | Job Ledger - ACID compliance, JSONB support |
| **Orchestration** | BullMQ + Redis | Job Queue & Worker Communication |
| **ORM** | Prisma | Fastest way to iterate on the Job Ledger |

---

## 3. Development Order (The "Inside-Out" Build)

| Phase | Task | Description | Timeline |
|-------|------|-------------|----------|
| 1 | **Infra** | Spin up Docker Compose (Postgres + Redis) | Day 1 |
| 2 | **Contracts** | Port the approved schemas into `@fyi/contracts` | Day 1 |
| 3 | **The Ledger** | Initialize Prisma and push the `jobs` table to Postgres | Day 1 |
| 4 | **Mock Workers** | Build three small scripts that listen to BullMQ queues (`research-queue`, `script-queue`, `voice-queue`) and return mock JSON | Day 2 |
| 5 | **The Supervisor** | Build the "Step-Runner" logic - looks at a job, sees it finished "Research," and moves it to the "Scripting" queue | Day 2-3 |
| 6 | **The Trigger Script** | A CLI command to inject the first `ProductionRecipe` into the DB | Day 3 |

---

## 4. What is Deliberately Postponed

- **No UI:** All interaction is via CLI and Database queries.
- **No Cloud:** Everything runs in Docker on `localhost`. No S3; we will use local `/tmp` folders for "references."
- **No Actual AI:** `Math.random()` and `setTimeout` will simulate AI latency and results.
- **No Error Recovery:** If a worker crashes, the job stays "running" forever. (Retries come in Milestone 3).
- **No Auth:** Zero security. Open access to the internal network.

---

## 5. Milestone 1 Acceptance Criteria

1. A command `npm run start-job` creates a row in the `jobs` table.
2. The `supervisor` detects the job and assigns it to `research-worker`.
3. The `research-worker` logs "Processing Research" and updates the job after 2 seconds.
4. The `supervisor` automatically hands the result to `script-worker`.
5. The `voice-worker` completes the final step.
6. The `jobs` table shows status: `completed` and the `artifacts` column contains the combined JSON of all three workers.

---

## 6. Expected Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Race Conditions** | High | Medium | Use PostgreSQL `UPDATE` with row locking or ensure the Supervisor is the *only* writer to the `status` column. |
| **Queue Congestion / BullMQ Complexity** | Medium | High | Keep a single Redis instance and very simple queue names. |

---

## 7. Testing Strategy

- **Happy Path E2E:** A single automated script that triggers the job and polls the database until `status === 'completed'`. If it doesn't complete in 30 seconds, the test fails.

---

## 8. Definition of Done (DoD)

**Milestone 1 is "Done" when a single `job_id` has successfully transitioned through the states `pending` -> `researching` -> `scripting` -> `voicing` -> `completed` using the **approved Contract schemas** and the final result is verifiable in the database.**

---

## 9. Projected Milestone Sequence (Updated per Architecture Review Meeting #05)

| Milestone | Focus | Projected Sprints |
|-----------|-------|-------------------|
| **M1: Skeleton Run** | Infra, Contracts, Mock Workers, Supervisor, CLI, E2E | Sprint 1 (Complete) |
| **M2: AI Platform Foundation** | Provider Registry, Connection Manager, Model Registry, Capability Registry, ModelGate v2 | Sprints 2–3 |
| **M3: Cognitive Core** | Research Worker (Real AI), Script Worker (Real AI) | Sprints 4–5 |
| **M4: Knowledge Layer + Memory** | Brand Profiles, Vector Store, Context Assembly | Sprints 6–7 |
| **M5: Media Workers** | Voice, Video, Subtitles, Asset Library | Sprints 8–10 |
| **M6: Multi-Tenant** | Tenant Registry, Policy Engine, Worker Registry v2, Dashboard | Sprints 11–13 |
| **M7: Analytics & Auto-Optimization** | Analytics Workers, Learning Loop, Cost Intelligence | Sprints 14–16 |

---

## 10. Cross-References

- **Architecture:** [Architecture Decision Records](../architecture/)
- **Contracts:** [Contracts v1.1](../contracts.md)
- **Engineering Standards:** [Engineering Standards v1.0](../engineering-standards.md)
- **Sprint 1 Plan:** [Sprint-001/README.md](./sprints/Sprint-001/README.md)
- **GitHub Issues:** [GitHub Issues Export](./github-issues.md)
- **ADR:** [ADR-0007 AI Platform Foundation](../adr/ADR-0007-ai-platform-foundation.md)