// Phase 2.1 seed — prove the Content Brief Business Artifact can drive the
// real pipeline (Research → Script → Media → Publishing).
//
// Creates a PENDING job whose initial artifact is a Content Brief (manually
// authored by Founder/Operator, per Phase 2.1). The recipe's input_mapping
// forwards `content_brief` to Research so the worker consumes the brief as its
// primary input.
//
// Usage: pnpm tsx services/dashboard/scripts/seed-brief-job.ts
import { prisma } from '../src/utils/prisma.js';
import { loadEnv } from '../src/utils/env.js';
import type { ProductionRecipe } from '@fyi/contracts';
import { parseContentBrief } from '@fyi/platform';

loadEnv();

const BRIEF_RECIPE: ProductionRecipe = {
  name: 'brief-driven-v1',
  steps: [
    { id: 'research', capability: 'research:real', worker_label: 'research-worker', requires_approval: false, input_mapping: { content_brief: 'content_brief' } },
    { id: 'script', capability: 'text-synthesis:script:real', worker_label: 'script-worker', requires_approval: false, input_mapping: { content_brief: 'content_brief', research_brief: 'research.research_brief' } },
    { id: 'voice', capability: 'voice:tts', worker_label: 'voice-worker', requires_approval: false, input_mapping: { script: 'script.script' } },
    { id: 'subtitle', capability: 'subtitle:generate', worker_label: 'subtitle-worker', requires_approval: false, input_mapping: { script: 'script.script' } },
    { id: 'video', capability: 'video:compose', worker_label: 'video-worker', requires_approval: false, input_mapping: { script: 'script.script' } },
  ],
};

async function main(): Promise<void> {
  const tenantId = 'brief-tenant';
  const contentBrief = {
    brief_id: 'brief-2026-08-07-001',
    objective: 'educate',
    audience: 'solo content creators',
    topic: 'How an AI operating system automates distributed media production',
    angle: 'practical, step-by-step, beginner-friendly',
    success_metric: 'average retention > 60%',
    constraints: { max_duration_sec: 240, language: 'en', forbidden_terms: ['guaranteed', 'miracle'] },
    distribution_target: 'YouTube + YouTube Shorts',
  };

  // Validate the brief before committing it to the pipeline.
  const brief = parseContentBrief(contentBrief);
  if (!brief) {
    console.error('❌ Content Brief is invalid (missing required fields).');
    process.exit(1);
  }

  await prisma.tenantContext.upsert({
    where: { tenant_id: tenantId },
    update: {},
    create: {
      tenant_id: tenantId,
      brand_voice: 'Professional, engaging, and concise. Use active voice.',
      language: 'en',
      forbidden_terms: ['guaranteed', 'miracle'],
    },
  });
  await prisma.tenantPolicy.upsert({
    where: { tenant_id: tenantId },
    update: {},
    create: {
      tenant_id: tenantId,
      model_preferences: {
        'research:real': { provider: 'ollama', model: 'deepseek-v4-flash' },
        'text-synthesis:script:real': { provider: 'ollama', model: 'deepseek-v4-flash' },
      },
      cost_quota: 100,
      enabled: true,
    },
  });

  const job = await prisma.job.create({
    data: {
      tenant_id: tenantId,
      recipe_id: BRIEF_RECIPE.name,
      status: 'PENDING',
      current_step_index: 0,
      recipe_snapshot: BRIEF_RECIPE as unknown as object,
      artifacts: { content_brief: contentBrief },
    },
  });

  console.log('✅ Seeded brief-driven job.');
  console.log(`   Job ID:      ${job.id}`);
  console.log(`   Tenant:      ${tenantId}`);
  console.log(`   Brief:       ${brief.brief_id} — ${brief.topic}`);
  console.log('\n   Pipeline:  Content Brief → Research → Script → Media → Publishing');
  console.log('\n   Start the pipeline (supervisor + research/script/media workers), then:');
  console.log('   curl -s localhost:3001/api/jobs | grep -A20 brief-tenant  # or use the dashboard');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
