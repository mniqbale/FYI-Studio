// Connection Manager — lifecycle of provider connections (ADR-0007).
//
// Connect / list / disconnect a provider connection in the ledger. The API key
// is never stored in the DB — only a key_ref that resolves via secrets.ts.
// For the local MVP, "validation" confirms the key is configured (present and
// non-empty); a real network health-check is a provider-adapter concern that
// arrives with the Cognitive Core (Milestone 3) so tests stay hermetic.

import { prisma, ConnectionStatus } from '@fyi/database';
import { createTaskLogger } from '@fyi/utils';
import { getProvider } from './provider-registry.js';
import { hasSecret, secretRef } from './secrets.js';

export interface ConnectResult {
  connected: boolean;
  provider: string;
  error?: string;
}

/** Connect a provider. Persists a key_ref (never the key). */
export async function connectProvider(
  providerId: string,
  opts: { scope?: string } = {},
): Promise<ConnectResult> {
  const provider = getProvider(providerId);
  if (!provider) {
    return { connected: false, provider: providerId, error: `Unknown provider: ${providerId}` };
  }

  // Key required but not configured.
  if (provider.requires_api_key && !hasSecret(providerId)) {
    return {
      connected: false,
      provider: providerId,
      error: `No API key configured for ${providerId}. Set ${providerId.toUpperCase()}_API_KEY (e.g. via .env or env var).`,
    };
  }

  const scope = opts.scope ?? 'default';
  const keyRef = provider.requires_api_key ? secretRef(providerId) : 'none';

  const existing = await prisma.providerConnection.findUnique({
    where: { idx_provider_scope_unique: { provider: providerId, scope } },
  });

  if (existing) {
    await prisma.providerConnection.update({
      where: { id: existing.id },
      data: { key_ref: keyRef, status: ConnectionStatus.CONNECTED, health_error: null },
    });
  } else {
    await prisma.providerConnection.create({
      data: { provider: providerId, scope, key_ref: keyRef, status: ConnectionStatus.CONNECTED },
    });
  }

  createTaskLogger({ job_id: 'platform', execution_id: 'none' }).info(
    { provider: providerId, scope, requires_api_key: provider.requires_api_key },
    'Provider connected',
  );

  return { connected: true, provider: providerId };
}

/** List connected providers (optionally for a scope). */
export async function listConnections(opts: { scope?: string } = {}) {
  const where = opts.scope ? { scope: opts.scope } : {};
  return prisma.providerConnection.findMany({ where, orderBy: { provider: 'asc' } });
}

/** Disconnect a provider (removes the connection row). */
export async function disconnectProvider(
  providerId: string,
  opts: { scope?: string } = {},
): Promise<{ disconnected: boolean; error?: string }> {
  const scope = opts.scope ?? 'default';
  const existing = await prisma.providerConnection.findUnique({
    where: { idx_provider_scope_unique: { provider: providerId, scope } },
  });
  if (!existing) {
    return { disconnected: false, error: `No connection for provider: ${providerId}` };
  }
  await prisma.providerConnection.delete({ where: { id: existing.id } });
  createTaskLogger({ job_id: 'platform', execution_id: 'none' }).info(
    { provider: providerId, scope },
    'Provider disconnected',
  );
  return { disconnected: true };
}

/** Which providers are currently connected (for ModelGate v2). */
export async function connectedProviderIds(opts: { scope?: string } = {}): Promise<string[]> {
  const rows = await listConnections(opts);
  return rows.filter((r) => r.status === ConnectionStatus.CONNECTED).map((r) => r.provider);
}
