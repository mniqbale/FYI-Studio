// Provider usability probe (Opsi 4 — CTO workstream).
//
// For each CONNECTED provider, run ONE cheap generation against a representative
// model to determine whether the account can actually USE the model right now.
// This is deliberately per-provider (not per-model) so we don't fire dozens of
// API calls on every /settings load. Result is cached in-process for a short TTL.
//
// Distinguishes:
//   - usable:        the account can run the model (200)
//   - credit_depleted: 429 billing/quota exhausted (e.g. Gemini "prepayment credits are depleted")
//   - invalid_key:  401/403 auth failure
//   - unavailable:  model/endpoint not found (404) or generic error
//   - unreachable:  network error / timeout

const REPRESENTATIVE_MODELS: Record<string, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-haiku',
  openrouter: 'openrouter/auto',
  groq: 'llama-3.3-70b-versatile',
  together: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  azure: 'gpt-4o-mini',
  vertex: 'gemini-2.5-flash',
  // ollama + replicate have no free-form chat probe; treated as usable if connected.
};

export type ProviderUsability =
  | 'usable'
  | 'credit_depleted'
  | 'invalid_key'
  | 'unavailable'
  | 'unreachable'
  | 'no_probe';

export interface ProviderUsabilityResult {
  provider: string;
  status: ProviderUsability;
  reason: string;
  probedModel?: string;
}

const cache = new Map<string, { at: number; result: ProviderUsabilityResult }>();
const TTL_MS = 60_000;

/** Run a minimal chat completion to test whether a provider's account is usable. */
async function probeChat(provider: string, baseUrl: string, apiKey: string, model: string): Promise<ProviderUsabilityResult> {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  let headers: Record<string, string>;
  let body: unknown;
  let probeUrl = endpoint;

  if (provider === 'gemini' || provider === 'vertex') {
    // Gemini OpenAI-compatible endpoint expects Authorization: Bearer <key>.
    probeUrl = `${baseUrl.replace(/\/$/, '')}/openai/chat/completions`;
    headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
    body = { model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 };
  } else if (provider === 'anthropic') {
    // Anthropic has a different shape; use its messages endpoint.
    probeUrl = `${baseUrl.replace(/\/$/, '')}/messages`;
    headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
    body = { model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] };
  } else {
    headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
    body = { model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 };
  }

  try {
    return await doProbe(provider, probeUrl, headers, body);
  } catch (e) {
    return { provider, status: 'unreachable', reason: String(e), probedModel: model };
  }
}

async function doProbe(provider: string, url: string, headers: Record<string, string>, body: unknown): Promise<ProviderUsabilityResult> {
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  if (res.ok) return { provider, status: 'usable', reason: 'OK' };
  if (res.status === 429) {
    return { provider, status: 'credit_depleted', reason: '429 — credit/quota exhausted (billing depleted)' };
  }
  if (res.status === 401 || res.status === 403) {
    return { provider, status: 'invalid_key', reason: `${res.status} — unauthorized / invalid key` };
  }
  if (res.status === 404) {
    return { provider, status: 'unavailable', reason: '404 — model or endpoint not found' };
  }
  return { provider, status: 'unavailable', reason: `HTTP ${res.status}` };
}

/**
 * Determine whether a connected provider can actually run a model right now.
 * Returns a cached result. Providers without a probe (ollama, replicate) are
 * 'no_probe' (assumed usable if connected + key configured).
 */
export async function checkProviderUsability(
  provider: string,
  apiKey: string | undefined,
  baseUrl: string | undefined,
): Promise<ProviderUsabilityResult> {
  const cached = cache.get(provider);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.result;

  const result = await computeUsability(provider, apiKey, baseUrl);
  cache.set(provider, { at: Date.now(), result });
  return result;
}

async function computeUsability(
  provider: string,
  apiKey: string | undefined,
  baseUrl: string | undefined,
): Promise<ProviderUsabilityResult> {
  const model = REPRESENTATIVE_MODELS[provider];
  if (!model || !apiKey || !baseUrl) {
    return { provider, status: 'no_probe', reason: 'no representative model / key / base URL' };
  }
  try {
    return await probeChat(provider, baseUrl, apiKey, model);
  } catch {
    return { provider, status: 'unreachable', reason: 'network error' };
  }
}
