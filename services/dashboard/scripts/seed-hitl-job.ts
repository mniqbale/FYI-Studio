// Seed a WAITING_APPROVAL job (HITL test) — a job paused after the script step
// with a script artifact the Founder can Approve or Revise in the Dashboard.
import { loadEnv } from '../src/utils/env.js';
import { prisma } from '../src/utils/prisma.js';
import { randomUUID } from 'node:crypto';

loadEnv();

const recipe = {
  name: 'video-production-v1',
  steps: [
    { id: 'research', capability: 'research:real', worker_label: 'Research Worker', requires_approval: false, input_mapping: { topic: 'topic' } },
    { id: 'script', capability: 'text-synthesis:script:real', worker_label: 'Script Worker', requires_approval: true, input_mapping: { research: 'research.summary' } },
    { id: 'voice', capability: 'speech-synthesis:voice:real', worker_label: 'Voice Worker', requires_approval: false, input_mapping: { narration: 'script.script' } },
    { id: 'subtitle', capability: 'subtitle:generate:real', worker_label: 'Subtitle Worker', requires_approval: false, input_mapping: {} },
    { id: 'video', capability: 'video:compose:real', worker_label: 'Video Worker', requires_approval: false, input_mapping: {} },
  ],
};

async function main() {
  const id = randomUUID();
  await prisma.job.create({
    data: {
      id,
      tenant_id: 'demo-tenant',
      recipe_id: 'video-production-v1',
      status: 'WAITING_APPROVAL',
      current_step_index: 2, // paused after script step (index 1 done, next is index 2)
      recipe_snapshot: recipe as never,
      artifacts: {
        research: { summary: 'Research summary', sources: ['https://example.com/a', 'https://example.com/b'] },
        'text-synthesis:script:real': { script: 'This is the original narration script waiting for approval.' },
        _references: {},
      } as never,
    },
  });
  console.log('Seeded WAITING_APPROVAL job:', id);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
