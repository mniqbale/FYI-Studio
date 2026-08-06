// Platform analytics routes — read-only views over local platform_metrics /
// video_revenue tables (Milestone 11 / ADR-0009). NEVER call a platform API.
import type { FastifyInstance } from 'fastify';
import { getPlatformAnalytics } from '../utils/platform-data.js';
import { renderPlatformAnalyticsPage } from '../templates/platform-analytics.js';

export async function platformRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/platform/analytics', async (request) => {
    const tenantId = (request.query as { tenant_id?: string }).tenant_id;
    return getPlatformAnalytics(tenantId);
  });

  app.get('/platform', async (request, reply) => {
    const tenantId = (request.query as { tenant_id?: string }).tenant_id;
    const data = await getPlatformAnalytics(tenantId);
    return reply.type('text/html').send(renderPlatformAnalyticsPage(data));
  });
}
