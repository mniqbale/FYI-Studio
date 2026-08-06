// Jobs routes — list (paginated/filterable) + detail, HTML + JSON.
import type { FastifyInstance } from 'fastify';
import { getJobsList, getJobDetail, type JobListParams } from '../utils/data.js';
import { renderJobListPage } from '../templates/job-list.js';
import { renderJobDetailPage } from '../templates/job-detail.js';

export async function jobsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/jobs', async (request, reply) => {
    const q = request.query as { page?: string; limit?: string; status?: string; tenant_id?: string };
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const params: JobListParams = { page, limit, status: q.status, tenantId: q.tenant_id };
    return getJobsList(params);
  });

  app.get('/api/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await getJobDetail(id);
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404) return reply.code(404).send({ error: `Job not found: ${id}` });
      throw err;
    }
  });

  app.get('/jobs', async (request, reply) => {
    const q = request.query as { page?: string; limit?: string; status?: string; tenant_id?: string };
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const params: JobListParams = { page, limit, status: q.status, tenantId: q.tenant_id };
    const data = await getJobsList(params);
    return reply.type('text/html').send(
      renderJobListPage({ data, params: { page, limit, status: q.status, tenantId: q.tenant_id } }),
    );
  });

  app.get('/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const data = await getJobDetail(id);
      return reply.type('text/html').send(renderJobDetailPage(data));
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404) return reply.code(404).send({ error: `Job not found: ${id}` });
      throw err;
    }
  });
}
