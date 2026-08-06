// Unit tests for the Settings routes (Workstream A) — provider connect/disconnect,
// model assignment, and tenant brand CRUD. Uses fastify.inject + mocked settings layer.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyFormBody from '@fastify/formbody';
import { settingsRoutes } from '../src/routes/settings.js';

vi.mock('../src/utils/settings.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/settings.js')>();
  return {
    ...actual,
    getSettingsOverview: vi.fn(),
    connectProviderById: vi.fn(),
    disconnectProviderById: vi.fn(),
    assignModelForCapability: vi.fn(),
    saveTenantBrand: vi.fn(),
    removeTenantBrand: vi.fn(),
  };
});

import * as settings from '../src/utils/settings.js';

vi.mock('../src/utils/social-publish.js', () => ({
  listSocialAccounts: vi.fn().mockResolvedValue([]),
  listScheduledPublishes: vi.fn().mockResolvedValue([]),
}));

describe('Settings Routes (AI Workspace)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await app.register(fastifyFormBody);
    await settingsRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /settings renders the workspace page', async () => {
    vi.mocked(settings.getSettingsOverview).mockResolvedValue({
      providers: [],
      tenants: [],
      assignments: [],
    });
    const res = await app.inject({ method: 'GET', url: '/settings' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('AI Workspace');
    expect(res.body).toContain('AI Providers');
  });

  it('GET /settings?edit=tenant renders brand edit form', async () => {
    vi.mocked(settings.getSettingsOverview).mockResolvedValue({
      providers: [],
      tenants: [{ tenantId: 't1', brandVoice: 'x' }],
      assignments: [],
    });
    const res = await app.inject({ method: 'GET', url: '/settings?edit=t1' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Edit Brand: t1');
    expect(res.body).toContain('Brand Voice');
  });

  it('POST /settings/providers/:id connects a provider', async () => {
    vi.mocked(settings.connectProviderById).mockResolvedValue({ ok: true });
    const res = await app.inject({ method: 'POST', url: '/settings/providers/ollama', payload: 'action=connect', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    expect(res.statusCode).toBe(302);
    expect(settings.connectProviderById).toHaveBeenCalledWith('ollama');
  });

  it('POST /settings/providers/:id disconnects a provider', async () => {
    vi.mocked(settings.disconnectProviderById).mockResolvedValue({ ok: true });
    const res = await app.inject({ method: 'POST', url: '/settings/providers/ollama', payload: 'action=disconnect', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    expect(res.statusCode).toBe(302);
    expect(settings.disconnectProviderById).toHaveBeenCalledWith('ollama');
  });

  it('POST /settings/assign assigns a model to a capability', async () => {
    vi.mocked(settings.assignModelForCapability).mockResolvedValue({ ok: true });
    const res = await app.inject({
      method: 'POST',
      url: '/settings/assign',
      payload: 'capability=research%3Areal&model=ollama%2Fdeepseek-v4-flash',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(res.statusCode).toBe(302);
    expect(settings.assignModelForCapability).toHaveBeenCalledWith({
      tenantId: 'default',
      capability: 'research:real',
      provider: 'ollama',
      model: 'deepseek-v4-flash',
    });
  });

  it('POST /settings/assign returns redirect on invalid model format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/settings/assign',
      payload: 'capability=research%3Areal&model=invalid',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(res.statusCode).toBe(302);
    expect(settings.assignModelForCapability).not.toHaveBeenCalled();
  });

  it('POST /settings/tenant-save saves a brand', async () => {
    vi.mocked(settings.saveTenantBrand).mockResolvedValue(undefined as never);
    const res = await app.inject({
      method: 'POST',
      url: '/settings/tenant-save',
      payload: 'tenant_id=t1&brand_voice=hello&language=en',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(res.statusCode).toBe(302);
    expect(settings.saveTenantBrand).toHaveBeenCalled();
  });

  it('POST /settings/tenants/:id deletes a tenant', async () => {
    vi.mocked(settings.removeTenantBrand).mockResolvedValue(undefined as never);
    const res = await app.inject({ method: 'POST', url: '/settings/tenants/t1' });
    expect(res.statusCode).toBe(302);
    expect(settings.removeTenantBrand).toHaveBeenCalledWith('t1');
  });
});
