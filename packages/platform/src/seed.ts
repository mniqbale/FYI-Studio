// Seed orchestrator — loads model_policy.yaml and populates the Model Registry
// and Capability Registry. Idempotent (upsert by unique keys).

import { prisma } from '@fyi/database';
import { createTaskLogger } from '@fyi/utils';
import { loadModelPolicy, type ModelPolicy } from './model-policy.js';
import { seedModels } from './model-registry.js';
import { seedCapabilities } from './capability-registry.js';

export async function seedRegistries(policy?: ModelPolicy): Promise<void> {
  const p = policy ?? loadModelPolicy();
  await seedCapabilities(p);
  await seedModels(p);
  createTaskLogger({ job_id: 'platform', execution_id: 'none' }).info(
    { capabilities: Object.keys(p.capabilities).length, models: p.models.length },
    'Registries seeded from model_policy.yaml',
  );
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
