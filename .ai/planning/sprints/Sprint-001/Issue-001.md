---
title: "Issue S1.1: Workspace & Infrastructure Initialization"
issue_id: "S1.1"
sprint: "Sprint-001"
source: "Concept-11.md"
status: "done"
priority: "P0"
estimated_complexity: "S"
estimated_hours: 4
created: "2026-08-04"
tags: [workspace, infrastructure, contracts, docker, monorepo]
---

# Issue S1.1: Workspace & Infrastructure Initialization

## Goal

Establish the foundational monorepo structure, shared contracts, and local development infrastructure (Postgres/Redis).

## Background

FYI Studio utilizes a Microkernel architecture. To ensure consistency across the Supervisor and various Workers, we require a central monorepo where `@fyi/contracts` serves as the source of truth.

## Scope

- Initialize an NPM/PNPM Workspace monorepo.
- Implement the approved **Contracts v1.1** in TypeScript.
- Configure Docker Compose for backing services.
- **NOT in scope:** Production deployment configurations or CI/CD pipelines.

## Deliverables

- `/package.json` (Root workspace config)
- `/docker-compose.yml` (Postgres 15+, Redis 7+)
- `/packages/contracts/package.json`
- `/packages/contracts/src/index.ts` (Approved v1.1 interfaces)
- `/packages/contracts/tsconfig.json`

## Dependencies

None.

## Acceptance Criteria

- [ ] `npm install` at root installs all dependencies.
- [ ] `docker-compose up -d` starts Postgres and Redis without errors.
- [ ] `npm run build -w @fyi/contracts` produces a valid `/dist` folder with type definitions.

## Testing

- Verify `@fyi/contracts` exports all enums and interfaces via a simple test script.
- Verify connectivity to Postgres and Redis using standard CLI tools (psql/redis-cli).

## Risks

- **Version mismatch between Node.js environments.**

## Definition of Done

Infrastructure is up, and contracts are compiled and available for internal import.

## Implementation Notes

### Contracts v1.1 Interfaces (Reference)

The following interfaces must be implemented in `/packages/contracts/src/index.ts`:

```typescript
// Enums
enum JobStatus { PENDING, RUNNING, COMPLETED, FAILED }
enum WorkerCapability { RESEARCH, SCRIPTING, VOICE }

// Core Interfaces
interface TaskEnvelope {
  job_id: string;
  execution_id: string;
  capability: WorkerCapability;
  payload: Record<string, any>;
  recipe_snapshot: ProductionRecipe;
  context: Record<string, any>;
}

interface WorkerResponse {
  execution_id: string;
  status: 'success' | 'failure';
  output: Record<string, any>;
  usage: { cost_estimate: number; tokens: number };
  performance: { duration_ms: number; started_at: string; finished_at: string };
  errors?: string[];
}

interface ProductionRecipe {
  id: string;
  version: string;
  steps: RecipeStep[];
}

interface RecipeStep {
  capability: WorkerCapability;
  input_mapping: Record<string, string>;
  output_keys: string[];
}

interface JobRecord {
  id: string;
  status: JobStatus;
  recipe_id: string;
  recipe_snapshot: ProductionRecipe;
  artifacts: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
}

interface TelemetryRecord {
  id: string;
  job_id: string;
  execution_id: string;
  capability: WorkerCapability;
  duration_ms: number;
  cost_estimate: number;
  tokens_used: number;
  timestamp: Date;
}
```

## Cross-References

- **Sprint Plan:** [Sprint-001/README.md](../README.md)
- **Implementation Strategy:** [../../implementation-strategy.md](../../implementation-strategy.md)
- **Architecture:** [Architecture Decision Records](../../../architecture/)
- **Contracts Spec:** [Contracts v1.1](../../../contracts/contracts-v1.1.md)