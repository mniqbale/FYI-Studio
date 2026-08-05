// M4 smoke — verifies @fyi/knowledge against real Postgres: seed tenant
// knowledge, add memory, assemble context.
import { readFileSync } from 'node:fs';
import { upsertTenantKnowledge, addMemory, assembleContext, listMemory, deleteTenantKnowledge, clearMemory } from '@fyi/knowledge';
import { prisma } from '@fyi/database';

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

async function main(): Promise<void> {
  const tenant = 'm4-smoke-tenant';
  // clean slate
  await deleteTenantKnowledge(tenant);
  await clearMemory(tenant);

  await upsertTenantKnowledge({
    tenant_id: tenant,
    brand_voice: 'Bold, energetic, and educational.',
    language: 'en',
    style_guide: 'Use short punchy sentences. No jargon.',
    forbidden_terms: ['literally', 'amazing', 'synergy'],
    verified_facts: ['The sky is blue.'],
    constraints: { max_duration_sec: 300, tone: 'uplifting' },
  });
  await addMemory({ tenant_id: tenant, kind: 'performance', content: { retention: 0.68 } });
  await addMemory({ tenant_id: tenant, kind: 'edit', content: { note: 'cut intro' } });

  const ctx = await assembleContext(tenant);
  console.log('BRAND:', ctx.brand_voice);
  console.log('LANG:', ctx.language);
  console.log('STYLE:', ctx.style_guide);
  console.log('FORBIDDEN:', JSON.stringify(ctx.forbidden_terms));
  console.log('CONSTRAINTS:', JSON.stringify(ctx.constraints));
  console.log('FACTS:', JSON.stringify(ctx.verified_facts));
  console.log('MEMORY count:', ctx.memory.length, 'kinds:', ctx.memory.map((m) => m.kind).join(','));

  const mem = await listMemory(tenant);
  console.log('listMemory count:', mem.length);

  // cleanup
  await deleteTenantKnowledge(tenant);
  await clearMemory(tenant);
  await prisma.$disconnect();
  console.log('M4_SMOKE_OK');
}

main().catch(async (e) => {
  console.error('ERR', e);
  await prisma.$disconnect();
  process.exit(1);
});
