// M3 end-to-end smoke: seed a research:real job and watch it transition.
import { prisma, JobStatus } from '@fyi/database';
import type { ProductionRecipe } from '@fyi/contracts';

const recipe: ProductionRecipe = {
  name: 'm3-run',
  steps: [
    { id: 'research', capability: 'research:real', worker_label: 'real-research-v1', requires_approval: false, input_mapping: { topic: 'research.topic' } },
  ],
};

async function main(): Promise<void> {
  const job = await prisma.job.create({
    data: {
      tenant_id: 'm3',
      recipe_id: 'm3-run',
      status: JobStatus.PENDING,
      current_step_index: 0,
      recipe_snapshot: recipe as unknown as object,
      artifacts: { research: { topic: 'The Future of AI in Media' } },
    },
  });
  console.log(`M3_JOB=${job.id}`);

  const deadline = Date.now() + 15000;
  let final: { id: string; status: string; artifacts: unknown } | null = null;
  while (Date.now() < deadline) {
    const cur = await prisma.job.findUnique({ where: { id: job.id } });
    if (cur && cur.status !== JobStatus.PENDING) {
      final = cur;
      break;
    }
    await new Promise((r) => setTimeout(r, 750));
  }

  if (!final) {
    console.log('Job stayed PENDING (worker may not be running).');
  } else {
    console.log(`FINAL status=${final.status}`);
    console.log(`artifacts=${JSON.stringify(final.artifacts)}`);
  }

  await prisma.telemetry.deleteMany({ where: { job_id: job.id } });
  await prisma.job.delete({ where: { id: job.id } });
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('ERR', e);
  await prisma.$disconnect();
  process.exit(1);
});
