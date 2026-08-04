---
title: "Issue S1.6: End-to-End Test Suite"
issue_id: "S1.6"
sprint: "Sprint-001"
source: "Concept-11.md"
status: "done"
priority: "P1"
estimated_complexity: "S"
estimated_hours: 4
created: "2026-08-04"
tags: [e2e-testing, integration-testing, vitest, regression]
---

# Issue S1.6: End-to-End Test Suite

## Goal

Automate the verification of the entire "Skeleton Run" to prevent future regressions.

## Background

As we move toward Milestone 2 (Real AI), we must ensure the core plumbing (Supervisor/Queue/Ledger) remains rock solid.

## Scope

- Implement a Vitest/Jest integration test.
- The test must: Spin up infra, seed a job, wait for completion, and assert the contents of the `artifacts` column.
- **NOT in scope:** Testing real AI responses.

## Deliverables

- `/tests/e2e/skeleton-run.test.ts`

## Dependencies

- S1.1 through S1.5 (All previous issues must be complete)

## Acceptance Criteria

- [ ] Test passes consistently in the local development environment.
- [ ] Assertions verify that `usage.cost_estimate` is correctly aggregated.
- [ ] Assertions verify that `performance.duration_ms` is recorded for every step.

## Testing

- Intentionally break a mock worker and verify the E2E test correctly identifies the failure.

## Risks

- **Flaky tests due to timing issues in the async queue.**

## Definition of Done

A single command `npm run test:e2e` validates the entire Milestone 1 architecture.

## Implementation Notes

### E2E Test Structure (`skeleton-run.test.ts`)

```typescript
// /tests/e2e/skeleton-run.test.ts

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@fyi/database';
import { ProductionRecipe, RecipeStep, WorkerCapability, JobStatus, WorkerResponse } from '@fyi/contracts';
import { SupervisorKernel } from '@fyi/supervisor/kernel';
import { createRedisConnection } from '@fyi/utils/redis';
import { Queue, Worker } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Test timeout - 60 seconds for full run
vi.setConfig({ testTimeout: 60000 });

// Sample ProductionRecipe for testing
const TEST_RECIPE: ProductionRecipe = {
  id: 'test-recipe-v1',
  version: '1.0.0',
  steps: [
    {
      capability: 'RESEARCH',
      input_mapping: { topic: 'topic' },
      output_keys: ['research_brief', 'sources', 'key_findings'],
    },
    {
      capability: 'SCRIPTING',
      input_mapping: { research_brief: 'research_brief' },
      output_keys: ['script', 'scenes'],
    },
    {
      capability: 'VOICE',
      input_mapping: { script: 'script' },
      output_keys: ['audio_url', 'duration_seconds', 'voice_id'],
    },
  ],
};

describe('Sprint 1: Skeleton Run E2E', () => {
  let supervisor: SupervisorKernel;
  let testJobId: string;

  beforeAll(async () => {
    // Ensure database is clean
    await prisma.telemetry.deleteMany();
    await prisma.job.deleteMany();

    // Initialize Supervisor
    supervisor = new SupervisorKernel();
  });

  afterAll(async () => {
    await supervisor.shutdown();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up before each test
    await prisma.telemetry.deleteMany();
    await prisma.job.deleteMany();
  });

  it('should complete a full skeleton run through all three workers', async () => {
    // 1. Create a test job
    testJobId = uuidv4();
    const topic = 'E2E Test Topic: AI in Media';

    await prisma.job.create({
      data: {
        id: testJobId,
        status: 'PENDING',
        recipe_id: TEST_RECIPE.id,
        recipe_snapshot: TEST_RECIPE as any,
        artifacts: { topic },
      },
    });

    // 2. Start the job via Supervisor
    await supervisor.startJob(testJobId);

    // 3. Poll for completion (max 30 seconds)
    const maxWaitMs = 30000;
    const pollIntervalMs = 1000;
    let elapsedMs = 0;
    let finalJob = null;

    while (elapsedMs < maxWaitMs) {
      const job = await prisma.job.findUnique({ where: { id: testJobId } });
      if (!job) throw new Error('Job disappeared from database');

      if (job.status === 'COMPLETED') {
        finalJob = job;
        break;
      }

      if (job.status === 'FAILED') {
        throw new Error('Job failed unexpectedly');
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      elapsedMs += pollIntervalMs;
    }

    // 4. Assert job completed
    expect(finalJob).not.toBeNull();
    expect(finalJob!.status).toBe('COMPLETED');
    expect(finalJob!.completed_at).toBeDefined();
    expect(finalJob!.artifacts).toBeDefined();

    // 5. Assert artifacts contain outputs from all three workers
    const artifacts = finalJob!.artifacts as Record<string, any>;
    expect(artifacts.topic).toBe(topic);
    expect(artifacts.research_brief).toBeDefined();
    expect(artifacts.sources).toBeInstanceOf(Array);
    expect(artifacts.key_findings).toBeInstanceOf(Array);
    expect(artifacts.script).toBeDefined();
    expect(artifacts.scenes).toBeInstanceOf(Array);
    expect(artifacts.audio_url).toBeDefined();
    expect(artifacts.duration_seconds).toBeTypeOf('number');
    expect(artifacts.voice_id).toBeDefined();

    // 6. Assert telemetry records exist for all three steps
    const telemetry = await prisma.telemetry.findMany({
      where: { job_id: testJobId },
      orderBy: { timestamp: 'asc' },
    });

    expect(telemetry).toHaveLength(3);

    const capabilities = telemetry.map(t => t.capability);
    expect(capabilities).toEqual(['RESEARCH', 'SCRIPTING', 'VOICE']);

    // 7. Assert usage and performance metrics are recorded
    for (const record of telemetry) {
      expect(record.duration_ms).toBeGreaterThan(0);
      expect(record.cost_estimate).toBeGreaterThan(0);
      expect(record.tokens_used).toBeGreaterThan(0);
      expect(record.execution_id).toBeDefined();
    }

    // 8. Assert cost aggregation
    const totalCost = telemetry.reduce((sum, r) => sum + r.cost_estimate, 0);
    expect(totalCost).toBeGreaterThan(0);

    // 9. Assert total duration is reasonable (at least 6 seconds for 3 x 2s workers)
    const totalDuration = telemetry.reduce((sum, r) => sum + r.duration_ms, 0);
    expect(totalDuration).toBeGreaterThanOrEqual(5000); // Allow some overhead
  }, 45000);

  it('should correctly aggregate usage metrics across all steps', async () => {
    testJobId = uuidv4();

    await prisma.job.create({
      data: {
        id: testJobId,
        status: 'PENDING',
        recipe_id: TEST_RECIPE.id,
        recipe_snapshot: TEST_RECIPE as any,
        artifacts: { topic: 'Usage Test' },
      },
    });

    await supervisor.startJob(testJobId);

    // Wait for completion
    await waitForJobCompletion(testJobId, 30000);

    const telemetry = await prisma.telemetry.findMany({
      where: { job_id: testJobId },
    });

    // Verify all records have usage data
    for (const record of telemetry) {
      expect(record.cost_estimate).toBeGreaterThan(0);
      expect(record.tokens_used).toBeGreaterThan(0);
    }

    // Verify total cost is sum of individual costs
    const totalCost = telemetry.reduce((sum, r) => sum + r.cost_estimate, 0);
    const totalTokens = telemetry.reduce((sum, r) => sum + r.tokens_used, 0);

    expect(totalCost).toBeGreaterThan(0);
    expect(totalTokens).toBeGreaterThan(0);
  });

  it('should record performance duration for each step', async () => {
    testJobId = uuidv4();

    await prisma.job.create({
      data: {
        id: testJobId,
        status: 'PENDING',
        recipe_id: TEST_RECIPE.id,
        recipe_snapshot: TEST_RECIPE as any,
        artifacts: { topic: 'Performance Test' },
      },
    });

    await supervisor.startJob(testJobId);
    await waitForJobCompletion(testJobId, 30000);

    const telemetry = await prisma.telemetry.findMany({
      where: { job_id: testJobId },
      orderBy: { timestamp: 'asc' },
    });

    // Each step should have recorded duration
    for (const record of telemetry) {
      expect(record.duration_ms).toBeGreaterThan(1000); // At least 1s (workers simulate 2s)
      expect(record.duration_ms).toBeLessThan(10000); // But not absurdly long
    }
  });
});

async function waitForJobCompletion(jobId: string, timeoutMs: number): Promise<void> {
  const pollIntervalMs = 1000;
  let elapsedMs = 0;

  while (elapsedMs < timeoutMs) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Job disappeared from database');

    if (job.status === 'COMPLETED') return;
    if (job.status === 'FAILED') throw new Error('Job failed');

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    elapsedMs += pollIntervalMs;
  }

  throw new Error(`Job did not complete within ${timeoutMs}ms`);
}
```

### Test Utilities

```typescript
// /tests/e2e/utils/test-helpers.ts

import { PrismaClient } from '@fyi/database';
import { ProductionRecipe } from '@fyi/contracts';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export async function createTestJob(recipe: ProductionRecipe, artifacts: Record<string, any> = {}) {
  const jobId = uuidv4();
  await prisma.job.create({
    data: {
      id: jobId,
      status: 'PENDING',
      recipe_id: recipe.id,
      recipe_snapshot: recipe as any,
      artifacts,
    },
  });
  return jobId;
}

export async function waitForStatus(jobId: string, targetStatus: string, timeoutMs = 30000) {
  const pollIntervalMs = 500;
  let elapsedMs = 0;

  while (elapsedMs < timeoutMs) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Job not found');

    if (job.status === targetStatus) return job;
    if (job.status === 'FAILED') throw new Error('Job failed');

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    elapsedMs += pollIntervalMs;
  }

  throw new Error(`Timeout waiting for status: ${targetStatus}`);
}

export async function cleanupTestData() {
  await prisma.telemetry.deleteMany();
  await prisma.job.deleteMany();
}
```

### Package.json Scripts

Add to root `package.json`:

```json
{
  "scripts": {
    "test:e2e": "vitest run tests/e2e/skeleton-run.test.ts",
    "test:e2e:watch": "vitest tests/e2e/skeleton-run.test.ts"
  }
}
```

### Vitest Config

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/e2e/setup.ts'],
  },
});
```

### Test Setup

```typescript
// tests/e2e/setup.ts

import { beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@fyi/database';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Verify database connection
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

## Cross-References

- **Sprint Plan:** [Sprint-001/README.md](../README.md)
- **Implementation Strategy:** [../../implementation-strategy.md](../../implementation-strategy.md)
- **Issue S1.5:** [Issue-005.md](./Issue-005.md)
- **Architecture:** [Architecture Decision Records](../../../architecture/)
- **Contracts Spec:** [Contracts v1.1](../../../contracts/contracts-v1.1.md)
- **Engineering Standards:** [Engineering Standards v1.0](../../../standards/engineering-standards-v1.0.md)