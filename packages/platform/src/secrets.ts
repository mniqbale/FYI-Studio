// Secret resolution for the AI Platform Foundation (ADR-0007 security).
//
// For the local MVP, API keys live in environment variables (git-ignored .env)
// or the OS secret prompt; the DB stores only a key_ref that resolves here.
// In production this would delegate to a real vault (e.g. HashiCorp Vault,
// AWS Secrets Manager) behind the same interface.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Convention: key material env var for a provider, e.g. OPENAI_API_KEY. */
function envVarName(provider: string): string {
  return `${provider.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`;
}

/** Alternate env var names accepted for a provider (e.g. CLAUDE_API_KEY for anthropic). */
const SECRET_ALIASES: Record<string, string[]> = {
  anthropic: ['CLAUDE_API_KEY'],
};

/** Load `.env` into the process env if present (idempotent, never overrides). */
export function loadEnvIfPresent(cwd = process.cwd()): void {
  const envPath = resolve(cwd, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(idx + 1).trim();
  }
}

/**
 * Resolve a provider's API key from the environment. Returns undefined if not set.
 * Callers must never log or persist the returned key.
 */
export function resolveSecret(provider: string): string | undefined {
  const primary = process.env[envVarName(provider)];
  if (primary) return primary;
  for (const alias of SECRET_ALIASES[provider] ?? []) {
    const v = process.env[alias];
    if (v) return v;
  }
  return undefined;
}

/** Whether a key is configured for the provider (without exposing it). */
export function hasSecret(provider: string): boolean {
  return Boolean(resolveSecret(provider));
}

/** A deterministic, non-reversible-ish reference for the secret (env var name). */
export function secretRef(provider: string): string {
  return `env:${envVarName(provider)}`;
}
