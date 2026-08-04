---
title: "Issue S1.3: Mock Worker Suite"
issue_id: "S1.3"
sprint: "Sprint-001"
source: "Concept-11.md"
status: "ready"
priority: "P0"
estimated_complexity: "M"
estimated_hours: 8
created: "2026-08-04"
tags: [workers, mock-workers, research, script, voice, bullmq]
---

# Issue S1.3: Mock Worker Suite

## Goal

Create three stateless mock workers (Research, Script, Voice) to prove the Worker-Supervisor communication loop.

## Background

Workers must implement the "Stateless Adapter" pattern. They listen for `TaskEnvelope` and return `WorkerResponse`.

## Scope

- Create three services in `/workers/`: `research`, `script`, `voice`.
- Use **BullMQ** to listen to specific queues: `research-queue`, `script-queue`, `voice-queue`.
- Simulate 2-second processing time.
- Implement the standard logging of `job_id` and `execution_id`.
- **NOT in scope:** Actual AI API integration.

## Deliverables

- `/workers/research/src/index.ts`
- `/workers/script/src/index.ts`
- `/workers/voice/src/index.ts`
- Dockerfiles for each worker (optional for MVP, but recommended).

## Dependencies

- S1.1 (Workspace & Infra Initialization)
- S1.2 (Database Layer)

## Acceptance Criteria

- [ ] Workers correctly parse a `TaskEnvelope` v1.1.
- [ ] Workers return a `WorkerResponse` v1.1 with valid `usage` and `performance` metrics.
- [ ] Workers log their activity to the console in structured JSON format.

## Testing

- Manually push a mock `TaskEnvelope` to Redis and verify the worker picks it up and returns a result to the completion queue.

## Risks

- **BullMQ connection timeouts in local Docker environments.**

## Definition of Done

All three mock workers are running and successfully responding to queue messages.

## Implementation Notes

### Worker Structure (Each Worker)

Each worker follows the same pattern:

```typescript
// /workers/{research,script,voice}/src/index.ts

import { Worker, Job } from 'bullmq';
import { TaskEnvelope, WorkerResponse, WorkerCapability } from '@fyi/contracts';
import { createRedisConnection } from '@fyi/utils/redis';

const QUEUE_NAME = '{capability}-queue'; // e.g., 'research-queue'
const COMPLETION_QUEUE = 'completion-queue';

async function processTask(job: Job<TaskEnvelope>): Promise<WorkerResponse> {
  const envelope = job.data;
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  console.log(JSON.stringify({
    level: 'info',
    message: `Processing ${envelope.capability} task`,
    job_id: envelope.job_id,
    execution_id: envelope.execution_id,
  }));

  // Simulate AI processing (2 seconds)
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Mock output based on capability
  const output = generateMockOutput(envelope.capability, envelope.payload);

  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - startTime;

  const response: WorkerResponse = {
    execution_id: envelope.execution_id,
    status: 'success',
    output,
    usage: {
      cost_estimate: Math.random() * 0.01,
      tokens: Math.floor(Math.random() * 1000) + 500,
    },
    performance: {
      duration_ms: durationMs,
      started_at: startedAt,
      finished_at: finishedAt,
    },
  };

  console.log(JSON.stringify({
    level: 'info',
    message: `Completed ${envelope.capability} task`,
    job_id: envelope.job_id,
    execution_id: envelope.execution_id,
    duration_ms: durationMs,
  }));

  return response;
}

function generateMockOutput(capability: WorkerCapability, payload: Record<string, any>): Record<string, any> {
  switch (capability) {
    case 'RESEARCH':
      return {
        research_brief: `Mock research brief for topic: ${payload.topic || 'unknown'}`,
        sources: ['mock-source-1', 'mock-source-2'],
        key_findings: ['Finding 1', 'Finding 2'],
      };
    case 'SCRIPTING':
      return {
        script: `Mock script generated from research: ${payload.research_brief || 'no research'}`,
        scenes: ['Scene 1', 'Scene 2', 'Scene 3'],
      };
    case 'VOICE':
      return {
        audio_url: '/tmp/mock-audio-output.mp3',
        duration_seconds: 60,
        voice_id: 'mock-voice-1',
      };
    default:
      return {};
  }
}

// Worker initialization
const worker = new Worker<TaskEnvelope>(QUEUE_NAME, processTask, {
  connection: createRedisConnection(),
  concurrency: 1,
});

worker.on('completed', (job, result) => {
  // Forward to completion queue for Supervisor
  // Implementation depends on queue handler setup
});

worker.on('failed', (job, err) => {
  console.error(JSON.stringify({
    level: 'error',
    message: `Worker failed: ${err.message}`,
    job_id: job?.data?.job_id,
    execution_id: job?.data?.execution_id,
  }));
});

console.log(`${QUEUE_NAME} worker started...`);
```

### Required Queue Names

| Worker | Queue Name | Capability |
|--------|------------|------------|
| Research | `research-queue` | `RESEARCH` |
| Script | `script-queue` | `SCRIPTING` |
| Voice | `voice-queue` | `VOICE` |

### Completion Queue

All workers should publish results to a shared `completion-queue` that the Supervisor listens to.

## Cross-References

- **Sprint Plan:** [Sprint-001/README.md](../README.md)
- **Implementation Strategy:** [../../implementation-strategy.md](../../implementation-strategy.md)
- **Issue S1.2:** [Issue-002.md](./Issue-002.md)
- **Issue S1.4:** [Issue-004.md](./Issue-004.md)
- **Architecture:** [Architecture Decision Records](../../../architecture/)
- **Contracts Spec:** [Contracts v1.1](../../../contracts/contracts-v1.1.md)