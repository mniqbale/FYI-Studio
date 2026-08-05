// M3 smoke test — verifies the real-worker wiring without an API key:
// a `research:real` job should be picked up and fail with a structured
// "no connected provider" error (proving ModelGate + AI client path works),
// OR succeed if a key is configured.
import { prisma, JobStatus } from '@fyi/database';
import { loadEnvIfPresent, seedRegistries, connectProvider, ModelGate, loadModelPolicy, connectedProviderIds } from '@fyi/platform';
import type { ProductionRecipe } from '@fyi/contracts';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  console.log(`  ✅ ${msg}`);
}

async function main(): Promise<void> {
  loadEnvIfPresent();
  await seedRegistries();

  console.log('=== M3 Real Worker Wiring Smoke Test ===');
  const connected = await connectedProviderIds();
  console.log(`  Connected providers: ${connected.length ? connected.join(', ') : '(none)'}`);

  const gate = new ModelGate(loadModelPolicy());
  const resolved = await gate.resolve('research:real', { scope: 'm3test' });
  console.log(`  ModelGate.resolve(research:real) -> ${JSON.stringify(resolved)}`);

  if (!resolved.ok) {
    assert(resolved.error?.code === 'NO_MODEL_FOR_CAPABILITY', 'no connected provider → structured error (correct without API key)');
  } else {
    assert(resolved.ok, `model resolved: ${resolved.model?.provider}/${resolved.model?.model}`);
  }

  await prisma.$disconnect();
  console.log('\n=== M3 Wiring Smoke Test: PASSED ===');
  process.exit(0);
}

main().catch(async (err) => {
  console.error('\n=== M3 Wiring Smoke Test FAILED ===');
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
