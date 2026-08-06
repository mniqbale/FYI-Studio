// Read-only data access for the Dashboard. Builds projections over the Job
// Ledger using @fyi/database (Prisma) and @fyi/analytics. NO writes allowed.
//
// NOTE: This module intentionally wraps the REAL @fyi/analytics API
// (overallSummary, capabilitySummary, tenantCostReport) — not the hypothetical
// getTotals/getSpendByTenant referenced in the Sprint 7 planning drafts.

import {
  overallSummary,
  capabilitySummary,
  tenantCostReport,
} from '@fyi/analytics';
import type { JobStatus } from '@fyi/database';
import { prisma } from './prisma.js';
import { artifactToMediaUrl } from './media.js';

export const JOB_STATUSES: JobStatus[] = [
  'PENDING',
  'RUNNING',
  'WAITING_APPROVAL',
  'COMPLETED',
  'FAILED',
];

export interface RecentJob {
  id: string;
  tenantId: string;
  recipeId: string;
  status: string;
  currentStepIndex: number;
  totalSteps: number;
  createdAt: string;
  updatedAt: string;
}

export interface OverviewData {
  jobsByStatus: Record<string, number>;
  totalCost: number;
  totalTokens: number;
  recentJobs: RecentJob[];
}

export interface JobListParams {
  page: number;
  limit: number;
  status?: string;
  tenantId?: string;
}

export interface JobRow {
  id: string;
  tenantId: string;
  recipeId: string;
  status: string;
  currentStepIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface JobListResponse {
  jobs: JobRow[];
  total: number;
  page: number;
  limit: number;
}

export interface TelemetryRow {
  executionId: string;
  workerId: string;
  workerVersion: string;
  provider: string | null;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  seconds: number | null;
  cost: number;
  durationMs: number | null;
  startedAt: string;
  finishedAt: string;
}

export interface JobDetailResponse {
  job: {
    id: string;
    tenantId: string;
    recipeId: string;
    status: string;
    currentStepIndex: number;
    recipeSnapshot: { name?: string; steps: Array<{ id: string; capability: string; workerLabel: string }> };
    artifacts: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  };
  telemetry: TelemetryRow[];
  mediaUrls: Array<{ key: string; url: string | null }>;
  videoRef: string | null;
}

export interface TenantView {
  tenantId: string;
  brandVoice: string;
  language: string;
  forbiddenTerms: string[];
  enabled: boolean | null;
  costQuota: number | null;
  modelPreferences: Record<string, unknown> | null;
  spendVsQuota: { spent: number; quota: number; percentage: number };
}

export interface AnalyticsData {
  costOverTime: Array<{ date: string; cost: number; count: number }>;
  costByWorker: Array<{ worker: string; cost: number; count: number }>;
  tokensByWorker: Array<{ worker: string; tokensIn: number; tokensOut: number; count: number }>;
}

/** Convert Prisma status enum to a lowercase wire value ('PENDING' -> 'pending'). */
function statusKey(status: string): string {
  return status.toLowerCase();
}

export async function getOverviewData(tenantId?: string): Promise<OverviewData> {
  const where = tenantId ? { tenant_id: tenantId } : {};
  const [groups, totals, recent] = await Promise.all([
    prisma.job.groupBy({ by: ['status'], where, _count: true }),
    overallSummary(),
    prisma.job.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 10,
      select: {
        id: true,
        tenant_id: true,
        recipe_id: true,
        status: true,
        current_step_index: true,
        recipe_snapshot: true,
        created_at: true,
        updated_at: true,
      },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const s of JOB_STATUSES) byStatus[statusKey(s)] = 0;
  for (const g of groups) {
    byStatus[statusKey(g.status)] = g._count;
  }

  return {
    jobsByStatus: byStatus,
    totalCost: totals.cost,
    totalTokens: totals.tokens_in + totals.tokens_out,
    recentJobs: recent.map((r) => {
      const steps = (r.recipe_snapshot as { steps?: unknown[] })?.steps ?? [];
      return {
        id: r.id,
        tenantId: r.tenant_id,
        recipeId: r.recipe_id,
        status: statusKey(r.status),
        currentStepIndex: r.current_step_index,
        totalSteps: steps.length,
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
      };
    }),
  };
}

export async function getJobsList(params: JobListParams): Promise<JobListResponse> {
  const { page, limit, status, tenantId } = params;
  const where: Record<string, unknown> = {};
  if (status) where.status = status.toUpperCase();
  if (tenantId) where.tenant_id = tenantId;

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        tenant_id: true,
        recipe_id: true,
        status: true,
        current_step_index: true,
        created_at: true,
        updated_at: true,
      },
    }),
    prisma.job.count({ where }),
  ]);

  return {
    jobs: jobs.map((j) => ({
      id: j.id,
      tenantId: j.tenant_id,
      recipeId: j.recipe_id,
      status: statusKey(j.status),
      currentStepIndex: j.current_step_index,
      createdAt: j.created_at.toISOString(),
      updatedAt: j.updated_at.toISOString(),
    })),
    total,
    page,
    limit,
  };
}

export async function getJobDetail(jobId: string): Promise<JobDetailResponse> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw Object.assign(new Error(`Job not found: ${jobId}`), { statusCode: 404 });

  const telemetry = await prisma.telemetry.findMany({
    where: { job_id: jobId },
    orderBy: { started_at: 'asc' },
  });

  const artifacts = (job.artifacts ?? {}) as Record<string, unknown>;
  const references = (artifacts._references as Record<string, string>) ?? {};

  // Video reference: prefer _references.video / _references.voice_output, else
  // any video_path inside step output.
  let videoRef: string | null = null;
  const videoCandidate =
    references.video ??
    references.voice_output ??
    (artifacts.video as { video_path?: string } | undefined)?.video_path ??
    (artifacts.video_path as string | undefined);
  if (videoCandidate) videoRef = artifactToMediaUrl(videoCandidate);

  return {
    job: {
      id: job.id,
      tenantId: job.tenant_id,
      recipeId: job.recipe_id,
      status: statusKey(job.status),
      currentStepIndex: job.current_step_index,
      recipeSnapshot: job.recipe_snapshot as JobDetailResponse['job']['recipeSnapshot'],
      artifacts,
      createdAt: job.created_at.toISOString(),
      updatedAt: job.updated_at.toISOString(),
    },
    telemetry: telemetry.map((t) => ({
      executionId: t.execution_id,
      workerId: t.worker_id,
      workerVersion: t.worker_version,
      provider: t.provider,
      model: t.model,
      tokensIn: t.tokens_in,
      tokensOut: t.tokens_out,
      seconds: t.seconds,
      cost: Number(t.cost) || 0,
      durationMs: t.duration_ms,
      startedAt: t.started_at.toISOString(),
      finishedAt: t.finished_at.toISOString(),
    })),
    mediaUrls: Object.entries(references).map(([key, ref]) => ({
      key,
      url: artifactToMediaUrl(ref),
    })),
    videoRef,
  };
}

export async function getTenantsView(): Promise<TenantView[]> {
  const [contexts, policies, spend] = await Promise.all([
    prisma.tenantContext.findMany(),
    prisma.tenantPolicy.findMany(),
    tenantCostReport(),
  ]);

  return contexts.map((ctx) => {
    const policy = policies.find((p) => p.tenant_id === ctx.tenant_id) ?? null;
    const spent = spend[ctx.tenant_id]?.cost ?? 0;
    const quota = policy?.cost_quota != null ? Number(policy.cost_quota) : 0;
    const forbidden = (ctx.forbidden_terms as string[]) ?? [];
    return {
      tenantId: ctx.tenant_id,
      brandVoice: ctx.brand_voice ?? '',
      language: ctx.language ?? 'en',
      forbiddenTerms: forbidden,
      enabled: policy?.enabled ?? null,
      costQuota: quota || null,
      modelPreferences: (policy?.model_preferences as Record<string, unknown>) ?? null,
      spendVsQuota: {
        spent,
        quota,
        percentage: quota > 0 ? (spent / quota) * 100 : 0,
      },
    };
  });
}

/** Analytics chart data: cost over time (by day), cost by worker, tokens by worker. */
export async function getAnalyticsData(): Promise<AnalyticsData> {
  const byWorker = await capabilitySummary(); // grouped by worker_id
  const rows = await prisma.telemetry.findMany({
    select: { created_at: true, cost: true, tokens_in: true, tokens_out: true, worker_id: true },
    orderBy: { created_at: 'asc' },
  });

  // Cost over time bucketed by UTC date.
  const byDate = new Map<string, { cost: number; count: number }>();
  const tokenAgg = new Map<string, { tokensIn: number; tokensOut: number; count: number }>();
  for (const r of rows) {
    const day = r.created_at.toISOString().slice(0, 10);
    const cur = byDate.get(day) ?? { cost: 0, count: 0 };
    cur.cost += Number(r.cost) || 0;
    cur.count += 1;
    byDate.set(day, cur);

    const wt = tokenAgg.get(r.worker_id) ?? { tokensIn: 0, tokensOut: 0, count: 0 };
    wt.tokensIn += Number(r.tokens_in) || 0;
    wt.tokensOut += Number(r.tokens_out) || 0;
    wt.count += 1;
    tokenAgg.set(r.worker_id, wt);
  }

  return {
    costOverTime: [...byDate.entries()].map(([date, v]) => ({ date, cost: v.cost, count: v.count })),
    costByWorker: Object.entries(byWorker).map(([worker, s]) => ({
      worker,
      cost: s.cost,
      count: s.jobs,
    })),
    tokensByWorker: [...tokenAgg.entries()].map(([worker, v]) => ({
      worker,
      tokensIn: v.tokensIn,
      tokensOut: v.tokensOut,
      count: v.count,
    })),
  };
}
