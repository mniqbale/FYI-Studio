// Capability Registry — the set of capabilities ModelGate v2 routes by.
// Loaded from model_policy.yaml (source of truth) and persisted in the DB.

import { prisma } from '@fyi/database';
import { type CapabilityDef, type ModelPolicy } from './model-policy.js';

/** Seed the capability_registry table from the model policy. */
export async function seedCapabilities(policy: ModelPolicy): Promise<void> {
  for (const [name, def] of Object.entries(policy.capabilities)) {
    const existing = await prisma.capabilityRegistry.findUnique({ where: { name } });
    if (existing) {
      await prisma.capabilityRegistry.update({
        where: { id: existing.id },
        data: { description: def.description },
      });
    } else {
      await prisma.capabilityRegistry.create({ data: { name, description: def.description } });
    }
  }
}

/** List all registered capabilities. */
export async function listCapabilities() {
  return prisma.capabilityRegistry.findMany({ orderBy: { name: 'asc' } });
}

/** Whether a capability is registered. */
export async function hasCapability(name: string): Promise<boolean> {
  const found = await prisma.capabilityRegistry.findUnique({ where: { name } });
  return Boolean(found);
}

export type { CapabilityDef };
