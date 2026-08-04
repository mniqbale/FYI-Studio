---
title: "Issue S1.2: Database Layer Implementation (The Ledger)"
issue_id: "S1.2"
sprint: "Sprint-001"
source: "Concept-11.md"
status: "ready"
priority: "P0"
estimated_complexity: "S"
estimated_hours: 4
created: "2026-08-04"
tags: [database, prisma, ledger, job-ledger, telemetry]
---

# Issue S1.2: Database Layer Implementation (The Ledger)

## Goal

Implement the Job Ledger and Telemetry storage using Prisma ORM.

## Background

The Job Ledger is the system of record. Every state transition and worker output must be persisted here to satisfy the "Stateless Worker" requirement.

## Scope

- Setup `@fyi/database` package.
- Define Prisma schema for `jobs` and `telemetry`.
- Configure `JSONB` support for the `artifacts` and `recipe_snapshot` columns.
- **NOT in scope:** Complex relational queries or database indexing for scale.

## Deliverables

- `/packages/database/prisma/schema.prisma`
- `/packages/database/src/index.ts` (Exported Prisma Client)
- Migration files for initial table creation.

## Dependencies

- S1.1 (Workspace & Infra Initialization)

## Acceptance Criteria

- [ ] Prisma Client is successfully generated.
- [ ] A test script can create a `job` with a JSON `recipe_snapshot` and retrieve it.
- [ ] Database schema follows `snake_case` naming conventions for columns as per Engineering Standards v1.0.

## Testing

- Run `prisma migrate dev` to ensure schema validity.
- CRUD test: Create a job, update its status to `RUNNING`, and verify the `updated_at` timestamp changes.

## Risks

- **Handling TypeScript types for JSONB fields in Prisma.**

## Definition of Done

Database schema is deployed to local Postgres and accessible via the internal package.

## Implementation Notes

### Prisma Schema (Reference)

```prisma
// /packages/database/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Job {
  id              String   @id @default(uuid())
  status          JobStatus @default(PENDING)
  recipe_id       String
  recipe_snapshot Json     // ProductionRecipe as JSONB
  artifacts       Json?    // Combined worker outputs
  created_at      DateTime @default(now()) @map("created_at")
  updated_at      DateTime @updatedAt @map("updated_at")
  completed_at    DateTime? @map("completed_at")

  telemetry Telemetry[]

  @@map("jobs")
}

model Telemetry {
  id              String   @id @default(uuid())
  job_id          String   @map("job_id")
  execution_id    String   @map("execution_id")
  capability      WorkerCapability @map("capability")
  duration_ms     Int      @map("duration_ms")
  cost_estimate   Float    @map("cost_estimate")
  tokens_used     Int      @map("tokens_used")
  timestamp       DateTime @default(now()) @map("timestamp")

  job Job @relation(fields: [job_id], references: [id], onDelete: Cascade)

  @@map("telemetry")
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

enum WorkerCapability {
  RESEARCH
  SCRIPTING
  VOICE
}
```

### Database Client Export

```typescript
// /packages/database/src/index.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

## Cross-References

- **Sprint Plan:** [Sprint-001/README.md](../README.md)
- **Implementation Strategy:** [../../implementation-strategy.md](../../implementation-strategy.md)
- **Issue S1.1:** [Issue-001.md](./Issue-001.md)
- **Issue S1.3:** [Issue-003.md](./Issue-003.md)
- **Architecture:** [Architecture Decision Records](../../../architecture/)
- **Contracts Spec:** [Contracts v1.1](../../../contracts/contracts-v1.1.md)
- **Engineering Standards:** [Engineering Standards v1.0](../../../standards/engineering-standards-v1.0.md)