---
title: "Issue S1.5: Skeleton Run CLI"
issue_id: "S1.5"
sprint: "Sprint-001"
source: "Concept-11.md"
status: "ready"
priority: "P1"
estimated_complexity: "XS"
estimated_hours: 2
created: "2026-08-04"
tags: [cli, trigger, skeleton-run, monitoring]
---

# Issue S1.5: Skeleton Run CLI

## Goal

Create a simple command-line interface to trigger and monitor a Milestone 1 job.

## Background

We need a "Spark" to initiate the first production run and verify the OS is breathing.

## Scope

- A Node.js CLI script that seeds a `ProductionRecipe` and a `Job` into the DB.
- Monitors the DB every 2 seconds and prints the status to the console.
- **NOT in scope:** Any graphical user interface.

## Deliverables

- `/packages/cli/src/trigger-run.ts`

## Dependencies

- S1.1 (Workspace & Infra Initialization)
- S1.2 (Database Layer)
- S1.4 (Supervisor Kernel)

## Acceptance Criteria

- [ ] Running `npm run start-skeleton` initiates a job.
- [ ] The CLI outputs the status changes in real-time (e.g., "Researching...", "Scripting...").
- [ ] The CLI exits with a success message once the final artifact is in the DB.

## Testing

- Verify that a job created via CLI appears correctly in the PostgreSQL `jobs` table.

## Risks

- **CLI exiting prematurely before the background worker finishes.**

## Definition of Done

A full skeleton run can be initiated and monitored from a single terminal command.

## Implementation Notes

### CLI Script (`trigger-run.ts`)

```typescript
// /packages/cli/src/trigger-run.ts

import { PrismaClient } from '@fyi/database';
import { ProductionRecipe, RecipeStep, WorkerCapability, JobStatus } from '@fyi/contracts';
import { SupervisorKernel } from '@fyi/supervisor/kernel';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Sample ProductionRecipe for Milestone 1
const SKELETON_RECIPE: ProductionRecipe = {
  id: 'skeleton-recipe-v1',
  version: '1.0.0',
  steps: [
    {
      capability: 'RESEARCH',
      input_mapping: {
        topic: 'topic',
      },
      output_keys: ['research_brief', 'sources', 'key_findings'],
    },
    {
      capability: 'SCRIPTING',
      input_mapping: {
        research_brief: 'research_brief',
      },
      output_keys: ['script', 'scenes'],
    },
    {
      capability: 'VOICE',
      input_mapping: {
        script: 'script',
      },
      output_keys: ['audio_url', 'duration_seconds', 'voice_id'],
    },
  ],
};

async function main() {
  console.log('🚀 Starting FYI Studio Skeleton Run...\n');

  // 1. Create the job in the database
  const jobId = uuidv4();
  const topic = process.argv[2] || 'The Future of AI in Creative Media';

  console.log(`📝 Creating job: ${jobId}`);
  console.log(`📋 Topic: ${topic}\n`);

  const job = await prisma.job.create({
    data: {
      id: jobId,
      status: 'PENDING',
      recipe_id: SKELETON_RECIPE.id,
      recipe_snapshot: SKELETON_RECIPE as any,
      artifacts: { topic },
    },
  });

  console.log('✅ Job created in database\n');

  // 2. Start the Supervisor (if not already running)
  // In this MVP, we'll start the supervisor inline
  const supervisor = new SupervisorKernel();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await supervisor.shutdown();
    await prisma.$disconnect();
    process.exit(0);
  });

  // 3. Trigger the job via Supervisor
  console.log('▶️  Dispatching to Supervisor...\n');
  await supervisor.startJob(jobId);

  // 4. Monitor job status
  console.log('👀 Monitoring job status...\n');
  let lastStatus = '';

  while (true) {
    const currentJob = await prisma.job.findUnique({ where: { id: jobId } });
    if (!currentJob) {
      console.error('❌ Job not found!');
      break;
    }

    if (currentJob.status !== lastStatus) {
      const statusIcon = getStatusIcon(currentJob.status);
      console.log(`${statusIcon}  Status: ${currentJob.status}`);
      lastStatus = currentJob.status;
    }

    if (currentJob.status === 'COMPLETED') {
      console.log('\n🎉 Skeleton Run Completed Successfully!');
      console.log('\n📦 Final Artifacts:');
      console.log(JSON.stringify(currentJob.artifacts, null, 2));
      break;
    }

    if (currentJob.status === 'FAILED') {
      console.log('\n❌ Job Failed!');
      break;
    }

    // Poll every 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  await supervisor.shutdown();
  await prisma.$disconnect();
}

function getStatusIcon(status: JobStatus): string {
  switch (status) {
    case 'PENDING': return '⏳';
    case 'RESEARCHING': return '🔍';
    case 'SCRIPTING': return '✍️';
    case 'VOICING': return '🎙️';
    case 'COMPLETED': return '✅';
    case 'FAILED': return '❌';
    default: return '📍';
  }
}

main().catch(async (err) => {
  console.error('💥 Fatal error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
```

### Package.json Script

Add to root `package.json`:

```json
{
  "scripts": {
    "start-skeleton": "tsx packages/cli/src/trigger-run.ts"
  }
}
```

### Usage

```bash
# Start the skeleton run with default topic
npm run start-skeleton

# Start with custom topic
npm run start-skeleton "How AI is Transforming Video Production"
```

### Expected Output

```
🚀 Starting FYI Studio Skeleton Run...

📝 Creating job: 550e8400-e29b-41d4-a716-446655440000
📋 Topic: The Future of AI in Creative Media

✅ Job created in database

▶️  Dispatching to Supervisor...

👀 Monitoring job status...

⏳  Status: PENDING
🔍  Status: RESEARCHING
✍️  Status: SCRIPTING
🎙️  Status: VOICING
✅  Status: COMPLETED

🎉 Skeleton Run Completed Successfully!

📦 Final Artifacts:
{
  "topic": "The Future of AI in Creative Media",
  "research_brief": "Mock research brief for topic: The Future of AI in Creative Media",
  "sources": ["mock-source-1", "mock-source-2"],
  "key_findings": ["Finding 1", "Finding 2"],
  "script": "Mock script generated from research: Mock research brief for topic: The Future of AI in Creative Media",
  "scenes": ["Scene 1", "Scene 2", "Scene 3"],
  "audio_url": "/tmp/mock-audio-output.mp3",
  "duration_seconds": 60,
  "voice_id": "mock-voice-1"
}
```

## Cross-References

- **Sprint Plan:** [Sprint-001/README.md](../README.md)
- **Implementation Strategy:** [../../implementation-strategy.md](../../implementation-strategy.md)
- **Issue S1.4:** [Issue-004.md](./Issue-004.md)
- **Issue S1.6:** [Issue-006.md](./Issue-006.md)
- **Architecture:** [Architecture Decision Records](../../../architecture/)
- **Contracts Spec:** [Contracts v1.1](../../../contracts/contracts-v1.1.md)