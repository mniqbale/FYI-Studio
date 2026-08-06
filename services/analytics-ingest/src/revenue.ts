// Revenue ingestion (ADR-0009). Fetches per-video revenue via the YouTube
// Analytics API adapter and idempotently upserts to `video_revenue`
// (keyed by video_id + platform + period).
import { prisma } from './utils/prisma.js';
import { REVENUE_READ_UNITS } from './quota.js';
import type { YoutubeClient, VideoRevenue } from './utils/youtube.js';

export interface RevenueResult {
  upserted: number;
  unitsConsumed: number;
  byVideo: Map<string, number>; // videoId -> revenue USD
}

/** Today's period label (daily granularity, matches PlatformMetric snapshot). */
export function todayPeriod(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Fetch + upsert revenue for a set of videos. Returns upserted count + units.
 * Idempotent: re-running for the same (video, period) updates in place.
 */
export async function ingestRevenue(
  client: YoutubeClient,
  videos: Array<{ tenantId: string; videoId: string; platform: string }>,
  period = todayPeriod(),
): Promise<RevenueResult> {
  let upserted = 0;
  const byVideo = new Map<string, number>();

  for (const v of videos) {
    const revenue: VideoRevenue | null = await client.fetchVideoRevenue(v.videoId, period, v.platform);
    if (revenue == null) continue;
    const key = `${v.videoId}:${period}`;
    if (byVideo.has(key)) continue;
    byVideo.set(key, revenue.amount);

    await prisma.videoRevenue.upsert({
      where: {
        idx_video_revenue_unique: { video_id: v.videoId, platform: v.platform, period: revenue.period },
      },
      update: { revenue: revenue.amount, currency: revenue.currency, fetched_at: new Date() },
      create: {
        tenant_id: v.tenantId,
        video_id: v.videoId,
        platform: v.platform,
        revenue: revenue.amount,
        currency: revenue.currency,
        period: revenue.period,
      },
    });
    upserted += 1;
  }

  // One Analytics API report read per fetched video.
  const unitsConsumed = byVideo.size * REVENUE_READ_UNITS;
  return { upserted, unitsConsumed, byVideo };
}
