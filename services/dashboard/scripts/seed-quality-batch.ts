// Phase 2.4 — Content Quality Validation batch seed.
//
// Seeds 10 Content Initiatives (5 Facts + 5 Sports) using the SAME
// channel-aware-v1 pipeline. Variation comes from Channel DNA + Initiative +
// Brief, not from different workflows.
//
// Usage: pnpm tsx services/dashboard/scripts/seed-quality-batch.ts
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

interface BatchItem {
  tenant_id: string;
  topic_area: string;
  objective: string;
}

const BATCH: BatchItem[] = [
  // Just FYI Facts (netral, edukatif) — 5
  { tenant_id: 'bu-just-fyi-facts', topic_area: 'why the sky is blue', objective: 'explain a common science question clearly and accurately' },
  { tenant_id: 'bu-just-fyi-facts', topic_area: 'how the printing press changed the world', objective: 'educate on a historical turning point with balanced framing' },
  { tenant_id: 'bu-just-fyi-facts', topic_area: 'the science of sleep and dreams', objective: 'explain sleep science with verified facts and plain language' },
  { tenant_id: 'bu-just-fyi-facts', topic_area: 'how vaccines actually work', objective: 'debunk myths and explain vaccine mechanism accurately' },
  { tenant_id: 'bu-just-fyi-facts', topic_area: 'why the ocean is salty', objective: 'explain a natural phenomenon with measured, educational tone' },
  // Just FYI Sports (cepat, hype) — 5
  { tenant_id: 'bu-just-fyi-sports', topic_area: 'the biggest transfer of the summer', objective: 'deliver the transfer story with speed and excitement' },
  { tenant_id: 'bu-just-fyi-sports', topic_area: 'match recap: the game everyone is talking about', objective: 'recap the match with hype and momentum' },
  { tenant_id: 'bu-just-fyi-sports', topic_area: 'a rising star to watch this season', objective: 'profile a breakout player with energy and urgency' },
  { tenant_id: 'bu-just-fyi-sports', topic_area: 'the most dramatic comeback in recent memory', objective: 'tell the comeback story with hype and emotion' },
  { tenant_id: 'bu-just-fyi-sports', topic_area: 'transfer deadline day chaos', objective: 'cover deadline day moves with fast, punchy energy' },
];

async function main(): Promise<void> {
  const created: { tenant_id: string; job_id: string; topic: string }[] = [];
  for (const item of BATCH) {
    const contentInitiative = {
      initiative_id: `init-${item.tenant_id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      objective: item.objective,
      audience: 'channel audience',
      topic_area: item.topic_area,
      constraints: { language: 'en' },
    };
    const initiative = parseContentInitiative(contentInitiative);
    if (!initiative) {
      console.error(`❌ Invalid initiative for ${item.topic_area}`);
      continue;
    }
    const job = await prisma.job.create({
      data: {
        tenant_id: item.tenant_id,
        recipe_id: CHANNEL_RECIPE.name,
        status: 'PENDING',
        current_step_index: 0,
        recipe_snapshot: CHANNEL_RECIPE as unknown as object,
        artifacts: { content_initiative: contentInitiative },
      },
    });
    created.push({ tenant_id: item.tenant_id, job_id: job.id, topic: item.topic_area });
    console.log(`✅ ${item.tenant_id} | ${job.id} | ${item.topic_area}`);
  }
  console.log(`\nTotal seeded: ${created.length}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
