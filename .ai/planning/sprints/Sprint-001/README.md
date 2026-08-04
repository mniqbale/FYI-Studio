---
title: "Sprint 1: The Skeleton Run - Sprint Planning"
version: "1.0"
source: "Concept-10.md"
sprint: "Sprint-001"
status: "planned"
created: "2026-08-04"
tags: [sprint-planning, sprint-1, skeleton-run, backlog]
---

# Sprint 1 Planning: The Skeleton Run

**Goal:** Execute a single media production job through three mock workers (Research -> Script -> Voice) orchestrated by the Supervisor, using the approved Contracts v1.1 and Engineering Standards v1.0.

**Duration:** 1 Sprint (7 days equivalent)
**Primary Metric:** Time to First Completed Job (TFCJ).

---

## 1. Product Backlog (Sprint 1)

| ID | Task Name | Description | Priority |
| :--- | :--- | :--- | :--- |
| **S1.1** | **Workspace & Infra Init** | Setup monorepo, Docker Compose (Postgres/Redis), and `@fyi/contracts`. | P0 |
| **S1.2** | **Database Layer** | Implement Prisma schema and `@fyi/database` client package. | P0 |
| **S1.3** | **Mock Worker Suite** | Implement 3 stateless mock workers (Research, Script, Voice). | P0 |
| **S1.4** | **Supervisor: Kernel** | Core loop: State management, Job Ledger updates, and Queue dispatching. | P0 |
| **S1.5** | **Skeleton Run CLI** | Trigger script to seed a recipe and initiate the first Job. | P1 |
| **S1.6** | **E2E Test Suite** | Automated test to verify the state transitions of a single job. | P1 |

---

## 2. Detailed Task Breakdown & Acceptance Criteria

### Task S1.1: Workspace & Infra Initialization

- **Description:** Setup the root `package.json` with workspaces, `docker-compose.yml` for Postgres/Redis, and initialize the `@fyi/contracts` package with the approved v1.1 code.
- **Acceptance Criteria:**
  - `docker-compose up` starts Postgres and Redis.
  - `@fyi/contracts` compiles successfully.
- **Dependencies:** None.
- **Related Issue:** [Issue S1.1](./Issue-001.md)

### Task S1.2: Database Layer (The Ledger)

- **Description:** Create the Prisma schema reflecting the Job Ledger and Telemetry tables. Generate the client.
- **Acceptance Criteria:**
  - `jobs` table supports `artifacts` JSONB.
  - `telemetry` table is linked to `jobs`.
  - Migrations run successfully against the local Postgres.
- **Dependencies:** S1.1.
- **Related Issue:** [Issue S1.2](./Issue-002.md)

### Task S1.3: Mock Worker Suite

- **Description:** Create three minimal Node.js services. They listen to specific BullMQ queues, wait 2 seconds (simulating AI), and return a valid `WorkerResponse` with mock data.
- **Acceptance Criteria:**
  - Each worker validates its output against `WorkerResponse` v1.1.
  - Workers log `job_id` and `execution_id` for every task.
- **Dependencies:** S1.1, S1.2.
- **Related Issue:** [Issue S1.3](./Issue-003.md)

### Task S1.4: Supervisor Core (The Kernel)

- **Description:** The "Brain." It must:
  1. Listen to a "completion" queue from workers.
  2. Update the Job Ledger with worker output.
  3. Determine the next step in the Recipe.
  4. Dispatch a `TaskEnvelope` to the next worker's queue.
- **Acceptance Criteria:**
  - Successfully handles the transition from Research -> Scripting.
  - Moves job status to `COMPLETED` after the final step.
- **Dependencies:** S1.2, S1.3.
- **Related Issue:** [Issue S1.4](./Issue-004.md)

### Task S1.5: Skeleton Run CLI

- **Description:** A Node.js CLI script that seeds a `ProductionRecipe` and a `Job` into the DB. Monitors the DB every 2 seconds and prints the status to the console.
- **Acceptance Criteria:**
  - Running `npm run start-skeleton` initiates a job.
  - The CLI outputs the status changes in real-time (e.g., "Researching...", "Scripting...").
  - The CLI exits with a success message once the final artifact is in the DB.
- **Dependencies:** S1.1, S1.2, S1.4.
- **Related Issue:** [Issue S1.5](./Issue-005.md)

### Task S1.6: End-to-End Test Suite

- **Description:** Implement a Vitest/Jest integration test. The test must: Spin up infra, seed a job, wait for completion, and assert the contents of the `artifacts` column.
- **Acceptance Criteria:**
  - Test passes consistently in the local development environment.
  - Assertions verify that `usage.cost_estimate` is correctly aggregated.
  - Assertions verify that `performance.duration_ms` is recorded for every step.
- **Dependencies:** S1.1 through S1.5.
- **Related Issue:** [Issue S1.6](./Issue-006.md)

---

## 3. Recommended Implementation Order (The "Critical Path")

To minimize blockers, implementation must follow this exact sequence:

1. **S1.1 (Infra):** You cannot write DB code without a DB.
2. **S1.2 (Ledger):** The Supervisor and Workers both need the Ledger.
3. **S1.3 (Mock Workers):** We build the "employees" before the "CEO" has anyone to manage.
4. **S1.4 (Supervisor):** The "CEO" is the glue that connects the employees to the Ledger.
5. **S1.5 (CLI):** The spark that starts the first fire.
6. **S1.6 (E2E Tests):** The safety net that ensures it all works.

---

## 4. Definition of Done (DoD)

A task is "Done" when:

1. Code complies with **Engineering Standards v1.0** (naming, logging, etc.).
2. Component implements **Contracts v1.1**.
3. Unit tests pass (if applicable).
4. The Lead Engineer (Board) has reviewed the specific **Implementation Plan** and resulting code.

---

## 5. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **BullMQ/Redis Latency** | High | Medium | Use robust BullMQ "completed" listeners with persistent state checks in Postgres. |
| **Schema Mismatch** | High | Medium | Define explicit Zod or class-validator schemas for the `artifacts` column. |

---

## 6. Execution: First Task

The first coding task for the AI agent is **Task S1.1: Workspace & Infra Initialization.**

### Request for Implementation Plan: S1.1

AI Agent, before writing code, please provide an **Implementation Plan** for **Task S1.1** following the Engineering Standards:

1. Define the `package.json` workspace structure.
2. Define the `docker-compose.yml` services.
3. Verify the `@fyi/contracts` project structure.
4. List the files to be created.

---

## 7. Cross-References

- **Implementation Strategy:** [implementation-strategy.md](../implementation-strategy.md)
- **GitHub Issues:** [github-issues.md](../github-issues.md)
- **Architecture:** [Architecture Decision Records](../architecture/)
- **Contracts:** [Contracts v1.1](../contracts/contracts-v1.1.md)
- **Engineering Standards:** [Engineering Standards v1.0](../standards/engineering-standards-v1.0.md)