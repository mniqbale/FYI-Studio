// Real API-key validation per provider (WS-A). Makes a lightweight, quota-free
// call to each provider's API to confirm the key actually works, so the user
// sees an inline status (valid / invalid / unreachable) instead of a generic
// error page. Never logs or persists the key.

import { getProvider } from './provider-registry.js';

export interface KeyValidationResult {
  provider: string;
  valid: boolean;
  /** Human-readable reason (shown inline in the UI). */
  reason: string;
  /** HTTP status from the provider when reachable. */
  status?: number;
}

/** Base URLs for validation calls (informational; real calls happen in workers). */
const VALIDATION_ENDPOINTS: Record<string, { url: string; method: 'GET' | 'POST'; headers?: Record<string, string> }> = {
  openai: { url: 'https://api.openai.com/v1/models', method: 'GET', headers: { Authorization: 'Bearer {KEY}' } },
  anthropic: { url: 'https://api.anthropic.com/v1/models', method: 'GET', headers: { 'x-api-key': '{KEY}', 'anthropic-version': '2023-06-01' } },
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/models?key={KEY}', method: 'GET' },
  openrouter: { url: 'https://openrouter.ai/api/v1/models', method: 'GET', headers: { Authorization: 'Bearer {KEY}' } },
  groq: { url: 'https://api.groq.com/openai/v1/models', method: 'GET', headers: { Authorization: 'Bearer {KEY}' } },
  ollama: { url: 'https://ollama.com/v1/models', method: 'GET', headers: { Authorization: 'Bearer {KEY}' } },
  replicate: { url: 'https://api.replicate.com/v1/models', method: 'GET', headers: { Authorization: 'Bearer {KEY}' } },
  together: { url: 'https://api.together.xyz/v1/models', method: 'GET', headers: { Authorization: 'Bearer {KEY}' } },
  azure: { url: 'https://api.openai.com/v1/models', method: 'GET', headers: { Authorization: 'Bearer {KEY}' } },
  vertex: { url: 'https://generativelanguage.googleapis.com/v1beta/models?key={KEY}', method: 'GET' },
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

  const endpoint = VALIDATION_ENDPOINTS[provider];
  if (!endpoint) return { provider, valid: false, reason: 'No validation endpoint for this provider' };

  try {
    const url = endpoint.url.replace('{KEY}', encodeURIComponent(apiKey.trim()));
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(endpoint.headers ?? {})) {
      headers[k] = v.replace('{KEY}', apiKey.trim());
    }
    const res = await fetch(url, { method: endpoint.method, headers, signal: AbortSignal.timeout(8000) });
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
