// M3 full real pipeline: research:real -> text-synthesis:script:real, via Ollama Cloud.
import { prisma, JobStatus } from '@fyi/database';
import type { ProductionRecipe } from '@fyi/contracts';

const recipe: ProductionRecipe = {
  name: 'm3-real-run',
  steps: [
    { id: 'research', capability: 'research:real', worker_label: 'real-research-v1', requires_approval: false, input_mapping: { topic: 'research.topic' } },
    { id: 'script', capability: 'text-synthesis:script:real', worker_label: 'real-script-v1', requires_approval: false, input_mapping: { research_brief: 'research.research_brief' } },
  ],
};

async function main(): Promise<void> {
  const job = await prisma.job.create({
    data: {
      tenant_id: 'm3',
      recipe_id: 'm3-real-run',
      status: JobStatus.PENDING,
      current_step_index: 0,
      recipe_snapshot: recipe as unknown as object,
      artifacts: { research: { topic: 'The Future of AI in Media Production' } },
    },
  });
  console.log(`M3_JOB=${job.id}`);

  const deadline = Date.now() + 90000;
  let final: { status: string; artifacts: unknown } | null = null;
  while (Date.now() < deadline) {
    const cur = await prisma.job.findUnique({ where: { id: job.id } });
    if (cur && cur.status !== JobStatus.PENDING && cur.status !== JobStatus.RUNNING) {
      final = cur;
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (!final) {
    console.log('Job did not reach terminal state in time.');
  } else {
    console.log(`FINAL status=${final.status}`);
    const a = final.artifacts as Record<string, unknown>;
    const research = a.research as Record<string, unknown> | undefined;
    const script = a.script as Record<string, unknown> | undefined;
    console.log('research_brief:', JSON.stringify(research?.research_brief ?? '').slice(0, 200));
    console.log('sources:', JSON.stringify(research?.sources ?? []));
    console.log('script:', JSON.stringify(script?.script ?? '').slice(0, 200));
    console.log('scenes:', JSON.stringify(script?.scenes ?? []));
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
