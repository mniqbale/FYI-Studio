// Seed a job whose research step has `sources` to prove the Bibliography
// (Daftar Pustaka) section renders (Workstream D, point 7).
// Usage: pnpm tsx services/dashboard/scripts/seed-refs-job.ts
import { prisma } from '../src/utils/prisma.js';
import { loadEnv } from '../src/utils/env.js';

loadEnv();

async function main(): Promise<void> {
  const tenantId = 'demo-tenant';
  const now = new Date();
  const job = await prisma.job.create({
    data: {
      tenant_id: tenantId,
      recipe_id: 'video-production-v1',
      status: 'COMPLETED',
      current_step_index: 5,
      recipe_snapshot: {
        name: 'Video Production Pipeline',
        steps: [
          { id: 'research', capability: 'research:web', workerLabel: 'research-worker', requiresApproval: false, inputMapping: {} },
          { id: 'script', capability: 'text-synthesis:script', workerLabel: 'script-worker', requiresApproval: false, inputMapping: {} },
          { id: 'voice', capability: 'voice:tts', workerLabel: 'voice-worker', requiresApproval: false, inputMapping: {} },
          { id: 'subtitle', capability: 'subtitle:generate', workerLabel: 'subtitle-worker', requiresApproval: false, inputMapping: {} },
          { id: 'video', capability: 'video:compose', workerLabel: 'video-worker', requiresApproval: false, inputMapping: {} },
        ],
      },
      artifacts: {
        research: {
          summary: 'How AI orchestration platforms enable BYOAI content workflows.',
          sources: [
            'https://arxiv.org/abs/2301.00234',
            'https://blog.google/technology/ai/gemini/',
            'https://openai.com/blog/',
          ],
          key_findings: ['BYOAI reduces vendor lock-in', 'Multi-model routing improves quality'],
        },
        script: { script: 'This is a test script with bibliography.', title: 'Test with References' },
        _references: {},
      },
      created_at: new Date(now.getTime() - 120_000),
      updated_at: now,
    },
  });
  await prisma.telemetry.create({
    data: {
      job_id: job.id,
      execution_id: 'refs-demo-1',
      worker_id: 'research-worker',
      worker_version: '1.0.0',
      provider: 'ollama',
      model: 'deepseek-v4-flash',
      tokens_in: 500,
      tokens_out: 300,
      cost: 0.0003,
      duration_ms: 2000,
      started_at: new Date(now.getTime() - 110_000),
      finished_at: new Date(now.getTime() - 108_000),
    },
  });
  console.log('✅ Seeded references demo job:', job.id);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
