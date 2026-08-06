// Ingestion worker core (ADR-0009). Runs one full ingestion cycle:
//   check quota -> discover published videos -> fetch stats + revenue via the
//   adapter -> idempotently upsert PlatformMetric + VideoRevenue -> record the
//   AnalyticsIngestionLog run -> write coalesced analytics memory.
import { prisma } from './utils/prisma.js';
import { listPublishedVideos, type PublishedVideo } from './utils/videos.js';
import { buildYoutubeClient, type YoutubeClient } from './utils/youtube.js';
import { ingestRevenue, todayPeriod, type RevenueResult } from './revenue.js';
import {
  checkQuota,
  getQuotaStatus,
  METRIC_READ_UNITS,
  REVENUE_READ_UNITS,
  recordUnitsConsumed,
  todayKey,
} from './quota.js';
import { writeAnalyticsMemory, type VideoSummary } from './utils/memory.js';

export interface IngestCycleResult {
  logId: string;
  status: 'completed' | 'skipped_quota' | 'failed';
  videosFound: number;
  metricsUpserted: number;
  revenueUpserted: number;
  unitsConsumed: number;
  unitsRemaining: number;
  memoryWritten: number;
  error?: string;
}

/** Start-of-day key (UTC) for the current snapshot. */
function snapshotDate(): Date {
  return new Date(`${todayKey()}T00:00:00.000Z`);
}

/**
 * Run a single ingestion cycle. Creates a running AnalyticsIngestionLog row,
 * then marks it completed/failed/skipped_quota. Never throws — returns a result
 * object so the scheduler can log the outcome.
 */
export async function runIngestionCycle(): Promise<IngestCycleResult> {
  const log = await prisma.analyticsIngestionLog.create({
    data: { run_started_at: new Date(), status: 'running', units_remaining: Number(process.env.QUOTA_LIMIT ?? 10000) },
  });

  try {
    if (!(await checkQuota(METRIC_READ_UNITS))) {
      const status = await getQuotaStatus();
      await prisma.analyticsIngestionLog.update({
        where: { id: log.id },
        data: { status: 'skipped_quota', run_finished_at: new Date(), units_consumed: 0, units_remaining: status.remaining },
      });
      return { logId: log.id, status: 'skipped_quota', videosFound: 0, metricsUpserted: 0, revenueUpserted: 0, unitsConsumed: 0, unitsRemaining: status.remaining, memoryWritten: 0 };
    }

    const client = buildYoutubeClient();
    const videos = await listPublishedVideos();
    const period = todayPeriod();
    const snapDate = snapshotDate();

    let metricsUpserted = 0;
    const summaryByTenant = new Map<string, VideoSummary[]>();

    for (const v of videos) {
      const stats = await client.fetchVideoStats(v.videoId, v.platform);
      if (stats == null) continue;

      await prisma.platformMetric.upsert({
        where: {
          idx_platform_metric_unique: { video_id: v.videoId, platform: v.platform, snapshot_date: snapDate },
        },
        update: {
          views: stats.views,
          likes: stats.likes,
          comments: stats.comments,
          watch_time_minutes: stats.watchTimeMinutes,
          retention_pct: stats.retentionPct,
          fetched_at: new Date(),
        },
        create: {
          tenant_id: v.tenantId,
          video_id: v.videoId,
          platform: v.platform,
          snapshot_date: snapDate,
          views: stats.views,
          likes: stats.likes,
          comments: stats.comments,
          watch_time_minutes: stats.watchTimeMinutes,
          retention_pct: stats.retentionPct,
        },
      });
      metricsUpserted += 1;

      const list = summaryByTenant.get(v.tenantId) ?? [];
      list.push({ videoId: v.videoId, views: stats.views, likes: stats.likes, revenue: 0 });
      summaryByTenant.set(v.tenantId, list);
    }

    // Revenue (only for videos we successfully ingested metrics for).
    const revenueVideos = videos.filter((v) => summaryByTenant.get(v.tenantId)?.some((s) => s.videoId === v.videoId));
    const revenue: RevenueResult = await ingestRevenue(client, revenueVideos, period);

    // Fold revenue into memory summaries.
    for (const [, list] of summaryByTenant) {
      for (const s of list) {
        s.revenue = revenue.byVideo.get(`${s.videoId}:${period}`) ?? 0;
      }
    }

    const unitsConsumed = metricsUpserted * METRIC_READ_UNITS + revenue.unitsConsumed;
    const remaining = await recordUnitsConsumed(log.id, unitsConsumed, { status: 'completed', runFinishedAt: new Date() });
    const memoryWritten = await writeAnalyticsMemory(summaryByTenant);

    return {
      logId: log.id,
      status: 'completed',
      videosFound: videos.length,
      metricsUpserted,
      revenueUpserted: revenue.upserted,
      unitsConsumed,
      unitsRemaining: remaining,
      memoryWritten,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.analyticsIngestionLog.update({
      where: { id: log.id },
      data: { status: 'failed', run_finished_at: new Date(), error: { message } },
    }).catch(() => undefined);
    return { logId: log.id, status: 'failed', videosFound: 0, metricsUpserted: 0, revenueUpserted: 0, unitsConsumed: 0, unitsRemaining: 0, memoryWritten: 0, error: message };
  }
}
