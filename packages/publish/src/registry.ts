// Social account registry CRUD (Issue 9.2 / ADR-0008). Stores only a `token_ref`
// (never the OAuth token material — ADR-0006/0007). Writes happen ONLY through
// this module so all callers share the same invariants (token stored by
// reference, disconnect keeps history via `enabled=false`).

import { prisma, type SocialAccount } from '@fyi/database';
import { storeSecret } from './secret.js';

/** Supported social platforms (YouTube-first). */
export const SUPPORTED_PLATFORMS = ['youtube', 'facebook', 'instagram', 'tiktok'] as const;

export interface ConnectSocialAccountInput {
  tenant_id: string;
  platform: string;
  display_name: string;
  account_ref: string;
  access_token: string;
}

export interface SocialAccountView {
  id: string;
  tenant_id: string;
  platform: string;
  display_name: string;
  account_ref: string;
  token_ref: string;
  enabled: boolean;
  connected_at: Date;
  last_sync_at: Date | null;
}

function toView(row: SocialAccount): SocialAccountView {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    platform: row.platform,
    display_name: row.display_name,
    account_ref: row.account_ref,
    token_ref: row.token_ref,
    enabled: row.enabled,
    connected_at: row.connected_at,
    last_sync_at: row.last_sync_at,
  };
}

/**
 * Connect a social account: stores the token material by reference (never the
 * token), then upserts the account row keyed on (tenant_id, platform) so a
 * tenant can hold at most one account per platform.
 *
 * NOTE: the schema only declares a non-unique index on (tenant_id, platform),
 * so we emulate the upsert manually (find-then-update/create) rather than
 * relying on a Prisma compound-unique constraint.
 */
export async function connectSocialAccount(
  input: ConnectSocialAccountInput,
): Promise<SocialAccountView> {
  const tokenRef = await storeSecret(input.access_token);
  const existing = await prisma.socialAccount.findFirst({
    where: { tenant_id: input.tenant_id, platform: input.platform },
  });

  let row: SocialAccount;
  if (existing) {
    row = await prisma.socialAccount.update({
      where: { id: existing.id },
      data: {
        display_name: input.display_name,
        account_ref: input.account_ref,
        token_ref: tokenRef,
        enabled: true,
        connected_at: new Date(),
      },
    });
  } else {
    row = await prisma.socialAccount.create({
      data: {
        tenant_id: input.tenant_id,
        platform: input.platform,
        display_name: input.display_name,
        account_ref: input.account_ref,
        token_ref: tokenRef,
      },
    });
  }
  return toView(row);
}

/** List social accounts for a tenant (optionally only enabled). */
export async function listSocialAccounts(
  tenantId: string,
  enabledOnly = false,
): Promise<SocialAccountView[]> {
  const rows = await prisma.socialAccount.findMany({
    where: { tenant_id: tenantId, ...(enabledOnly ? { enabled: true } : {}) },
    orderBy: { created_at: 'asc' },
  });
  return rows.map(toView);
}

/** Get a single social account by id + tenant (returns null if not found). */
export async function getSocialAccount(
  id: string,
  tenantId: string,
): Promise<SocialAccountView | null> {
  const row = await prisma.socialAccount.findFirst({
    where: { id, tenant_id: tenantId },
  });
  return row ? toView(row) : null;
}

/**
 * Disconnect a social account: disables it but KEEPS history (per ADR-0008).
 * Returns the updated view, or null if the account was not found.
 */
export async function disconnectSocialAccount(
  id: string,
  tenantId: string,
): Promise<SocialAccountView | null> {
  const existing = await getSocialAccount(id, tenantId);
  if (!existing) return null;
  const row = await prisma.socialAccount.update({
    where: { id },
    data: { enabled: false },
  });
  return toView(row);
}

/** Permanently delete a social account (cascades scheduled publishes). */
export async function deleteSocialAccount(
  id: string,
  tenantId: string,
): Promise<boolean> {
  const existing = await getSocialAccount(id, tenantId);
  if (!existing) return false;
  await prisma.socialAccount.delete({ where: { id } });
  return true;
}
