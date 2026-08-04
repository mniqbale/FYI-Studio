---
title: "Issue S1.4: Supervisor Kernel (The Core)"
issue_id: "S1.4"
sprint: "Sprint-001"
source: "Concept-11.md"
status: "done"
priority: "P0"
estimated_complexity: "L"
estimated_hours: 16
created: "2026-08-04"
tags: [supervisor, kernel, orchestration, state-machine, queue-dispatching]
---

# Issue S1.4: Supervisor Kernel (The Core)

## Goal

Implement the orchestration logic that manages the state machine and routes data between workers.

## Background

The Supervisor is the "CEO." It moves jobs through the DAG by reading the `ProductionRecipe` and dispatching tasks based on the completion of previous steps.

## Scope

- Create `/services/supervisor`.
- Implement a "Step Resolver" that determines the next capability in the recipe.
- Implement "Context Assembly" (merging `artifacts` into the next `TaskEnvelope`).
- Update the `jobs` table in Postgres after every worker completion.
- **NOT in scope:** Error retry logic or Human-in-the-loop UI.

## Deliverables

- `/services/supervisor/src/kernel.ts` (The main loop)
- `/services/supervisor/src/queue-handler.ts` (BullMQ listeners/producers)

## Dependencies

- S1.1 (Workspace & Infra Initialization)
- S1.2 (Database Layer)
- S1.3 (Mock Worker Suite)

## Acceptance Criteria

- [ ] Supervisor picks up a `PENDING` job and starts the first step.
- [ ] Supervisor maps the `output` of Step N to the `payload` of Step N+1.
- [ ] Supervisor marks job as `COMPLETED` only after the final worker in the recipe returns success.

## Testing

- Unit test the "Step Resolver" logic with various mock recipes.
- Integration test: Start the supervisor and mock workers, then verify the DB state transitions.

## Risks

- **Complexity in the mapping logic (mapping output keys to input keys).**

## Definition of Done

The Supervisor can successfully move a job from the first step to the last without manual intervention.

## Implementation Notes

### Core Components

#### 1. Step Resolver (`kernel.ts`)

```typescript
// /services/supervisor/src/kernel.ts

import { PrismaClient } from '@fyi/database';
import { ProductionRecipe, RecipeStep, WorkerCapability, TaskEnvelope, JobStatus } from '@fyi/contracts';
import { Queue, Worker } from 'bullmq';
import { createRedisConnection } from '@fyi/utils/redis';

const prisma = new PrismaClient();

export class SupervisorKernel {
  private completionWorker: Worker;
  private workerQueues: Map<WorkerCapability, Queue>;

  constructor() {
    this.workerQueues = new Map([
      ['RESEARCH', new Queue('research-queue', { connection: createRedisConnection() })],
      ['SCRIPTING', new Queue('script-queue', { connection: createRedisConnection() })],
      ['VOICE', new Queue('voice-queue', { connection: createRedisConnection() })],
    ]);

    this.completionWorker = new Worker('completion-queue', this.handleCompletion.bind(this), {
      connection: createRedisConnection(),
      concurrency: 5,
    });
  }

  // Start a new job by dispatching the first step
  async startJob(jobId: string): Promise<void> {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.status !== 'PENDING') return;

    const recipe: ProductionRecipe = job.recipe_snapshot as unknown as ProductionRecipe;
    const firstStep = recipe.steps[0];

    await this.dispatchStep(jobId, firstStep, 0, recipe, {});
  }

  // Handle worker completion and dispatch next step
  private async handleCompletion(job: Job): Promise<void> {
    const response = job.data as WorkerResponse; // from worker
    const { execution_id, output, usage, performance, status } = response;

    // Update telemetry
    await prisma.telemetry.create({
      data: {
        job_id: jobId, // Need to extract from context
        execution_id,
        capability: capability, // from context
        duration_ms: performance.duration_ms,
        cost_estimate: usage.cost_estimate,
        tokens_used: usage.tokens,
      },
    });

    // Merge artifacts
    const jobRecord = await prisma.job.findUnique({ where: { id: jobId } });
    const currentArtifacts = (jobRecord?.artifacts as Record<string, any>) || {};
    const newArtifacts = { ...currentArtifacts, ...output };

    // Update job with new artifacts
    await prisma.job.update({
      where: { id: jobId },
      data: {
        artifacts: newArtifacts,
        updated_at: new Date(),
      },
    });

    // Determine next step
    const recipe: ProductionRecipe = jobRecord!.recipe_snapshot as unknown as ProductionRecipe;
    const currentStepIndex = recipe.steps.findIndex(s => s.capability === capability);
    const nextStepIndex = currentStepIndex + 1;

    if (nextStepIndex < recipe.steps.length) {
      const nextStep = recipe.steps[nextStepIndex];
      await this.dispatchStep(jobId, nextStep, nextStepIndex, recipe, newArtifacts);
    } else {
      // Job completed
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completed_at: new Date(),
          artifacts: newArtifacts,
        },
      });
    }
  }

  // Dispatch a step to the appropriate worker queue
  private async dispatchStep(
    jobId: string,
    step: RecipeStep,
    stepIndex: number,
    recipe: ProductionRecipe,
    context: Record<string, any>
  ): Promise<void> {
    const executionId = `${jobId}-${stepIndex}-${Date.now()}`;

    // Build payload using input_mapping
    const payload: Record<string, any> = {};
    for (const [targetKey, sourceKey] of Object.entries(step.input_mapping)) {
      payload[targetKey] = context[sourceKey];
    }

    const envelope: TaskEnvelope = {
      job_id: jobId,
      execution_id: executionId,
      capability: step.capability,
      payload,
      recipe_snapshot: recipe,
      context,
    };

    const queue = this.workerQueues.get(step.capability);
    if (!queue) throw new Error(`No queue for capability: ${step.capability}`);

    await queue.add(step.capability.toLowerCase(), envelope);

    // Update job status to RUNNING (or specific step status)
    const statusMap: Record<WorkerCapability, JobStatus> = {
      RESEARCH: 'RESEARCHING',
      SCRIPTING: 'SCRIPTING',
      VOICE: 'VOICING',
    };

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: statusMap[step.capability] || 'RUNNING',
        updated_at: new Date(),
      },
    });
  }

  async shutdown(): Promise<void> {
    await this.completionWorker.close();
    for (const queue of this.workerQueues.values()) {
      await queue.close();
    }
    await prisma.$disconnect();
  }
}
```

#### 2. Queue Handler (`queue-handler.ts`)

```typescript
// /services/supervisor/src/queue-handler.ts

import { Queue, Worker, Job } from 'bullmq';
import { createRedisConnection } from '@fyi/utils/redis';
import { TaskEnvelope, WorkerResponse } from '@fyi/contracts';

export function createWorkerQueue(capability: string): Queue {
  return new Queue(`${capability.toLowerCase()}-queue`, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });
}

export function createCompletionQueue(): Queue {
  return new Queue('completion-queue', {
    connection: createRedisConnection(),
  });
}

export function createCompletionWorker(processor: (job: Job<WorkerResponse>) => Promise<void>): Worker {
  return new Worker('completion-queue', processor, {
    connection: createRedisConnection(),
    concurrency: 10,
  });
}
```

### State Machine Flow

```
PENDING
  │
  ▼ (Supervisor dispatches first step)
RESEARCHING ──► Research Worker ──► completion-queue
  │
  ▼ (Supervisor maps output → dispatches next)
SCRIPTING ──► Script Worker ──► completion-queue
  │
  ▼ (Supervisor maps output → dispatches next)
VOICING ──► Voice Worker ──► completion-queue
  │
  ▼ (Supervisor marks complete)
COMPLETED
```

## Cross-References

- **Sprint Plan:** [Sprint-001/README.md](../README.md)
- **Implementation Strategy:** [../../implementation-strategy.md](../../implementation-strategy.md)
- **Issue S1.3:** [Issue-003.md](./Issue-003.md)
- **Issue S1.5:** [Issue-005.md](./Issue-005.md)
- **Architecture:** [Architecture Decision Records](../../../architecture/)
- **Contracts Spec:** [Contracts v1.1](../../../contracts/contracts-v1.1.md)