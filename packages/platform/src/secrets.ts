// Secret resolution for the AI Platform Foundation (ADR-0007 security).
//
// For the local MVP, API keys live in environment variables (git-ignored .env)
// or the OS secret prompt; the DB stores only a key_ref that resolves here.
// In production this would delegate to a real vault (e.g. HashiCorp Vault,
// AWS Secrets Manager) behind the same interface.
//
// Since the Founder wants to input/edit/delete API keys via the Dashboard UI,
// we also support ENCRYPTED at-rest storage: a key entered in the UI is
// encrypted with AES-256-GCM (master key from FYI_SECRET_KEY env) and the
// ciphertext is stored in provider_connections.key_ref as `enc:<iv>:<ct>:<tag>`.
// The plaintext is never persisted or logged.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

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
 * Derive a 32-byte AES-256 key from the FYI_SECRET_KEY master secret.
 * Falls back to a deterministic dev key (clearly marked) so the Codespace
 * works out of the box; production MUST set FYI_SECRET_KEY.
 */
function masterKey(): Buffer {
  const master = process.env.FYI_SECRET_KEY ?? 'fyi-dev-master-key-do-not-use-in-prod';
  return createHash('sha256').update(master).digest();
}

/** Encrypt a secret with AES-256-GCM. Returns `enc:<iv>:<ciphertext>:<tag>` (all base64url). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('base64url')}:${ct.toString('base64url')}:${tag.toString('base64url')}`;
}

/** Decrypt a value produced by encryptSecret. Returns undefined on failure. */
export function decryptSecret(blob: string): string | undefined {
  try {
    const [prefix, ivB64, ctB64, tagB64] = blob.split(':');
    if (prefix !== 'enc' || !ivB64 || !ctB64 || !tagB64) return undefined;
    const decipher = createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return undefined;
  }
}

/** Whether a key_ref points to an encrypted at-rest secret. */
export function isEncryptedRef(ref: string): boolean {
  return ref.startsWith('enc:');
}

/**
 * Resolve a provider's API key. Order:
 *   1. If the connection's key_ref is an encrypted blob, decrypt it.
 *   2. Otherwise read from the environment (env var or alias).
 * Returns undefined if not resolvable. Callers must never log or persist the key.
 */
export function resolveSecret(provider: string, keyRef?: string | null): string | undefined {
  if (keyRef && isEncryptedRef(keyRef)) {
    const decrypted = decryptSecret(keyRef);
    if (decrypted) return decrypted;
  }
  const primary = process.env[envVarName(provider)];
  if (primary) return primary;
  for (const alias of SECRET_ALIASES[provider] ?? []) {
    const v = process.env[alias];
    if (v) return v;
  }
  return undefined;
}

/** Whether a key is configured for the provider (without exposing it). */
export function hasSecret(provider: string, keyRef?: string | null): boolean {
  return Boolean(resolveSecret(provider, keyRef));
}

/** A deterministic, non-reversible-ish reference for the secret (env var name). */
export function secretRef(provider: string): string {
  return `env:${envVarName(provider)}`;
}
