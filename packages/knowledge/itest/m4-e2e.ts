// M4 E2E — seed tenant knowledge, then run research:real -> script:real and
// verify the job COMPLETES with content respecting the brand voice.
import { readFileSync } from 'node:fs';
import { prisma, JobStatus } from '@fyi/database';
import { upsertTenantKnowledge, addMemory } from '@fyi/knowledge';

function loadEnv(path: string): void {
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx <= 0) continue;
    const k = t.slice(0, idx).trim();
    if (!process.env[k]) process.env[k] = t.slice(idx + 1).trim();
  }
}
loadEnv('/workspaces/FYI-Studio/.env');

const TENANT = 'm4-e2e-brand';
const recipe = {
  name: 'm4-e2e',
  steps: [
    { id: 'research', capability: 'research:real', worker_label: 'real-research-v1', requires_approval: false, input_mapping: { topic: 'research.topic' } },
    { id: 'script', capability: 'text-synthesis:script:real', worker_label: 'real-script-v1', requires_approval: false, input_mapping: { research_brief: 'research.research_brief' } },
  ],
};

async function main(): Promise<void> {
  // Seed knowledge
  await upsertTenantKnowledge({
    tenant_id: TENANT,
    brand_voice: 'Serious, precise, technical, and slightly humorous.',
    language: 'en',
    style_guide: 'Prefer short declarative sentences. Avoid hype.',
    forbidden_terms: ['synergy', 'disrupt', 'revolutionary'],
    constraints: { max_duration_sec: 300, tone: 'technical' },
    verified_facts: ['FYI Studio is an AI orchestration platform.'],
  });
  await addMemory({ tenant_id: TENANT, kind: 'performance', content: { retention: 0.72 } });

  const job = await prisma.job.create({
    data: {
      tenant_id: TENANT,
      recipe_id: 'm4-e2e',
      status: JobStatus.PENDING,
      current_step_index: 0,
      recipe_snapshot: recipe as unknown as object,
      artifacts: { research: { topic: 'The Future of AI in Video Production' } },
    },
  });
  console.log(`M4_JOB=${job.id}`);

  const deadline = Date.now() + 120000;
  let final: { status: string; artifacts: unknown } | null = null;
  while (Date.now() < deadline) {
    const cur = await prisma.job.findUnique({ where: { id: job.id } });
    if (cur && cur.status !== JobStatus.PENDING && cur.status !== JobStatus.RUNNING) { final = cur; break; }
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (!final) { console.log('Job did not reach terminal state in time.'); }
  else {
    console.log(`FINAL status=${final.status}`);
    const a = final.artifacts as Record<string, unknown>;
    const script = a.script as Record<string, unknown> | undefined;
    const text = (script?.script as string ?? '');
    console.log('script.length:', text.length);
    console.log('script preview:', JSON.stringify(text.slice(0, 300)));
    // brand-voice check: forbidden terms should be absent
    const forbidden = ['synergy', 'disrupt', 'revolutionary'];
    const hits = forbidden.filter((f) => text.toLowerCase().includes(f));
    console.log('forbidden-term hits:', JSON.stringify(hits));
  }

  // cleanup
  await prisma.telemetry.deleteMany({ where: { job_id: job.id } });
  await prisma.job.delete({ where: { id: job.id } });
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error('ERR', e); await prisma.$disconnect(); process.exit(1); });
