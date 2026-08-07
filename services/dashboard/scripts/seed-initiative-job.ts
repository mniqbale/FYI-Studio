// Phase 2.2 seed — prove the FULL Product Constitution end-to-end:
//   Founder -> Content Initiative -> Planner -> Content Brief -> Research -> Script -> Media -> Publishing
//
// AC-1: Founder only provides a Content Initiative (NOT a ready brief).
// The recipe runs Planner (content:brief) first, then the brief-driven pipeline.
//
// Usage: pnpm tsx services/dashboard/scripts/seed-initiative-job.ts
import { prisma } from '../src/utils/prisma.js';
import { loadEnv } from '../src/utils/env.js';
import type { ProductionRecipe } from '@fyi/contracts';
import { parseContentInitiative } from '@fyi/platform';

loadEnv();

const INITIATIVE_RECIPE: ProductionRecipe = {
  name: 'initiative-driven-v1',
  steps: [
    { id: 'planner', capability: 'content:brief', worker_label: 'planner-worker', requires_approval: false, input_mapping: { content_initiative: 'content_initiative' } },
    { id: 'research', capability: 'research:real', worker_label: 'research-worker', requires_approval: false, input_mapping: { content_brief: 'planner.content_brief' } },
    { id: 'script', capability: 'text-synthesis:script:real', worker_label: 'script-worker', requires_approval: false, input_mapping: { content_brief: 'planner.content_brief', research_brief: 'research.research_brief' } },
    { id: 'voice', capability: 'voice:tts', worker_label: 'voice-worker', requires_approval: false, input_mapping: { script: 'script.script' } },
    { id: 'subtitle', capability: 'subtitle:generate', worker_label: 'subtitle-worker', requires_approval: false, input_mapping: { script: 'script.script' } },
    { id: 'video', capability: 'video:compose', worker_label: 'video-worker', requires_approval: false, input_mapping: { script: 'script.script' } },
  ],
};

async function main(): Promise<void> {
  const tenantId = 'initiative-tenant';
  // AC-1: Founder provides ONLY a Content Initiative.
  const contentInitiative = {
    initiative_id: 'init-2026-08-07-001',
    objective: 'grow subscribers by educating solo creators',
    audience: 'solo content creators new to AI tooling',
    topic_area: 'how an AI operating system automates distributed media production',
    constraints: { language: 'en', forbidden_terms: ['guaranteed', 'miracle'] },
  };

  const initiative = parseContentInitiative(contentInitiative);
  if (!initiative) {
    console.error('❌ Content Initiative is invalid (missing required fields).');
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
        'content:brief': { provider: 'ollama', model: 'deepseek-v4-flash' },
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
      recipe_id: INITIATIVE_RECIPE.name,
      status: 'PENDING',
      current_step_index: 0,
      recipe_snapshot: INITIATIVE_RECIPE as unknown as object,
      artifacts: { content_initiative: contentInitiative },
    },
  });

  console.log('✅ Seeded initiative-driven job.');
  console.log(`   Job ID:     ${job.id}`);
  console.log(`   Tenant:     ${tenantId}`);
  console.log(`   Initiative: ${initiative.initiative_id} — ${initiative.topic_area}`);
  console.log('\n   Pipeline:  Initiative → Planner → Brief → Research → Script → Media → Publishing');
  console.log('\n   Start pipeline (supervisor + planner/research/script/media workers), then:');
  console.log('   curl -s localhost:3001/api/jobs | grep -A20 initiative-tenant');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
