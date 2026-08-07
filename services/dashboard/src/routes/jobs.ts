// Jobs routes — list (paginated/filterable) + detail, HTML + JSON.
import type { FastifyInstance } from 'fastify';
import { getJobsList, getJobDetail, type JobListParams } from '../utils/data.js';
import { renderJobListPage } from '../templates/job-list.js';
import { renderJobDetailPage } from '../templates/job-detail.js';
import { buildZip, artifactsAsZipFiles } from '../utils/downloads.js';
import { listScheduledPublishes, listSocialAccounts, getJobsForScheduling } from '../utils/social-publish.js';
import { approveJob, reviseStep } from '@fyi/supervisor';

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
    const [schedules, accounts, schedulableJobs] = await Promise.all([
      listScheduledPublishes(q.tenant_id),
      listSocialAccounts(q.tenant_id),
      getJobsForScheduling(),
    ]);
    return reply.type('text/html').send(
      renderJobListPage({
        data,
        params: { page, limit, status: q.status, tenantId: q.tenant_id },
        schedules,
        accounts,
        schedulableJobs,
      }),
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

  // HITL write endpoints (ADR-0010): approve a WAITING_APPROVAL job, or revise
  // + re-run a step. All writes route through the Supervisor (sole writer).
  app.post('/api/jobs/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await approveJob(id);
    return result.ok ? { ok: true, job_id: id } : reply.code(409).send({ ok: false, error: result.error });
  });

  app.post('/api/jobs/:id/revise', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { step?: number; input?: Record<string, unknown> };
    if (typeof body.step !== 'number' || !body.input || typeof body.input !== 'object') {
      return reply.code(400).send({ ok: false, error: 'revise requires { step: number, input: object }' });
    }
    const result = await reviseStep(id, body.step, body.input);
    return result.ok ? { ok: true, job_id: id, step: body.step } : reply.code(409).send({ ok: false, error: result.error });
  });

  // Download all artifacts as a ZIP (point 6).
  app.get('/jobs/:id/download', async (request, reply) => {
    const { id } = request.params as { id: string };
    const q = request.query as { file?: string };
    try {
      const data = await getJobDetail(id);
      const artifacts = data.job.artifacts ?? {};

      // Single-file download: /download?file=artifact-<key>.json or references.json / all-artifacts.json
      if (q.file) {
        const files = artifactsAsZipFiles(artifacts);
        const content = files[q.file];
        if (content === undefined) return reply.code(404).send({ error: 'File not found' });
        return reply
          .header('Content-Disposition', `attachment; filename="${q.file}"`)
          .type('application/json')
          .send(content);
      }

      // Full ZIP of all artifacts.
      const zip = buildZip(artifactsAsZipFiles(artifacts));
      return reply
        .header('Content-Disposition', `attachment; filename="job-${id}.zip"`)
        .type('application/zip')
        .send(zip);
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404) return reply.code(404).send({ error: `Job not found: ${id}` });
      throw err;
    }
  });
}
