// Tenants routes — list tenants with policy + spend vs quota.
import type { FastifyInstance } from 'fastify';
import { getTenantsView } from '../utils/data.js';
import { renderTenantsPage } from '../templates/tenants.js';

export async function tenantsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/tenants', async () => ({ tenants: await getTenantsView() }));

  app.get('/tenants', async (request, reply) => {
    const tenants = await getTenantsView();
    return reply.type('text/html').send(renderTenantsPage(tenants));
  });
}
