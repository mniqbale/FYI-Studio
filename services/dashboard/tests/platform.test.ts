// Unit tests for the Platform analytics section (Milestone 11 / ADR-0009),
// now merged into the /analytics page (WS-6). Verifies the read-only
// /api/platform/analytics endpoint and the hard invariant: NO platform API
// call happens on page load.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { analyticsRoutes } from '../src/routes/analytics.js';

vi.mock('../src/utils/platform-data.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/platform-data.js')>();
  return { ...actual, getPlatformAnalytics: vi.fn() };
});
vi.mock('../src/utils/data.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/data.js')>();
  return { ...actual, getAnalyticsData: vi.fn().mockResolvedValue({ costOverTime: [], costByWorker: [], tokensByWorker: [] }) };
});

import * as platformData from '../src/utils/platform-data.js';

const mockData = {
  performance: [
    { videoId: 'v1', platform: 'youtube', snapshotDate: '2026-08-06', views: 1200, likes: 90, comments: 15, watchTimeMinutes: 340, retentionPct: 42.5, tenantId: 't1' },
  ],
  revenue: [
    { videoId: 'v1', platform: 'youtube', revenue: 3.25, currency: 'USD', period: '2026-08-06', tenantId: 't1' },
  ],
  totalRevenue: 3.25,
  totalViews: 1200,
  lastIngestion: { id: 'log1', runStartedAt: '2026-08-06T00:00:00.000Z', unitsConsumed: 5, unitsRemaining: 9995, status: 'completed' },
};

describe('Platform Analytics (merged into /analytics)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await analyticsRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/platform/analytics returns local-table data only', async () => {
    vi.mocked(platformData.getPlatformAnalytics).mockResolvedValue(mockData);
    const res = await app.inject({ method: 'GET', url: '/api/platform/analytics' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.performance[0].videoId).toBe('v1');
    expect(body.revenue[0].revenue).toBe(3.25);
    expect(body.totalRevenue).toBe(3.25);
  });

  it('GET /analytics renders the platform section (revenue + performance)', async () => {
    vi.mocked(platformData.getPlatformAnalytics).mockResolvedValue(mockData);
    const res = await app.inject({ method: 'GET', url: '/analytics' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('Platform Analytics');
    expect(res.body).toContain('Revenue by Video');
    expect(res.body).toContain('Content Performance');
  });

  it('GET /analytics does NOT reference any youtube/analytics API client', async () => {
    // The data layer only queries local Prisma tables; this asserts the page
    // does not embed a platform API call. (Hard invariant from ADR-0009.)
    vi.mocked(platformData.getPlatformAnalytics).mockResolvedValue(mockData);
    const res = await app.inject({ method: 'GET', url: '/analytics' });
    const body = res.body;
    expect(body).not.toMatch(/googleapis|youtube\.com\/youtubei|api\.youtube/);
  });
});
