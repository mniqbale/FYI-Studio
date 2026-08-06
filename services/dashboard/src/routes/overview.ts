// Overview routes — HTML page (/) + JSON API (/api/overview).
import type { FastifyInstance } from 'fastify';
import { getOverviewData } from '../utils/data.js';
import { renderOverviewPage } from '../templates/overview.js';
import { getWorkerAssignments } from '../utils/settings.js';

export async function overviewRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/overview', async (request) => {
    const tenantId = (request.query as { tenant_id?: string }).tenant_id;
    return getOverviewData(tenantId);
  });

  app.get('/', async (request, reply) => {
    const tenantId = (request.query as { tenant_id?: string }).tenant_id;
    const [data, workers] = await Promise.all([getOverviewData(tenantId), getWorkerAssignments()]);
    return reply.type('text/html').send(renderOverviewPage(data, workers));
  });
}
