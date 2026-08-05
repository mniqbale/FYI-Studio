// Analytics aggregation (Milestone 7) — summarize telemetry across the job
// ledger: per tenant, per capability, per worker, and per job.

import { prisma } from '@fyi/database';

/** Aggregate cost/token/duration for a tenant (via joined jobs). */
export async function tenantSummary(tenant_id: string) {
  const rows = await prisma.telemetry.findMany({
    where: { job: { tenant_id } },
    select: { cost: true, tokens_in: true, tokens_out: true, duration_ms: true, provider: true, model: true },
  });
  return summarize(rows);
}

/** Aggregate cost/token/duration per capability across all tenants. */
export async function capabilitySummary() {
  // telemetry has no capability column; infer from job recipe step is complex.
  // For MVP, summarize by worker_id + provider + model as a capability proxy.
  const rows = await prisma.telemetry.findMany({
    select: { worker_id: true, cost: true, tokens_in: true, tokens_out: true, duration_ms: true, provider: true, model: true },
  });
  return groupBy(rows, (r) => r.worker_id);
}

/** Aggregate for a single job (all its step telemetry). */
export async function jobSummary(job_id: string) {
  const rows = await prisma.telemetry.findMany({
    where: { job_id },
    select: { cost: true, tokens_in: true, tokens_out: true, duration_ms: true, provider: true, model: true, worker_id: true },
  });
  return { job_id, ...summarize(rows) };
}

/** Grand totals across all telemetry. */
export async function overallSummary() {
  const rows = await prisma.telemetry.findMany({
    select: { cost: true, tokens_in: true, tokens_out: true, duration_ms: true },
  });
  return summarize(rows);
}

function summarize(rows: Array<{ cost: unknown; tokens_in: unknown; tokens_out: unknown; duration_ms: unknown }>) {
  let cost = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let durationMs = 0;
  for (const r of rows) {
    cost += Number(r.cost) || 0;
    tokensIn += Number(r.tokens_in) || 0;
    tokensOut += Number(r.tokens_out) || 0;
    durationMs += Number(r.duration_ms) || 0;
  }
  return {
    jobs: rows.length,
    cost,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    duration_ms: durationMs,
    avg_duration_ms: rows.length ? Math.round(durationMs / rows.length) : 0,
  };
}

function groupBy<T>(rows: T[], keyFn: (r: T) => string): Record<string, ReturnType<typeof summarize>> {
  const groups: Record<string, ReturnType<typeof summarize>> = {};
  for (const r of rows) {
    const rec = r as unknown as { cost?: unknown; tokens_in?: unknown; tokens_out?: unknown; duration_ms?: unknown };
    const k = keyFn(r);
    if (!groups[k]) {
      groups[k] = { jobs: 0, cost: 0, tokens_in: 0, tokens_out: 0, duration_ms: 0, avg_duration_ms: 0 };
    }
    groups[k].jobs += 1;
    groups[k].cost += Number(rec.cost) || 0;
    groups[k].tokens_in += Number(rec.tokens_in) || 0;
    groups[k].tokens_out += Number(rec.tokens_out) || 0;
    groups[k].duration_ms += Number(rec.duration_ms) || 0;
  }
  for (const k of Object.keys(groups)) {
    groups[k].avg_duration_ms = groups[k].jobs ? Math.round(groups[k].duration_ms / groups[k].jobs) : 0;
  }
  return groups;
}
