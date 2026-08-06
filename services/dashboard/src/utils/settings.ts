// Settings data access — "AI Workspace" (Workstream A).
//
// This page WRAPS EXISTING Milestone 2/4/6 infrastructure (Provider Registry,
// Connection Manager, ModelGate, Tenant Policy, Knowledge CRUD) behind a UI.
// It does NOT change architecture, the data model, or Contracts v1.1 — the
// same @fyi/platform + @fyi/knowledge functions the CLI already uses.
//
// NOTE: this is the ONE read/write surface in the dashboard (the rest is
// read-only). Writes are limited to provider connections, tenant knowledge,
// and tenant model policy — never the Job Ledger itself.

import {
  PROVIDER_CATALOG,
  connectProvider,
  disconnectProvider,
  listConnections,
  listModelsForCapability,
  loadModelPolicy,
  ModelGate,
  seedRegistries,
  upsertTenantPolicy,
  hasSecret,
  listModels,
  setProviderApiKey,
  deleteProviderApiKey,
} from '@fyi/platform';
import {
  upsertTenantKnowledge,
  getTenantKnowledge,
  deleteTenantKnowledge,
  listTenantKnowledge,
} from '@fyi/knowledge';
import { prisma, JobStatus } from '../utils/prisma.js';

export interface ProviderView {
  id: string;
  name: string;
  requiresApiKey: boolean;
  connected: boolean;
  keyConfigured: boolean;
  healthError: string | null;
}

export interface CapabilityAssignment {
  capability: string;
  label: string;
  requiredModelCaps: string[];
  current: { provider: string; model: string } | null;
  candidates: Array<{ provider: string; model: string }>;
}

export interface SettingsOverview {
  providers: ProviderView[];
  tenants: Array<{ tenantId: string; brandVoice: string }>;
  assignments: CapabilityAssignment[];
}

// Worker capabilities surfaced in the Model Assignment tab (from model_policy
// defaults + worker_capabilities). Human-friendly labels for the Founder.
// Includes ALL pipeline workers; media workers (voice/subtitle/video) use local
// offline engines (espeak-ng/ffmpeg) so they are shown but marked non-LLM.
const CAPABILITY_LABELS: Record<string, string> = {
  'research:real': 'Research Worker',
  'text-synthesis:script:real': 'Script Worker',
  'voice:tts': 'Voice Worker',
  'subtitle:generate': 'Subtitle Worker',
  'video:compose': 'Video Worker',
};

/** Workers that are driven by an LLM model (selectable). Media workers are not. */
const LLM_WORKER_CAPS = new Set(['research:real', 'text-synthesis:script:real']);

/**
 * Discover models actually available on a connected provider (e.g. Ollama
 * /api/tags or /v1/models). Returns a list of { provider, model } that the
 * user may not have in the seeded registry. Never throws — returns [] on error.
 */
export async function discoverProviderModels(provider: string): Promise<Array<{ provider: string; model: string }>> {
  try {
    if (provider === 'ollama') {
      const base = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
      const url = base.endsWith('/v1') ? `${base}/models` : `${base}/api/tags`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return [];
      const data = (await res.json()) as { models?: Array<{ name?: string; model?: string }> };
      const names = (data.models ?? []).map((m) => m.name ?? m.model ?? '').filter(Boolean);
      return names.map((model) => ({ provider, model }));
    }
    // Other providers: fall back to the seeded registry (no generic discovery).
    return [];
  } catch {
    return [];
  }
}

/** Read-only snapshot of providers + connections + tenants + model assignments. */
export async function getSettingsOverview(tenantId?: string): Promise<SettingsOverview> {
  await seedRegistries();
  const [connections, tenants, allModels] = await Promise.all([
    listConnections(),
    listTenantKnowledge(),
    listModels(),
  ]);
  const policy = loadModelPolicy();
  const connectedSet = new Set(connections.filter((c) => c.status === 'CONNECTED').map((c) => c.provider));

  const providers: ProviderView[] = PROVIDER_CATALOG.map((p) => {
    const conn = connections.find((c) => c.provider === p.id && c.scope === 'default');
    return {
      id: p.id,
      name: p.name,
      requiresApiKey: p.requires_api_key,
      connected: connectedSet.has(p.id),
      keyConfigured: p.requires_api_key ? hasSecret(p.id) : true,
      healthError: conn?.health_error ?? null,
    };
  });

  // Determine the effective scope for assignments: explicit tenant or 'default'.
  const scope = tenantId ?? 'default';
  const prefsRow = await prisma.tenantPolicy.findUnique({ where: { tenant_id: scope } });
  const tenantPrefs =
    prefsRow?.model_preferences as unknown as Record<string, { provider: string; model: string }> | undefined;

  // Build per-capability assignments for every worker capability in the policy.
  // LLM workers (research/script) get selectable model candidates; media workers
  // (voice/subtitle/video) are shown as fixed local engines.
  const workerCaps = Object.keys(policy.defaults ?? {}).filter((c) => c.endsWith(':real'));
  const assignments: CapabilityAssignment[] = [];
  for (const cap of workerCaps) {
    const required = policy.worker_capabilities?.[cap] ?? [cap];
    const pref = tenantPrefs?.[cap];
    const current = pref ?? (policy.defaults[cap] ? { provider: policy.defaults[cap].provider, model: policy.defaults[cap].model } : null);
    const candidates = await listModelsForCapability([...connectedSet], required[0] ?? cap);
    assignments.push({
      capability: cap,
      label: CAPABILITY_LABELS[cap] ?? cap,
      requiredModelCaps: required,
      current,
      candidates: candidates.map((m) => ({ provider: m.provider, model: m.model })),
    });
  }

  // Add media workers (non-LLM) so the Founder sees the full pipeline.
  const mediaWorkers: Array<{ capability: string; label: string; requiredModelCaps: string[]; current: { provider: string; model: string } | null; candidates: Array<{ provider: string; model: string }> }> = [
    { capability: 'voice:tts', label: 'Voice Worker', requiredModelCaps: ['speech'], current: { provider: 'espeak-ng', model: 'espeak-ng' }, candidates: [] },
    { capability: 'subtitle:generate', label: 'Subtitle Worker', requiredModelCaps: ['speech'], current: { provider: 'local', model: 'ffmpeg-srt' }, candidates: [] },
    { capability: 'video:compose', label: 'Video Worker', requiredModelCaps: ['video'], current: { provider: 'ffmpeg', model: 'ffmpeg' }, candidates: [] },
  ];
  for (const mw of mediaWorkers) {
    if (!assignments.some((a) => a.capability === mw.capability)) assignments.push(mw);
  }

  return {
    providers,
    tenants: tenants.map((t) => ({ tenantId: t.tenant_id, brandVoice: t.brand_voice ?? '' })),
    assignments,
  };
}

/** Connect a provider (reuses Connection Manager). */
export async function connectProviderById(providerId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await connectProvider(providerId);
  return res.connected ? { ok: true } : { ok: false, error: res.error };
}

/** Disconnect a provider. */
export async function disconnectProviderById(providerId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await disconnectProvider(providerId);
  return res.disconnected ? { ok: true } : { ok: false, error: res.error };
}

/** Set (or replace) a provider's API key, stored encrypted at rest. */
export async function setProviderApiKeyById(
  providerId: string,
  apiKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await setProviderApiKey(providerId, apiKey);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

/** Delete a provider's stored API key + disconnect it. */
export async function deleteProviderApiKeyById(providerId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await deleteProviderApiKey(providerId);
  return res.deleted ? { ok: true } : { ok: false, error: res.error };
}

/** Upsert a tenant's brand knowledge (knowledge base). */
export async function saveTenantBrand(input: {
  tenant_id: string;
  brand_voice: string;
  language?: string;
  forbidden_terms?: string[];
  style_guide?: string;
}): Promise<void> {
  await upsertTenantKnowledge({
    tenant_id: input.tenant_id,
    brand_voice: input.brand_voice,
    language: input.language ?? 'en',
    forbidden_terms: input.forbidden_terms ?? [],
    style_guide: input.style_guide ?? undefined,
  });
}

/** Delete a tenant's knowledge entry. */
export async function removeTenantBrand(tenantId: string): Promise<void> {
  await deleteTenantKnowledge(tenantId);
  await prisma.tenantPolicy.deleteMany({ where: { tenant_id: tenantId } });
}

/**
 * Assign a model to a worker capability for a tenant (or 'default').
 * Validates capability-gated via ModelGate before persisting.
 */
export async function assignModelForCapability(input: {
  tenantId: string;
  capability: string;
  provider: string;
  model: string;
}): Promise<{ ok: boolean; error?: string }> {
  const gate = new ModelGate(loadModelPolicy());
  // Validate the override is connected + capable for the worker capability.
  const check = await gate.resolve(input.capability, { override: { provider: input.provider, model: input.model }, scope: input.tenantId === 'default' ? undefined : input.tenantId });
  if (!check.ok) return { ok: false, error: check.error?.message };

  // Persist as a tenant preference on the target tenant.
  const targetTenant = input.tenantId === 'default' ? 'default' : input.tenantId;
  const existing = targetTenant !== 'default'
    ? ((await prisma.tenantPolicy.findUnique({ where: { tenant_id: targetTenant } }))
        ?.model_preferences as unknown as Record<string, { provider: string; model: string }> | undefined)
    : undefined;
  await upsertTenantPolicy({
    tenant_id: targetTenant,
    model_preferences: { ...(existing ?? {}), [input.capability]: { provider: input.provider, model: input.model } },
  });
  return { ok: true };
}

export { JobStatus };
export { getTenantKnowledge };
