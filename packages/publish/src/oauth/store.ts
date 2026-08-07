// OAuth token store for social accounts (workstream 1).
//
// Stores OAuth token material ENCRYPTED (AES-256-GCM via @fyi/platform
// encryptSecret) in the social_account.token_ref, so a connected channel
// survives restarts (unlike the in-memory secret store). The refresh token is
// kept so the access token can be renewed. Never stores plaintext.

import { prisma } from '@fyi/database';
import { encryptSecret, decryptSecret } from '@fyi/platform';

export interface OAuthTokenBundle {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  /** Epoch ms when the access token was issued (set on persist). */
  issued_at?: number;
}

/** Encrypt a token bundle into a single `enc:` blob for token_ref. */
export function encryptTokenBundle(bundle: OAuthTokenBundle): string {
  return encryptSecret(JSON.stringify(bundle));
}

/** Decrypt a token bundle from an `enc:` blob. Returns null on failure. */
export function decryptTokenBundle(blob: string): OAuthTokenBundle | null {
  const plain = decryptSecret(blob);
  if (!plain) return null;
  try {
    return JSON.parse(plain) as OAuthTokenBundle;
  } catch {
    return null;
  }
}

/**
 * Persist a connected YouTube channel as a social account, storing the token
 * bundle encrypted. Returns the created account view.
 */
export async function persistOAuthAccount(opts: {
  tenant_id: string;
  platform: string;
  display_name: string;
  account_ref: string;
  tokenBundle: OAuthTokenBundle;
}): Promise<{ id: string; token_ref: string }> {
  const bundle: OAuthTokenBundle = { ...opts.tokenBundle, issued_at: Date.now() };
  const tokenRef = encryptTokenBundle(bundle);
  const row = await prisma.socialAccount.create({
    data: {
      tenant_id: opts.tenant_id,
      platform: opts.platform,
      display_name: opts.display_name,
      account_ref: opts.account_ref,
      token_ref: tokenRef,
      enabled: true,
      connected_at: new Date(),
    },
  });
  return { id: row.id, token_ref: row.token_ref };
}

/** Read the decrypted token bundle for a social account. Returns null if absent. */
export async function readOAuthToken(accountId: string): Promise<OAuthTokenBundle | null> {
  const row = await prisma.socialAccount.findUnique({ where: { id: accountId } });
  if (!row) return null;
  return decryptTokenBundle(row.token_ref);
}

/** Whether an access token is still valid (issued_at + expires_in, 60s safety). */
export function isTokenExpired(bundle: OAuthTokenBundle): boolean {
  if (!bundle.issued_at) return true; // unknown issued time -> treat as needing refresh
  const expiresMs = bundle.expires_in * 1000;
  return Date.now() > bundle.issued_at + expiresMs - 60_000;
}

/**
 * Get a valid access token for an account, refreshing it via the refresh token
 * when expired. Persists the refreshed bundle (encrypted). Returns undefined
 * when no token or refresh is possible.
 */
export async function getValidAccessToken(
  accountId: string,
  refresh: (bundle: OAuthTokenBundle) => Promise<OAuthTokenBundle | null>,
): Promise<string | undefined> {
  const bundle = await readOAuthToken(accountId);
  if (!bundle?.access_token) return undefined;
  if (!isTokenExpired(bundle)) return bundle.access_token;

  // Access token expired — refresh using the refresh token.
  if (!bundle.refresh_token) return undefined;
  const refreshed = await refresh(bundle);
  if (!refreshed?.access_token) return undefined;

  // Persist the refreshed bundle (keep the existing refresh token unless a new one came).
  const merged: OAuthTokenBundle = {
    ...refreshed,
    refresh_token: refreshed.refresh_token ?? bundle.refresh_token,
    issued_at: Date.now(),
  };
  await prisma.socialAccount.update({
    where: { id: accountId },
    data: { token_ref: encryptTokenBundle(merged), last_sync_at: new Date() },
  });
  return merged.access_token;
}
