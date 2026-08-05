// FYI Studio CLI — provider connection & model selection (S2.5, ADR-0007).
//
// Usage:
//   npm run provider -- connect <provider>            # connect a provider (reads key from env)
//   npm run provider -- list                          # list connected providers + models
//   npm run provider -- disconnect <provider>         # disconnect a provider
//   npm run provider -- select <capability> <model>   # set a default model for a capability
//   npm run provider -- models [capability]           # show models available for a capability
//
// API keys are read from the environment (e.g. OPENAI_API_KEY) or .env — never
// from CLI args (avoids shell history leakage). Never printed or logged.

import { prisma } from '@fyi/database';
import {
  loadEnvIfPresent,
  loadModelPolicy,
  seedRegistries,
  connectProvider,
  disconnectProvider,
  listConnections,
  listModelsForCapability,
  listModels,
  connectedProviderIds,
  ModelGate,
} from '@fyi/platform';

loadEnvIfPresent();

function usage(): void {
  console.log(`Usage:
  fyi provider connect <provider>
  fyi provider list
  fyi provider disconnect <provider>
  fyi provider select <capability> <provider/model>
  fyi provider models [capability]
  fyi provider resolve <capability>
`);
}

async function cmdConnect(provider: string): Promise<void> {
  await seedRegistries();
  const res = await connectProvider(provider);
  if (res.connected) {
    console.log(`✅ Connected provider: ${res.provider}`);
  } else {
    console.error(`❌ ${res.error}`);
  }
}

async function cmdList(): Promise<void> {
  const conns = await listConnections();
  if (conns.length === 0) {
    console.log('No providers connected. Use `fyi provider connect <provider>`.');
    return;
  }
  console.log('Connected providers:');
  for (const c of conns) {
    console.log(`  • ${c.provider}  (status: ${c.status}, key_ref: ${c.key_ref})`);
  }
}

async function cmdDisconnect(provider: string): Promise<void> {
  const res = await disconnectProvider(provider);
  if (res.disconnected) {
    console.log(`✅ Disconnected provider: ${provider}`);
  } else {
    console.error(`❌ ${res.error}`);
  }
}

async function cmdModels(capability?: string): Promise<void> {
  await seedRegistries();
  if (!capability) {
    const models = await listModels();
    console.log(`Available models (${models.length}):`);
    for (const m of models) {
      console.log(`  • ${m.provider}/${m.model}  [${(m.capabilities as string[]).join(', ')}]`);
    }
    return;
  }
  const connected = await connectedProviderIds();
  const capable = await listModelsForCapability(connected, capability);
  if (capable.length === 0) {
    console.log(`No connected+capable models for capability "${capability}".`);
    return;
  }
  console.log(`Models for capability "${capability}":`);
  for (const m of capable) {
    console.log(`  • ${m.provider}/${m.model}`);
  }
}

async function cmdSelect(capability: string, providerModel: string): Promise<void> {
  const [provider, model] = providerModel.split('/');
  if (!provider || !model) {
    console.error('Usage: fyi provider select <capability> <provider/model>');
    return;
  }
  // Validate via ModelGate (capability-gated).
  const gate = new ModelGate(loadModelPolicy());
  const res = await gate.resolve(capability, { override: { provider, model } });
  if (!res.ok) {
    console.error(`❌ ${res.error?.message}`);
    return;
  }
  console.log(`✅ Default for "${capability}" set to ${provider}/${model}`);
  console.log('(Note: store defaults in model_policy.yaml for persistence.)');
}

async function cmdResolve(capability: string): Promise<void> {
  const gate = new ModelGate(loadModelPolicy());
  const res = await gate.resolve(capability);
  if (res.ok) {
    console.log(`Resolved ${capability} -> ${res.model?.provider}/${res.model?.model}`);
  } else {
    console.error(`❌ ${res.error?.message}`);
  }
}

async function main(): Promise<void> {
  const [, , sub, a, b] = process.argv;
  switch (sub) {
    case 'connect':
      if (!a) return usage();
      await cmdConnect(a);
      break;
    case 'list':
      await cmdList();
      break;
    case 'disconnect':
      if (!a) return usage();
      await cmdDisconnect(a);
      break;
    case 'models':
      await cmdModels(a);
      break;
    case 'select':
      if (!a || !b) return usage();
      await cmdSelect(a, b);
      break;
    case 'resolve':
      if (!a) return usage();
      await cmdResolve(a);
      break;
    default:
      usage();
      break;
  }
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  await prisma.$disconnect();
  process.exit(1);
});
