// Knowledge Layer (Milestone 4) — the "flattened brain" per MVP architecture:
// brand voice, style guides, verified facts, asset library pointers, and
// per-channel constraints stored in the `tenant_context` PostgreSQL table.
// No vector DB for MVP.

import { prisma, Prisma } from '@fyi/database';
import type { TenantContext } from '@fyi/database';

/** Input for creating or updating a tenant's knowledge base entry. */
export interface KnowledgeInput {
  tenant_id: string;
  brand_voice?: string;
  language?: string;
  style_guide?: string;
  verified_facts?: string[];
  asset_library?: string[]; // S3 pointers only
  forbidden_terms?: string[];
  constraints?: Record<string, unknown>;
}

/** Upsert a tenant's knowledge base entry (idempotent by tenant_id). */
export async function upsertTenantKnowledge(input: KnowledgeInput): Promise<TenantContext> {
  if (!input.tenant_id) throw new Error('tenant_id is required');
  const data = {
    brand_voice: input.brand_voice ?? null,
    language: input.language ?? 'en',
    style_guide: input.style_guide ?? null,
    // Json fields: pass raw arrays/objects — Prisma serializes to JSONB.
    verified_facts: (input.verified_facts ?? []) as unknown as Prisma.InputJsonValue,
    asset_library: (input.asset_library ?? []) as unknown as Prisma.InputJsonValue,
    forbidden_terms: (input.forbidden_terms ?? []) as unknown as Prisma.InputJsonValue,
    constraints: (input.constraints ?? {}) as unknown as Prisma.InputJsonValue,
  };
  return prisma.tenantContext.upsert({
    where: { tenant_id: input.tenant_id },
    update: data,
    create: { tenant_id: input.tenant_id, ...data },
  });
}

/** Get a tenant's knowledge base entry, or null if none exists. */
export async function getTenantKnowledge(tenant_id: string): Promise<TenantContext | null> {
  return prisma.tenantContext.findUnique({ where: { tenant_id } });
}

/** Delete a tenant's knowledge base entry. */
export async function deleteTenantKnowledge(tenant_id: string): Promise<void> {
  await prisma.tenantContext.deleteMany({ where: { tenant_id } });
}

/** List all tenant knowledge entries (optionally scoped). */
export async function listTenantKnowledge(): Promise<TenantContext[]> {
  return prisma.tenantContext.findMany({ orderBy: { tenant_id: 'asc' } });
}
