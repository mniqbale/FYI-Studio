// Memory enrichment (Milestone 7) — on job completion, record a performance
// memory entry (kind: 'performance') capturing cost/duration/status, feeding
// the Memory Layer (M4) for future context assembly.

import { prisma, Prisma, JobStatus } from '@fyi/database';

export interface EnrichMemoryInput {
  job_id: string;
}

/**
 * After a job finishes, write a performance memory entry for its tenant.
 * Returns the created MemoryEntry, or null if the job has no telemetry/tenant.
 */
export async function recordJobPerformance(job_id: string) {
  const job = await prisma.job.findUnique({ where: { id: job_id } });
  if (!job) return null;

  const telemetry = await prisma.telemetry.findMany({ where: { job_id } });
  let cost = 0;
  let durationMs = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  for (const t of telemetry) {
    cost += Number(t.cost) || 0;
    durationMs += Number(t.duration_ms) || 0;
    tokensIn += Number(t.tokens_in) || 0;
    tokensOut += Number(t.tokens_out) || 0;
  }

  return prisma.memoryEntry.create({
    data: {
      tenant_id: job.tenant_id,
      job_id: job.id,
      kind: 'performance',
      content: {
        status: job.status,
        cost,
        duration_ms: durationMs,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        recipe_id: job.recipe_id,
      } as unknown as Prisma.InputJsonValue,
    },
  });
}

/** Recent performance memory for a tenant (for context injection / reports). */
export async function recentPerformance(tenant_id: string, limit = 10) {
  return prisma.memoryEntry.findMany({
    where: { tenant_id, kind: 'performance' },
    orderBy: { created_at: 'desc' },
    take: limit,
  });
}
