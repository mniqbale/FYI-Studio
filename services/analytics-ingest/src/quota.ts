// Quota ledger (ADR-0009). Tracks YouTube Data API v3 daily unit consumption
// (10,000 units/day free) SHARED with uploads (ADR-0008). Persists the running
// total in `analytics_ingestion_log` and reads uploads' units from the same
// ledger (the uploads worker records its 1,600-unit cost as a completed run in
// the same table, so analytics reads and uploads share one daily budget).
import { prisma } from './utils/prisma.js';

/** Daily YouTube free quota (units). Shared with uploads (ADR-0008). */
export const QUOTA_LIMIT = Number(process.env.QUOTA_LIMIT ?? 10000);

/** Units a video upload consumes (ADR-0008). */
export const UPLOAD_UNITS = 1600;

/** Units a videos.list read consumes for one video (1 `part` = ~1 unit each, cheap reads). */
export const METRIC_READ_UNITS = 1;

/** Units a YouTube Analytics report read consumes for one video. */
export const REVENUE_READ_UNITS = 2;

/** Start-of-day (UTC) key used to group runs into a daily budget. */
export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** UTC start-of-day DateTime for a date key. */
export function startOfDay(d = new Date()): Date {
  return new Date(`${todayKey(d)}T00:00:00.000Z`);
}

export interface QuotaStatus {
  usedToday: number;
  limit: number;
  remaining: number;
  unitsNeeded: number;
  wouldFit: boolean;
}

/**
 * Units consumed today from the joint ledger. Sums `units_consumed` of all
 * analytics ingestion runs that started today, plus uploads: we treat scheduled
 * publish uploads as a separate daily debit tracked by the uploads worker as an
 * `analytics_ingestion_log` row with `status='upload'`. If none exist, we fall
 * back to `UPLOAD_UNITS * publishedToday` as a conservative estimate.
 */
export async function usedUnitsToday(d = new Date()): Promise<number> {
  const from = startOfDay(d);
  const rows = await prisma.analyticsIngestionLog.findMany({
    where: { run_started_at: { gte: from } },
    select: { units_consumed: true, status: true },
  });

  const analyticsUnits = rows
    .filter((r) => r.status !== 'upload')
    .reduce((sum, r) => sum + (r.units_consumed || 0), 0);

  // Uploads: count rows explicitly logged by the uploads worker (status 'upload'),
  // else estimate from scheduled_publishes published today.
  const uploadUnitsLogged = rows
    .filter((r) => r.status === 'upload')
    .reduce((sum, r) => sum + (r.units_consumed || 0), 0);

  let uploadUnits = uploadUnitsLogged;
  if (uploadUnitsLogged === 0) {
    const publishedToday = await prisma.scheduledPublish.count({
      where: {
        status: 'published',
        updated_at: { gte: from },
      },
    });
    uploadUnits = publishedToday * UPLOAD_UNITS;
  }

  return analyticsUnits + uploadUnits;
}

/**
 * Check whether `unitsNeeded` more units fit in today's budget.
 * Returns true when `usedToday + unitsNeeded <= QUOTA_LIMIT`.
 */
export async function checkQuota(unitsNeeded: number, d = new Date()): Promise<boolean> {
  const used = await usedUnitsToday(d);
  return used + unitsNeeded <= QUOTA_LIMIT;
}

/** Current quota status (for observability + dashboard). */
export async function getQuotaStatus(unitsNeeded = 0, d = new Date()): Promise<QuotaStatus> {
  const usedToday = await usedUnitsToday(d);
  const remaining = Math.max(0, QUOTA_LIMIT - usedToday);
  return {
    usedToday,
    limit: QUOTA_LIMIT,
    remaining,
    unitsNeeded,
    wouldFit: usedToday + unitsNeeded <= QUOTA_LIMIT,
  };
}

/**
 * Record units consumed for an analytics run. Returns the new remaining total.
 * Used by the ingestion worker to close a run's ledger row.
 */
export async function recordUnitsConsumed(
  logId: string,
  unitsConsumed: number,
  extra?: { status?: string; runFinishedAt?: Date },
): Promise<number> {
  const remaining = Math.max(0, QUOTA_LIMIT - unitsConsumed);
  await prisma.analyticsIngestionLog.update({
    where: { id: logId },
    data: {
      units_consumed: unitsConsumed,
      units_remaining: remaining,
      status: extra?.status ?? 'completed',
      run_finished_at: extra?.runFinishedAt ?? new Date(),
    },
  });
  return remaining;
}
