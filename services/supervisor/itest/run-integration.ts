// S1.4 integration test: seeds a PENDING job into the ledger with a 3-step recipe
// (research -> script -> voice), starts the Supervisor, and verifies the job
// transitions to COMPLETED with merged artifacts, while telemetry rows are written.
//
// The 3 workers are expected to be started separately (see run-integration.sh).
// This script is the orchestrator + observer.

import { prisma, JobStatus } from '@fyi/database';
import type { ProductionRecipe } from '@fyi/contracts';
import { createTaskLogger } from '@fyi/utils';
import { createSupervisor } from '../src/bootstrap.js';

const RECIPE_ID = 'skeleton-run';
const TENANT_ID = 'itest-tenant';
const TIMEOUT_MS = 45000;

const recipe: ProductionRecipe = {
  name: 'skeleton-run',
  steps: [
    {
      id: 'research',
      capability: 'research:mock',
      worker_label: 'mock-research-v1',
      requires_approval: false,
      input_mapping: { topic: 'research.topic' },
    },
    {
      id: 'script',
      capability: 'text-synthesis:script',
      worker_label: 'mock-script-v1',
      requires_approval: false,
      input_mapping: { research_brief: 'research.research_brief' },
    },
    {
      id: 'voice',
      capability: 'speech-synthesis:voice',
      worker_label: 'mock-voice-v1',
      requires_approval: false,
      input_mapping: { script: 'script.script' },
    },
  ],
};

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  console.log(`  ✅ ${msg}`);
}

async function waitForStatus(jobId: string, status: JobStatus, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (job?.status === status) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main(): Promise<void> {
  const log = createTaskLogger({ job_id: 'itest', execution_id: 'none' });

  // Seed a PENDING job with the recipe. Input for step 0 (research) topic is
  // placed in the initial artifacts so input_mapping can resolve it.
  const seeded = await prisma.job.create({
    data: {
      tenant_id: TENANT_ID,
      recipe_id: RECIPE_ID,
      status: JobStatus.PENDING,
      current_step_index: 0,
      recipe_snapshot: recipe as unknown as object,
      artifacts: { research: { topic: 'The Future of AI Media' } },
    },
  });
  log.info({ job_id: seeded.id }, 'Seeded PENDING job');
  console.log(`  Job id: ${seeded.id}`);

  // Start the supervisor (kernel + completion worker).
  const supervisor = createSupervisor();
  supervisor.start();

  // Wait for completion.
  const completed = await waitForStatus(seeded.id, JobStatus.COMPLETED, TIMEOUT_MS);
  await supervisor.stop();

  if (!completed) {
    const current = await prisma.job.findUnique({ where: { id: seeded.id } });
    console.error(`  ❌ Job did not reach COMPLETED. Current status: ${current?.status}`);
    console.error(`     current_step_index: ${current?.current_step_index}`);
    console.error(`     artifacts: ${JSON.stringify(current?.artifacts, null, 2)}`);
    throw new Error('Integration test FAILED: job not completed');
  }

  // Verify final state.
  const finalJob = await prisma.job.findUnique({ where: { id: seeded.id } });
  const artifacts = finalJob?.artifacts as Record<string, unknown>;

  assert(finalJob?.status === JobStatus.COMPLETED, 'job status = COMPLETED');
  assert(finalJob?.current_step_index === 3, 'current_step_index advanced to 3 (after 3 steps)');
  assert((artifacts.research as { research_brief?: string })?.research_brief, 'research artifacts merged');
  assert((artifacts.script as { script?: string })?.script, 'script artifacts merged');
  assert((artifacts.voice as { audio_url?: string })?.audio_url, 'voice artifacts merged');
  assert((artifacts._references as { voice_output?: string })?.voice_output, 'voice new_references merged under _references');

  // Verify telemetry written for all 3 steps.
  const telemetryCount = await prisma.telemetry.count({ where: { job_id: seeded.id } });
  assert(telemetryCount === 3, `telemetry rows = 3 (got ${telemetryCount})`);

  // Cleanup.
  await prisma.job.delete({ where: { id: seeded.id } });
  console.log('  🧹 cleaned up test job');
  await prisma.$disconnect();

  console.log('\n=== S1.4 Integration Test: ALL PASSED ===');
  process.exit(0);
}

main().catch(async (err) => {
  console.error('\n=== S1.4 Integration Test FAILED ===');
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
