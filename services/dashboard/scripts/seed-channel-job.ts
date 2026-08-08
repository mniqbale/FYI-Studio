// Phase 2.3 — Channel-aware Production Pipeline v1 (AC-2..AC-6).
//
// Seeds a Content Initiative for a given Business Unit (tenant) and runs the
// full pipeline. Used to prove that the SAME topic produces DIFFERENT output
// for different Business Units (AC-4, AC-5) and that Video receives the
// channel's production_preferences (AC-6).
//
// Usage:
//   pnpm tsx services/dashboard/scripts/seed-channel-job.ts <tenant_id> <topic>
//   e.g. pnpm tsx services/dashboard/scripts/seed-channel-job.ts bu-just-fyi-facts "how AI is changing content creation"
import { prisma } from '../src/utils/prisma.js';
import { loadEnv } from '../src/utils/env.js';
import type { ProductionRecipe } from '@fyi/contracts';
import { parseContentInitiative } from '@fyi/platform';

loadEnv();

const CHANNEL_RECIPE: ProductionRecipe = {
  name: 'channel-aware-v1',
  steps: [
    { id: 'planner', capability: 'content:brief', worker_label: 'planner-worker', requires_approval: false, input_mapping: { content_initiative: 'content_initiative' } },
    { id: 'research', capability: 'research:real', worker_label: 'research-worker', requires_approval: false, input_mapping: { content_brief: 'planner.content_brief' } },
    { id: 'script', capability: 'text-synthesis:script:real', worker_label: 'script-worker', requires_approval: false, input_mapping: { content_brief: 'planner.content_brief', research_brief: 'research.research_brief' } },
    { id: 'voice', capability: 'voice:tts', worker_label: 'voice-worker', requires_approval: false, input_mapping: { script: 'script.script' } },
    { id: 'subtitle', capability: 'subtitle:generate', worker_label: 'subtitle-worker', requires_approval: false, input_mapping: { script: 'script.script' } },
    { id: 'video', capability: 'video:compose', worker_label: 'video-worker', requires_approval: false, input_mapping: { script: 'script.script', title: 'script.title', target_duration_seconds: 'script.target_duration_seconds' } },
  ],
};

async function main(): Promise<void> {
  const tenantId = process.argv[2];
  const topic = process.argv[3];
  if (!tenantId || !topic) {
    console.error('Usage: pnpm tsx seed-channel-job.ts <tenant_id> <topic>');
    process.exit(1);
  }

  // AC-2: Content Initiative knows its Business Unit (tenant_id).
  const contentInitiative = {
    initiative_id: `init-${tenantId}-${Date.now()}`,
    objective: 'produce a channel-aligned video on the given topic',
    audience: 'channel audience',
    topic_area: topic,
    constraints: { language: 'en' },
  };

  const initiative = parseContentInitiative(contentInitiative);
  if (!initiative) {
    console.error('❌ Content Initiative is invalid.');
    process.exit(1);
  }

  const job = await prisma.job.create({
    data: {
      tenant_id: tenantId,
      recipe_id: CHANNEL_RECIPE.name,
      status: 'PENDING',
      current_step_index: 0,
      recipe_snapshot: CHANNEL_RECIPE as unknown as object,
      artifacts: { content_initiative: contentInitiative },
    },
  });

  console.log(`✅ Seeded channel-aware job for Business Unit: ${tenantId}`);
  console.log(`   Job ID:     ${job.id}`);
  console.log(`   Topic:      ${topic}`);
  console.log(`   Pipeline:   Initiative → Planner → Brief → Research → Script → Media → Publishing`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
