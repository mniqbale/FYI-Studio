// Unit tests for the social publish & scheduling routes (Issue 9.2 / ADR-0008).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

const connectSocialAccount = vi.fn();
const disconnectSocialAccount = vi.fn();
const schedulePublish = vi.fn();
const listSocialAccounts = vi.fn();
const listScheduledPublishes = vi.fn();

vi.mock('@fyi/publish', () => ({
  connectSocialAccount: (...a: unknown[]) => connectSocialAccount(...a),
  disconnectSocialAccount: (...a: unknown[]) => disconnectSocialAccount(...a),
  schedulePublish: (...a: unknown[]) => schedulePublish(...a),
}));
vi.mock('../src/utils/social-publish.js', () => ({
  listSocialAccounts: (...a: unknown[]) => listSocialAccounts(...a),
  listScheduledPublishes: (...a: unknown[]) => listScheduledPublishes(...a),
}));

const { socialRoutes } = await import('../src/routes/social.js');

describe('Social Publish & Scheduling Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.register(import('@fastify/formbody'));
    await socialRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/social returns the connected accounts', async () => {
    listSocialAccounts.mockResolvedValue([
      { id: 'acc1', tenant_id: 'demo', platform: 'youtube', display_name: 'Demo', account_ref: 'UC-1', token_ref: 'ref', enabled: true },
    ]);
    const res = await app.inject({ method: 'GET', url: '/api/social?tenant_id=demo' });
    expect(res.statusCode).toBe(200);
    expect(res.json()[0].platform).toBe('youtube');
  });

  it('POST /api/social/connect connects an account', async () => {
    connectSocialAccount.mockResolvedValue({ id: 'acc1', platform: 'youtube' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/social/connect',
      payload: { tenant_id: 'demo', platform: 'youtube', display_name: 'Demo', account_ref: 'UC-1', access_token: 'tok' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    expect(connectSocialAccount).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 'demo', platform: 'youtube' }),
    );
  });

  it('POST /api/social/connect returns 400 when fields are missing', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/social/connect', payload: { tenant_id: 'demo' } });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/social/schedule schedules a publish', async () => {
    schedulePublish.mockResolvedValue({ id: 'sp1', status: 'scheduled' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/social/schedule',
      payload: { tenant_id: 'demo', job_id: 'job1', social_account_id: 'acc1', scheduled_at: '2026-08-06T12:00:00Z' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it('POST /api/social/:id/disconnect disconnects an account', async () => {
    disconnectSocialAccount.mockResolvedValue({ id: 'acc1', enabled: false });
    const res = await app.inject({
      method: 'POST',
      url: '/api/social/acc1/disconnect',
      payload: { tenant_id: 'demo' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });
});
