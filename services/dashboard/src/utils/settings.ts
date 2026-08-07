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
  resolveSecret,
  listModels,
  setProviderApiKey,
  deleteProviderApiKey,
  validateProviderKey,
} from '@fyi/platform';
import {
  upsertTenantKnowledge,
  getTenantKnowledge,
  deleteTenantKnowledge,
  listTenantKnowledge,
} from '@fyi/knowledge';
import { prisma, JobStatus } from '../utils/prisma.js';
import { checkProviderUsability, type ProviderUsabilityResult } from './provider-usability.js';

export interface ProviderView {
  id: string;
  name: string;
  requiresApiKey: boolean;
  connected: boolean;
  keyConfigured: boolean;
  healthError: string | null;
  /** Usability probe result (Opsi 4). null when not probed. */
  usability: ProviderUsabilityResult | null;
}

export interface CapabilityAssignment {
  capability: string;
  label: string;
  requiredModelCaps: string[];
  current: { provider: string; model: string } | null;
  candidates: Array<{ provider: string; model: string }>;
  /** 'llm' for text workers, 'media' for voice/subtitle/video. */
  kind: 'llm' | 'media';
  /** Short user-facing note explaining why a media worker shows what it does. */
  note?: string;
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

/** Short user-facing note per media worker (shown in the UI). */
const MEDIA_WORKER_NOTES: Record<string, string> = {
  'voice:tts': 'TTS (text-to-speech). Default: espeak-ng (offline, robot). Assign an AI TTS model (e.g. replicate/kokoro-82m — natural voice, ~$0.0023/run; or openai/tts-1) if connected.',
  'subtitle:generate': 'Transcription (speech-to-text). Default: local ffmpeg. Assign an ASR model (e.g. openai/whisper-1) if connected.',
  'video:compose': 'Video composition. Default: ffmpeg (offline). Assign an AI video model (e.g. gemini/veo-3, openai/sora) if connected.',
};

/** Workers that are driven by an LLM model (selectable). Media workers are not. */
const LLM_WORKER_CAPS = new Set(['research:real', 'text-synthesis:script:real']);

/**
 * Discover models actually available on a connected provider. Returns a list of
 * { provider, model } that the user may not have in the seeded registry.
 * Never throws — returns [] on error.
 *
 * Round 3 fix: implement discovery for ALL providers (not just Ollama) so the
 * user sees the provider's real, current model list — not just the few seeded
 * in model_policy.yaml. Uses the provider's /models endpoint (OpenAI-compatible
 * for openai/openrouter/groq/together; Anthropic and Gemini have their own).
 */
export async function discoverProviderModels(provider: string): Promise<Array<{ provider: string; model: string }>> {
  // Cache discovery per provider so repeated page loads are fast (the model
  // list on a provider rarely changes within a minute). Mirrors the probe cache.
  const cached = discoveryCache.get(provider);
  if (cached && Date.now() - cached.at < DISCOVERY_TTL_MS) return cached.models;
  const models = await discoverProviderModelsUncached(provider);
  discoveryCache.set(provider, { at: Date.now(), models });
  return models;
}

const discoveryCache = new Map<string, { at: number; models: Array<{ provider: string; model: string }> }>();
const DISCOVERY_TTL_MS = 60_000;

async function discoverProviderModelsUncached(provider: string): Promise<Array<{ provider: string; model: string }>> {
  try {
    const base = process.env[`${provider.toUpperCase()}_BASE_URL`] ?? PROVIDER_BASE_URLS[provider];
    if (!base) return [];
    const url = `${base.replace(/\/$/, '')}/models`;

    // Gemini (generativelanguage) REQUIRES an API key on every request — either
    // as ?key= query param or x-goog-api-key header. Without it the endpoint
    // returns 403 and discovery silently yields []. Inject the key when present.
    const headers: Record<string, string> = {};
    if (provider === 'gemini' || provider === 'vertex') {
      const key = process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
      if (key) {
        headers['x-goog-api-key'] = key;
      }
    }

    const res = await fetch(url, { headers, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      models?: Array<{ name?: string; model?: string; id?: string }>;
      data?: Array<{ id?: string; name?: string; model?: string }>;
    };
    // Gemini returns { models: [{ name: "models/gemini-2.5-flash", ... }] };
    // OpenAI-compatible returns { data: [{ id }] }; /api/tags returns
    // { models: [{ name }] }. Normalize: strip a "models/" prefix.
    const list = data.models ?? data.data ?? [];
    const names = list
      .map((m) => (m.name ?? m.model ?? m.id ?? '').replace(/^models\//, ''))
      .filter(Boolean);
    return names.map((model) => ({ provider, model }));
  } catch {
    return [];
  }
}

/** Base URLs for model discovery per provider (informational). */
const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
  ollama: 'https://ollama.com/v1',
  replicate: 'https://api.replicate.com/v1',
  together: 'https://api.together.xyz/v1',
  azure: 'https://api.openai.com/v1',
  vertex: 'https://generativelanguage.googleapis.com/v1beta',
};

/** Read-only snapshot of providers + connections + tenants + model assignments. */
export async function getSettingsOverview(
  tenantId?: string,
  opts: { probeUsability?: boolean } = {},
): Promise<SettingsOverview> {
  const { probeUsability = true } = opts;
  await seedRegistries();
  const [connections, tenants, allModels] = await Promise.all([
    listConnections(),
    listTenantKnowledge(),
    listModels(),
  ]);
  const policy = loadModelPolicy();
  const connectedSet = new Set(connections.filter((c) => c.status === 'CONNECTED').map((c) => c.provider));

  const providers: ProviderView[] = [];
  // Probe usability for connected+configured providers IN PARALLEL so one slow
  // provider doesn't stall the whole page (some are credit-blocked and time out).
  // Only run when requested (the Overview neuron graph doesn't need badges).
  const probeJobs: Array<{ id: string; promise: Promise<ProviderUsabilityResult> }> = [];
  if (probeUsability) {
    for (const p of PROVIDER_CATALOG) {
      const conn = connections.find((c) => c.provider === p.id && c.scope === 'default');
      const connected = connectedSet.has(p.id);
      const keyConfigured = p.requires_api_key ? hasSecret(p.id) : true;
      if (connected && keyConfigured) {
        const apiKey = p.requires_api_key ? resolveSecret(p.id, conn?.key_ref) : undefined;
        probeJobs.push({ id: p.id, promise: checkProviderUsability(p.id, apiKey, p.base_url) });
      }
    }
  }
  const usabilityById = new Map<string, ProviderUsabilityResult>();
  if (probeJobs.length > 0) {
    const settled = await Promise.allSettled(probeJobs.map((j) => j.promise));
    settled.forEach((s, i) => {
      const job = probeJobs[i];
      if (job && s.status === 'fulfilled') usabilityById.set(job.id, s.value);
    });
  }
  for (const p of PROVIDER_CATALOG) {
    const conn = connections.find((c) => c.provider === p.id && c.scope === 'default');
    const connected = connectedSet.has(p.id);
    const keyConfigured = p.requires_api_key ? hasSecret(p.id) : true;
    providers.push({
      id: p.id,
      name: p.name,
      requiresApiKey: p.requires_api_key,
      connected,
      keyConfigured,
      healthError: conn?.health_error ?? null,
      usability: usabilityById.get(p.id) ?? null,
    });
  }

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

    // Merge discovered models (from connected providers) into the candidates so
    // the user sees ALL available models, not just the seeded ones (WS-B).
    const discovered = new Map<string, { provider: string; model: string }>();
    for (const provider of connectedSet) {
      const models = await discoverProviderModels(provider);
      for (const m of models) discovered.set(`${m.provider}:${m.model}`, m);
    }
    const candidateSet = new Map<string, { provider: string; model: string }>();
    for (const c of candidates) candidateSet.set(`${c.provider}:${c.model}`, { provider: c.provider, model: c.model });
    for (const [, m] of discovered) if (!candidateSet.has(`${m.provider}:${m.model}`)) candidateSet.set(`${m.provider}:${m.model}`, m);

    assignments.push({
      capability: cap,
      label: CAPABILITY_LABELS[cap] ?? cap,
      requiredModelCaps: required,
      current,
      candidates: [...candidateSet.values()],
      kind: 'llm',
    });
  }

  // Add media workers (voice/subtitle/video) so the Founder sees the full
  // pipeline. These are selectable too (WS-B round 2): the user can assign an
  // AI model from any connected provider's discovered models, defaulting to
  // the local engine. This surfaces ALL Ollama :cloud models (nemotron, gemma,
  // etc.) for every worker, not just the seeded ones.
  const mediaWorkers: Array<{ capability: string; label: string; requiredModelCaps: string[]; current: { provider: string; model: string } | null; candidates: Array<{ provider: string; model: string }> }> = [
    { capability: 'voice:tts', label: 'Voice Worker', requiredModelCaps: ['speech'], current: { provider: 'espeak-ng', model: 'espeak-ng' }, candidates: [] },
    { capability: 'subtitle:generate', label: 'Subtitle Worker', requiredModelCaps: ['transcription'], current: { provider: 'local', model: 'ffmpeg-srt' }, candidates: [] },
    { capability: 'video:compose', label: 'Video Worker', requiredModelCaps: ['video'], current: { provider: 'ffmpeg', model: 'ffmpeg' }, candidates: [] },
  ];
  for (const mw of mediaWorkers) {
    if (assignments.some((a) => a.capability === mw.capability)) continue;
    // Candidates: seeded models that support the capability + ALL discovered
    // models from connected providers (so nemotron/gemma/etc. appear).
    const seeded = await listModelsForCapability([...connectedSet], mw.requiredModelCaps[0] ?? mw.capability);
    const discovered = new Map<string, { provider: string; model: string }>();
    for (const provider of connectedSet) {
      const models = await discoverProviderModels(provider);
      for (const m of models) discovered.set(`${m.provider}:${m.model}`, m);
    }
    const candidateSet = new Map<string, { provider: string; model: string }>();
    for (const c of seeded) candidateSet.set(`${c.provider}:${c.model}`, { provider: c.provider, model: c.model });
    for (const [, m] of discovered) if (!candidateSet.has(`${m.provider}:${m.model}`)) candidateSet.set(`${m.provider}:${m.model}`, m);
    assignments.push({ ...mw, candidates: [...candidateSet.values()], kind: 'media', note: MEDIA_WORKER_NOTES[mw.capability] });
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

/** Validate a provider's API key against the real provider API. */
export async function validateProviderKeyById(
  providerId: string,
  apiKey: string,
): Promise<{ ok: boolean; reason?: string; status?: number }> {
  const res = await validateProviderKey(providerId, apiKey);
  return { ok: res.valid, reason: res.reason, status: res.status };
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
 *
 * Fix (round 3): discovered models (e.g. from Ollama /v1/models) are NOT in
 * the seeded model_registry, so ModelGate validation would reject them as
 * INCOMPATIBLE_MODEL. Before validating, we upsert the model into the registry
 * with the required capabilities so a discovered model can be assigned.
 */
export async function assignModelForCapability(input: {
  tenantId: string;
  capability: string;
  provider: string;
  model: string;
}): Promise<{ ok: boolean; error?: string }> {
  const policy = loadModelPolicy();
  const gate = new ModelGate(policy);

  // Register the model in the registry (if not present) with the required
  // capabilities for this worker capability, so ModelGate can validate it.
  const required = policy.worker_capabilities?.[input.capability] ?? [input.capability];
  const modelRow = await prisma.modelRegistry.findUnique({
    where: { idx_model_provider_model_unique: { provider: input.provider, model: input.model } },
  });
  if (!modelRow) {
    await prisma.modelRegistry.create({
      data: {
        provider: input.provider,
        model: input.model,
        capabilities: required,
        status: 'ACTIVE',
      },
    });
  } else {
    // Ensure the model carries the required capabilities for this worker.
    const caps = (modelRow.capabilities as string[]) ?? [];
    const merged = [...new Set([...caps, ...required])];
    if (merged.length !== caps.length) {
      await prisma.modelRegistry.update({
        where: { id: modelRow.id },
        data: { capabilities: merged },
      });
    }
  }

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

/** Get the worker→model assignment map for the Overview neuron graph (WS-E). */
export async function getWorkerAssignments(): Promise<
  Array<{ capability: string; label: string; provider: string; model: string }>
> {
  const overview = await getSettingsOverview(undefined, { probeUsability: false });
  return overview.assignments.map((a) => ({
    capability: a.capability,
    label: a.label,
    provider: a.current?.provider ?? '—',
    model: a.current?.model ?? '—',
  }));
}
