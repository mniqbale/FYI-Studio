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
  const tokenRef = encryptTokenBundle(opts.tokenBundle);
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
