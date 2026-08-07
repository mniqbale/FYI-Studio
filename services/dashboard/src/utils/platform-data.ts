// Platform analytics read-only data access (Milestone 11 / ADR-0009).
// Reads ONLY from the local tables (platform_metrics, video_revenue,
// analytics_ingestion_log). NEVER calls a platform API on page load — this is
// the hard invariant from ADR-0009.

import { prisma } from './prisma.js';

export interface PlatformPerformanceItem {
  videoId: string;
  platform: string;
  snapshotDate: string;
  views: number;
  likes: number;
  comments: number;
  watchTimeMinutes: number;
  retentionPct: number | null;
  tenantId: string;
}

export interface PlatformRevenueItem {
  videoId: string;
  platform: string;
  revenue: number;
  currency: string;
  period: string;
  tenantId: string;
}

export interface IngestionLogItem {
  id: string;
  runStartedAt: string;
  unitsConsumed: number;
  unitsRemaining: number;
  status: string;
}

export interface PlatformAnalyticsData {
  performance: PlatformPerformanceItem[];
  revenue: PlatformRevenueItem[];
  totalRevenue: number;
  totalViews: number;
  lastIngestion: IngestionLogItem | null;
  /** Connected YouTube channel status (workstream 3). */
  connection: { connected: boolean; channelTitle?: string; accountRef?: string } | null;
}

export async function getPlatformPerformance(tenantId?: string): Promise<PlatformPerformanceItem[]> {
  const rows = await prisma.platformMetric.findMany({
    where: tenantId ? { tenant_id: tenantId } : {},
    orderBy: [{ video_id: 'asc' }, { snapshot_date: 'desc' }],
    take: 200,
  });
  return rows.map((r) => ({
    videoId: r.video_id,
    platform: r.platform,
    snapshotDate: r.snapshot_date.toISOString().slice(0, 10),
    views: r.views,
    likes: r.likes,
    comments: r.comments,
    watchTimeMinutes: r.watch_time_minutes,
    retentionPct: r.retention_pct,
    tenantId: r.tenant_id,
  }));
}

export async function getPlatformRevenue(tenantId?: string): Promise<PlatformRevenueItem[]> {
  const rows = await prisma.videoRevenue.findMany({
    where: tenantId ? { tenant_id: tenantId } : {},
    orderBy: { period: 'desc' },
    take: 200,
  });
  return rows.map((r) => ({
    videoId: r.video_id,
    platform: r.platform,
    revenue: Number(r.revenue) || 0,
    currency: r.currency,
    period: r.period,
    tenantId: r.tenant_id,
  }));
}

export async function getLastIngestion(): Promise<IngestionLogItem | null> {
  const row = await prisma.analyticsIngestionLog.findFirst({
    orderBy: { run_started_at: 'desc' },
  });
  if (!row) return null;
  return {
    id: row.id,
    runStartedAt: row.run_started_at.toISOString(),
    unitsConsumed: row.units_consumed,
    unitsRemaining: row.units_remaining,
    status: row.status,
  };
}

export async function getPlatformAnalytics(tenantId?: string): Promise<PlatformAnalyticsData> {
  const [performance, revenue, lastIngestion, account] = await Promise.all([
    getPlatformPerformance(tenantId),
    getPlatformRevenue(tenantId),
    getLastIngestion(),
    prisma.socialAccount.findFirst({
      where: { platform: 'youtube', enabled: true },
      orderBy: { connected_at: 'asc' },
    }),
  ]);
  const totalRevenue = revenue.reduce((s, r) => s + r.revenue, 0);
  const totalViews = performance.reduce((s, p) => s + p.views, 0);
  const connection = account
    ? { connected: true, channelTitle: account.display_name, accountRef: account.account_ref }
    : null;
  return { performance, revenue, totalRevenue, totalViews, lastIngestion, connection };
}
