// M6 E2E — Multi-Tenant isolation via the Tenant Policy Engine.
//
// Seeds TWO tenants with DIFFERENT policies and proves isolation by
// exercising ModelGate.resolve directly (NOT the full supervisor, to keep it
// deterministic and fast):
//   - Tenant A: prefers ollama/deepseek-v4-flash (connected default) for
//     'research:real'. Resolve MUST return A's model.
//   - Tenant B: prefers ollama/qwen3.5:397b — a model that is NOT in the
//     registry, so ModelGate returns INCOMPATIBLE_MODEL (proving B does NOT
//     fall through to the global default — i.e. per-tenant isolation holds).
//   - No-policy scope: falls back to the global default (ollama/deepseek-v4-flash).
import { readFileSync } from 'node:fs';
import { prisma } from '@fyi/database';
import { ModelGate, loadModelPolicy, upsertTenantPolicy, deleteTenantPolicy } from '@fyi/platform';

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

const TENANT_A = 'm6-e2e-tenant-a';
const TENANT_B = 'm6-e2e-tenant-b';
const CAPABILITY = 'research:real';

// B's preferred model does not exist in the model registry => INCOMPATIBLE_MODEL.
const TENANT_B_MODEL = 'qwen3.5:397b';

let passCount = 0;
let failCount = 0;

function check(name: string, ok: boolean, detail: string): void {
  if (ok) {
    passCount++;
    console.log(`  ✓ ${name}`);
  } else {
    failCount++;
    console.log(`  ✗ ${name} — ${detail}`);
  }
}

async function main(): Promise<void> {
  const gate = new ModelGate(loadModelPolicy());

  // 1. Seed two tenants with DIFFERENT policies.
  await upsertTenantPolicy({
    tenant_id: TENANT_A,
    model_preferences: { [CAPABILITY]: { provider: 'ollama', model: 'deepseek-v4-flash' } },
    cost_quota: null, // no quota
    enabled: true,
  });
  await upsertTenantPolicy({
    tenant_id: TENANT_B,
    model_preferences: { [CAPABILITY]: { provider: 'ollama', model: TENANT_B_MODEL } },
    cost_quota: null,
    enabled: true,
  });
  console.log(`Seeded policies for ${TENANT_A} and ${TENANT_B}.`);

  // 2. Tenant A resolves to ITS OWN model.
  const a = await gate.resolve(CAPABILITY, { scope: TENANT_A });
  check(
    'Tenant A resolves to its own preference (ollama/deepseek-v4-flash)',
    a.ok === true && a.model?.provider === 'ollama' && a.model?.model === 'deepseek-v4-flash',
    `got ${JSON.stringify(a)}`,
  );

  // 3. Tenant B does NOT inherit A's/default model — its preferred model is
  //    not connected/capable, so it fails explicitly (isolation proof).
  const b = await gate.resolve(CAPABILITY, { scope: TENANT_B });
  check(
    `Tenant B does NOT fall through to default; resolves to its own preference or fails explicitly`,
    b.ok === false || (b.ok === true && b.model?.model === TENANT_B_MODEL),
    `got ${JSON.stringify(b)}`,
  );
  if (b.ok === true) {
    check(
      'Tenant B resolves to its OWN distinct model (qwen3.5:397b)',
      b.model?.model === TENANT_B_MODEL,
      `got model ${b.model?.model}`,
    );
  } else {
    check(
      'Tenant B fails explicitly with an error code (INCOMPATIBLE_MODEL / NO_CONNECTED_PROVIDER)',
      b.error?.code === 'INCOMPATIBLE_MODEL' || b.error?.code === 'NO_CONNECTED_PROVIDER',
      `got error ${JSON.stringify(b.error)}`,
    );
  }

  // 4. No-policy scope falls back to the global default (ollama/deepseek-v4-flash).
  const d = await gate.resolve(CAPABILITY); // no scope => global default
  check(
    'No-policy scope falls back to the global default (ollama/deepseek-v4-flash)',
    d.ok === true && d.model?.provider === 'ollama' && d.model?.model === 'deepseek-v4-flash',
    `got ${JSON.stringify(d)}`,
  );

  // 5. Cleanup: delete tenant policies + any telemetry rows created.
  await deleteTenantPolicy(TENANT_A);
  await deleteTenantPolicy(TENANT_B);
  await prisma.telemetry.deleteMany({
    where: { job: { tenant_id: { in: [TENANT_A, TENANT_B] } } },
  });

  console.log(`\nRESULT: ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) process.exitCode = 1;
}

main()
  .then(() => {
    if (failCount === 0) console.log('M6-E2E PASSED');
    else console.log('M6-E2E FAILED');
  })
  .catch(async (e) => {
    console.error('ERR', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
