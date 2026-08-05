// Cost Intelligence (Milestone 7) — unit economics per tenant/capability/worker
// and budget reporting. Complements the tenant_policies cost_quota (M6).

import { prisma } from '@fyi/database';
import { tenantSummary, capabilitySummary, overallSummary } from './aggregate.js';

export interface UnitEconomics {
  cost_per_job: number;
  cost_per_video: number; // MVP: one job == one video
  tokens_per_dollar: number;
  avg_cost_per_ms: number;
}

/** Unit economics for a tenant (cost per job/video, token efficiency). */
export async function tenantUnitEconomics(tenant_id: string): Promise<UnitEconomics> {
  const s = await tenantSummary(tenant_id);
  const jobs = Math.max(s.jobs, 1);
  const tokens = s.tokens_in + s.tokens_out;
  const dollars = s.cost > 0 ? s.cost : 1;
  return {
    cost_per_job: round(s.cost / jobs),
    cost_per_video: round(s.cost / jobs),
    tokens_per_dollar: round(tokens / dollars),
    avg_cost_per_ms: round(s.cost / (s.duration_ms || 1)),
  };
}

/** Per-tenant cost report (all tenants), for the CLI. */
export async function tenantCostReport() {
  const tenants = await prisma.telemetry.findMany({
    select: { job: { select: { tenant_id: true } }, cost: true, tokens_in: true, tokens_out: true, duration_ms: true },
  });
  const byTenant: Record<string, { cost: number; tokens: number; duration: number; jobs: number }> = {};
  for (const t of tenants) {
    const tid = t.job?.tenant_id ?? 'unknown';
    if (!byTenant[tid]) byTenant[tid] = { cost: 0, tokens: 0, duration: 0, jobs: 0 };
    byTenant[tid].cost += Number(t.cost) || 0;
    byTenant[tid].tokens += (Number(t.tokens_in) || 0) + (Number(t.tokens_out) || 0);
    byTenant[tid].duration += Number(t.duration_ms) || 0;
    byTenant[tid].jobs += 1;
  }
  return byTenant;
}

/** Human-readable report builder for the CLI. */
export function formatReport(rows: Record<string, { cost: number; tokens: number; duration: number; jobs: number }>): string {
  const lines: string[] = [];
  lines.push(`${'Tenant'.padEnd(24)}${'Jobs'.padStart(6)}${'Cost ($)'.padStart(12)}${'Tokens'.padStart(14)}${'Duration (ms)'.padStart(16)}`);
  for (const [tenant, r] of Object.entries(rows)) {
    lines.push(
      `${tenant.padEnd(24)}${String(r.jobs).padStart(6)}${r.cost.toFixed(6).padStart(12)}${String(r.tokens).padStart(14)}${String(r.duration).padStart(16)}`,
    );
  }
  return lines.join('\n');
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export { tenantSummary, capabilitySummary, overallSummary };
