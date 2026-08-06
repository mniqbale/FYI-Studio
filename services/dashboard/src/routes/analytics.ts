// Analytics routes — chart data (JSON) + analytics page (HTML).
import type { FastifyInstance } from 'fastify';
import { getAnalyticsData } from '../utils/data.js';
import { renderAnalyticsPage } from '../templates/analytics.js';

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/analytics', async () => getAnalyticsData());

  app.get('/analytics', async (request, reply) => {
    const params = request.query as { tenant_id?: string; from?: string; to?: string };
    return reply.type('text/html').send(
      renderAnalyticsPage({ tenantId: params.tenant_id, from: params.from, to: params.to }),
    );
  });
}
