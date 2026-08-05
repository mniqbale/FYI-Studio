// Memory Layer (Milestone 4, MVP) — historical performance, edits, and audience
// analytics per tenant. JSONB content is schema-flexible for MVP; used to
// inform future context assembly (e.g. "shorten videos" after low retention).

import { prisma, Prisma } from '@fyi/database';
import type { MemoryEntry } from '@fyi/database';

export type MemoryKind = 'performance' | 'edit' | 'analytics';

/** Input for a memory entry. */
export interface MemoryInput {
  tenant_id: string;
  kind: MemoryKind;
  content: Record<string, unknown>;
  job_id?: string;
}

/** Create a memory entry. */
export async function addMemory(input: MemoryInput): Promise<MemoryEntry> {
  return prisma.memoryEntry.create({
    data: {
      tenant_id: input.tenant_id,
      kind: input.kind,
      content: input.content as unknown as Prisma.InputJsonValue,
      job_id: input.job_id ?? null,
    },
  });
}

/** Recent memory entries for a tenant, optionally filtered by kind. */
export async function listMemory(
  tenant_id: string,
  opts: { kind?: MemoryKind; limit?: number } = {},
): Promise<MemoryEntry[]> {
  return prisma.memoryEntry.findMany({
    where: { tenant_id, kind: opts.kind },
    orderBy: { created_at: 'desc' },
    take: opts.limit ?? 20,
  });
}

/** Delete memory entries for a tenant (optionally by kind). */
export async function clearMemory(tenant_id: string, kind?: MemoryKind): Promise<void> {
  await prisma.memoryEntry.deleteMany({ where: { tenant_id, kind } });
}
