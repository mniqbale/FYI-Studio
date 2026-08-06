// Social publish & scheduling routes (Issue 9.2 / ADR-0008).
// Connect/disconnect social accounts and schedule a publish for an approved job.
import type { FastifyInstance } from 'fastify';
import { connectSocialAccount, disconnectSocialAccount } from '@fyi/publish';
import { schedulePublish } from '@fyi/publish';
import { listSocialAccounts, listScheduledPublishes } from '../utils/social-publish.js';

export async function socialRoutes(app: FastifyInstance): Promise<void> {
  // Connect a social account (store token_ref, never the token).
  app.post('/api/social/connect', async (request, reply) => {
    const body = request.body as {
      tenant_id?: string;
      platform?: string;
      display_name?: string;
      account_ref?: string;
      access_token?: string;
    };
    if (!body.tenant_id || !body.platform || !body.display_name || !body.account_ref || !body.access_token) {
      return reply.code(400).send({ ok: false, error: 'tenant_id, platform, display_name, account_ref, access_token required' });
    }
    try {
      const account = await connectSocialAccount({
        tenant_id: body.tenant_id,
        platform: body.platform,
        display_name: body.display_name,
        account_ref: body.account_ref,
        access_token: body.access_token,
      });
      return { ok: true, account };
    } catch (err) {
      return reply.code(400).send({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Disconnect a social account (keeps history via enabled=false).
  app.post('/api/social/:id/disconnect', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { tenant_id?: string } | undefined;
    const tenantId = body?.tenant_id ?? 'default';
    const account = await disconnectSocialAccount(id, tenantId);
    if (!account) return reply.code(404).send({ ok: false, error: 'account not found' });
    return { ok: true, account };
  });

  // List social accounts (optional tenant filter).
  app.get('/api/social', async (request) => {
    const tenantId = (request.query as { tenant_id?: string }).tenant_id;
    return listSocialAccounts(tenantId);
  });

  // List scheduled publishes (optional tenant filter).
  app.get('/api/social/schedules', async (request) => {
    const tenantId = (request.query as { tenant_id?: string }).tenant_id;
    return listScheduledPublishes(tenantId);
  });

  // Schedule a publish for an approved job.
  app.post('/api/social/schedule', async (request, reply) => {
    const body = request.body as {
      tenant_id?: string;
      job_id?: string;
      social_account_id?: string;
      scheduled_at?: string;
    };
    if (!body.tenant_id || !body.job_id || !body.social_account_id || !body.scheduled_at) {
      return reply.code(400).send({ ok: false, error: 'tenant_id, job_id, social_account_id, scheduled_at required' });
    }
    try {
      const scheduled = await schedulePublish({
        tenant_id: body.tenant_id,
        job_id: body.job_id,
        social_account_id: body.social_account_id,
        scheduled_at: new Date(body.scheduled_at),
      });
      return { ok: true, scheduled };
    } catch (err) {
      return reply.code(400).send({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
}
