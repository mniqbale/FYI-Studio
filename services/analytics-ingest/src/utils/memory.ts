// Memory Layer feedback (ADR-0009). After a successful ingestion cycle, writes a
// single COALESCED `memory_entries` row (kind: 'analytics') summarizing per-video
// performance for reflection by the Context Assembly Engine (M4/M7 pattern).
import { addMemory, type MemoryKind } from '@fyi/knowledge';

export interface VideoSummary {
  videoId: string;
  views: number;
  likes: number;
  revenue: number;
}

/**
 * Write one coalesced memory entry per tenant summarizing the cycle's videos.
 * Returns the number of tenants written.
 */
export async function writeAnalyticsMemory(
  grouped: Map<string, VideoSummary[]>,
): Promise<number> {
  let written = 0;
  for (const [tenantId, videos] of grouped) {
    if (videos.length === 0) continue;
    const totalViews = videos.reduce((s, v) => s + v.views, 0);
    const totalRevenue = videos.reduce((s, v) => s + v.revenue, 0);
    await addMemory({
      tenant_id: tenantId,
      kind: 'analytics' as MemoryKind,
      content: {
        cycle_date: new Date().toISOString().slice(0, 10),
        video_count: videos.length,
        total_views: totalViews,
        total_revenue: Number(totalRevenue.toFixed(2)),
        videos: videos.map((v) => ({
          video_id: v.videoId,
          views: v.views,
          likes: v.likes,
          revenue: Number(v.revenue.toFixed(2)),
        })),
        summary: `Cycle: ${videos.length} video(s), ${totalViews} total views, $${totalRevenue.toFixed(2)} total revenue.`,
      },
    });
    written += 1;
  }
  return written;
}
