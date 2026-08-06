// Analytics routes — chart data (JSON) + analytics page (HTML), including the
// platform analytics section (WS-6: merged /platform into /analytics).
import type { FastifyInstance } from 'fastify';
import { getAnalyticsData } from '../utils/data.js';
import { renderAnalyticsPage } from '../templates/analytics.js';
import { getPlatformAnalytics } from '../utils/platform-data.js';

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/analytics', async () => getAnalyticsData());

  app.get('/api/platform/analytics', async (request) => {
    const tenantId = (request.query as { tenant_id?: string }).tenant_id;
    return getPlatformAnalytics(tenantId);
  });

  app.get('/analytics', async (request, reply) => {
    const params = request.query as { tenant_id?: string; from?: string; to?: string };
    const platform = await getPlatformAnalytics(params.tenant_id);
    return reply.type('text/html').send(
      renderAnalyticsPage({ tenantId: params.tenant_id, from: params.from, to: params.to, platform }),
    );
  });
}
