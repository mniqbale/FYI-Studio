// Model Registry — the model catalog with capability metadata.
// Loaded from model_policy.yaml (source of truth) and persisted in the DB.

import { prisma, ModelStatus } from '@fyi/database';
import { type ModelDef, type ModelPolicy } from './model-policy.js';

/** Seed the model_registry table from the model policy. */
export async function seedModels(policy: ModelPolicy): Promise<void> {
  for (const m of policy.models) {
    const existing = await prisma.modelRegistry.findUnique({
      where: { idx_model_provider_model_unique: { provider: m.provider, model: m.model } },
    });
    const data = {
      provider: m.provider,
      model: m.model,
      version: m.version ?? null,
      pricing_per_1k_tokens: m.pricing_per_1k_tokens ?? null,
      context_window: m.context_window ?? null,
      capabilities: m.capabilities as object,
      status: ModelStatus.ACTIVE,
    };
    if (existing) {
      await prisma.modelRegistry.update({ where: { id: existing.id }, data });
    } else {
      await prisma.modelRegistry.create({ data });
    }
  }
}

/** List models (optionally filtered by provider and/or capability). */
export async function listModels(opts: { provider?: string; capability?: string } = {}) {
  const rows = await prisma.modelRegistry.findMany({
    where: {
      status: ModelStatus.ACTIVE,
      provider: opts.provider ?? undefined,
    },
    orderBy: [{ provider: 'asc' }, { model: 'asc' }],
  });
  if (!opts.capability) return rows;
  return rows.filter((r) => (r.capabilities as string[]).includes(opts.capability!));
}

/**
 * List models that are both connected (provider connected) and capable of a
 * capability. This is the filtered list shown to the user for selection.
 */
export async function listModelsForCapability(
  connectedProviders: string[],
  capability: string,
) {
  const rows = await prisma.modelRegistry.findMany({
    where: {
      status: ModelStatus.ACTIVE,
      provider: { in: connectedProviders },
    },
    orderBy: [{ provider: 'asc' }, { model: 'asc' }],
  });
  return rows.filter((r) => (r.capabilities as string[]).includes(capability));
}

/** Get a single model by provider + model id. */
export async function getModel(provider: string, model: string) {
  return prisma.modelRegistry.findUnique({
    where: { idx_model_provider_model_unique: { provider, model } },
  });
}

/** Whether a specific model supports a capability. */
export async function modelSupportsCapability(provider: string, model: string, capability: string) {
  const found = await getModel(provider, model);
  if (!found) return false;
  return (found.capabilities as string[]).includes(capability);
}

/** Whether a specific model supports ALL of the given capabilities. */
export async function modelSupportsCapabilities(provider: string, model: string, capabilities: string[]) {
  const found = await getModel(provider, model);
  if (!found) return false;
  const modelCaps = found.capabilities as string[];
  return capabilities.every((c) => modelCaps.includes(c));
}

/**
 * List connected models that support ALL of the given capabilities.
 * Only used internally by ModelGate v2 for the fallback path.
 */
export async function listModelsForCapabilities(connectedProviders: string[], capabilities: string[]) {
  const rows = await prisma.modelRegistry.findMany({
    where: { status: ModelStatus.ACTIVE, provider: { in: connectedProviders } },
    orderBy: [{ provider: 'asc' }, { model: 'asc' }],
  });
  return rows.filter((r) => {
    const caps = r.capabilities as string[];
    return capabilities.every((c) => caps.includes(c));
  });
}

export type { ModelDef };
