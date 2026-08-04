// CRUD smoke test for the FYI Studio Job Ledger (Issue S1.2 acceptance).
// Creates a job with a JSON recipe_snapshot, reads it back, transitions status
// RUNNING -> COMPLETED, verifies updated_at changes, then writes a telemetry row.

import { prisma, Prisma, JobStatus } from './index.js';

function assert(cond: unknown, msg: string): void {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
  console.log(`  ✅ ${msg}`);
}

const recipe: Prisma.InputJsonValue = {
  name: 'skeleton-run',
  steps: [
    { id: 'research', capability: 'research:mock', worker_label: 'mock-research', requires_approval: false, input_mapping: {} },
    { id: 'script', capability: 'text-synthesis:script', worker_label: 'mock-script', requires_approval: false, input_mapping: { research: 'steps.research.output' } },
  ],
};

async function main(): Promise<void> {
  console.log('=== S1.2 CRUD Smoke Test ===');

  // 1. Create
  const created = await prisma.job.create({
    data: {
      tenant_id: 'test-tenant-001',
      recipe_id: 'skeleton-run',
      status: JobStatus.PENDING,
      current_step_index: 0,
      recipe_snapshot: recipe,
      artifacts: {},
    },
  });
  assert(created.id, 'job created with UUID');
  assert(created.status === JobStatus.PENDING, `initial status = PENDING (${created.status})`);

  // 2. Read back with JSONB
  const fetched = await prisma.job.findUnique({ where: { id: created.id } });
  assert(fetched !== null, 'job retrievable by id');
  assert(fetched?.recipe_snapshot != null, 'recipe_snapshot (JSONB) stored');
  assert(fetched?.tenant_id === 'test-tenant-001', 'tenant_id persisted');
  assert(fetched?.current_step_index === 0, 'current_step_index defaults to 0');

  const firstUpdated = fetched?.updated_at;

  // 3. Update status
  await new Promise((r) => setTimeout(r, 20)); // ensure timestamps differ
  const running = await prisma.job.update({
    where: { id: created.id },
    data: { status: JobStatus.RUNNING, current_step_index: 1 },
  });
  assert(running.status === JobStatus.RUNNING, 'status updated to RUNNING');
  assert(running.current_step_index === 1, 'current_step_index advanced to 1');
  assert(running.updated_at.getTime() > firstUpdated!.getTime(), 'updated_at changed on update');

  // 4. Complete
  const completed = await prisma.job.update({
    where: { id: created.id },
    data: { status: JobStatus.COMPLETED, artifacts: { combined: { ok: true } } },
  });
  assert(completed.status === JobStatus.COMPLETED, 'status updated to COMPLETED');
  assert((completed.artifacts as { combined?: { ok?: boolean } })?.combined?.ok === true, 'artifacts JSONB updated');

  // 5. Telemetry linked to job
  const telemetry = await prisma.telemetry.create({
    data: {
      job_id: created.id,
      execution_id: 'exec-0001',
      worker_id: 'mock-research-v1',
      worker_version: '1.0.0',
      provider: 'mock',
      model: 'mock-model',
      tokens_in: 10,
      tokens_out: 20,
      seconds: null,
      cost: new Prisma.Decimal('0.0001'),
      duration_ms: 120,
      started_at: new Date(),
      finished_at: new Date(),
    },
  });
  assert(telemetry.id > 0, `telemetry row written (id=${telemetry.id})`);

  const linked = await prisma.telemetry.findMany({ where: { job_id: created.id } });
  assert(linked.length === 1, 'telemetry linked to job via job_id');
  assert(linked[0]?.worker_id === 'mock-research-v1', 'worker_id persisted');

  // Cleanup
  await prisma.job.delete({ where: { id: created.id } });
  console.log('  🧹 cleaned up test job');

  console.log('\n=== S1.2 CRUD Smoke Test: ALL PASSED ===');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('\n=== S1.2 CRUD Smoke Test FAILED ===');
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
