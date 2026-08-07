// Real API-key validation per provider (WS-A). Makes a lightweight, quota-free
// call to each provider's API to confirm the key actually works, so the user
// sees an inline status (valid / invalid / unreachable) instead of a generic
// error page. Never logs or persists the key.
//
// Base URLs come from the single source of truth (@fyi/platform
// provider-registry via getProviderBaseUrl, which honors <PROVIDER>_BASE_URL).

import { getProvider, getProviderBaseUrl } from './provider-registry.js';

export interface KeyValidationResult {
  provider: string;
  valid: boolean;
  /** Human-readable reason (shown inline in the UI). */
  reason: string;
  /** HTTP status from the provider when reachable. */
  status?: number;
}

/** Per-provider validation call shape (path + auth header template). */
const VALIDATION_SPEC: Record<string, { path: string; auth: 'bearer' | 'x-api-key' | 'query' }> = {
  openai: { path: '/models', auth: 'bearer' },
  anthropic: { path: '/models', auth: 'x-api-key' },
  gemini: { path: '/models', auth: 'query' },
  openrouter: { path: '/models', auth: 'bearer' },
  groq: { path: '/models', auth: 'bearer' },
  ollama: { path: '/models', auth: 'bearer' },
  replicate: { path: '/models', auth: 'bearer' },
  together: { path: '/models', auth: 'bearer' },
  azure: { path: '/models', auth: 'bearer' },
  vertex: { path: '/models', auth: 'query' },
};

/**
 * Validate an API key against the provider's real API. Returns a result with a
 * human-readable reason. Never throws — returns { valid: false, reason } on any
 * network/parse error so the UI can show a clear inline status.
 */
export async function validateProviderKey(provider: string, apiKey: string): Promise<KeyValidationResult> {
  const def = getProvider(provider);
  if (!def) return { provider, valid: false, reason: `Unknown provider: ${provider}` };
  if (!apiKey || !apiKey.trim()) return { provider, valid: false, reason: 'API key is empty' };

  const spec = VALIDATION_SPEC[provider];
  if (!spec) return { provider, valid: false, reason: 'No validation endpoint for this provider' };

  const base = getProviderBaseUrl(provider);
  if (!base) return { provider, valid: false, reason: `No base URL for provider: ${provider}` };

  try {
    let url = `${base.replace(/\/$/, '')}${spec.path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (spec.auth === 'bearer') headers.Authorization = `Bearer ${apiKey.trim()}`;
    if (spec.auth === 'x-api-key') {
      headers['x-api-key'] = apiKey.trim();
      headers['anthropic-version'] = '2023-06-01';
    }
    if (spec.auth === 'query') url = `${url}?key=${encodeURIComponent(apiKey.trim())}`;

    const res = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(8000) });
    if (res.ok) return { provider, valid: true, reason: 'API key valid', status: res.status };
    if (res.status === 401 || res.status === 403) {
      return { provider, valid: false, reason: 'API key invalid (401/403 — unauthorized)', status: res.status };
    }
    return { provider, valid: false, reason: `Provider returned HTTP ${res.status}`, status: res.status };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { provider, valid: false, reason: `Cannot reach provider: ${msg}` };
  }
}
