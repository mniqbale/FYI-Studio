// Settings routes — "AI Workspace" (Workstream A).
// GET /settings shows providers + model assignment + tenants; POST handlers
// connect/disconnect providers, assign a model to a worker capability, and
// CRUD tenant brand knowledge.
import type { FastifyInstance } from 'fastify';
import {
  getSettingsOverview,
  connectProviderById,
  disconnectProviderById,
  setProviderApiKeyById,
  deleteProviderApiKeyById,
  assignModelForCapability,
  saveTenantBrand,
  removeTenantBrand,
  discoverProviderModels,
} from '../utils/settings.js';
import { listConnections, seedModels, loadModelPolicy } from '@fyi/platform';
import { prisma } from '../utils/prisma.js';
import { renderSettingsPage, renderBrandEditPage } from '../templates/settings.js';
import { listSocialAccounts, listScheduledPublishes } from '../utils/social-publish.js';

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  // Page (GET) — list providers, assignments, tenants, social accounts.
  app.get('/settings', async (request, reply) => {
    const q = request.query as { edit?: string; tenant_id?: string };
    const data = await getSettingsOverview(q.tenant_id);
    if (q.edit) {
      return reply.type('text/html').send(renderBrandEditPage(q.edit, data));
    }
    const [accounts, schedules] = await Promise.all([
      listSocialAccounts(q.tenant_id),
      listScheduledPublishes(q.tenant_id),
    ]);
    return reply.type('text/html').send(renderSettingsPage(data, { accounts, schedules }));
  });

  // Connect / disconnect a provider.
  app.post('/settings/providers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { action?: string };
    const result =
      body.action === 'disconnect'
        ? await disconnectProviderById(id)
        : await connectProviderById(id);
    return reply.redirect('/settings' + (result.ok ? '' : `?error=${encodeURIComponent(result.error ?? 'failed')}`));
  });

  // Set / replace a provider's API key (encrypted at rest).
  app.post('/settings/providers/:id/key', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { api_key?: string };
    if (!body.api_key || !body.api_key.trim()) {
      return reply.redirect('/settings?error=api+key+required');
    }
    const result = await setProviderApiKeyById(id, body.api_key);
    return reply.redirect('/settings' + (result.ok ? '' : `?error=${encodeURIComponent(result.error ?? 'failed')}`));
  });

  // Delete a provider's stored API key + disconnect.
  app.post('/settings/providers/:id/key/delete', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await deleteProviderApiKeyById(id);
    return reply.redirect('/settings' + (result.ok ? '' : `?error=${encodeURIComponent(result.error ?? 'failed')}`));
  });

  // Assign a model to a worker capability (for the 'default' scope).
  app.post('/settings/assign', async (request, reply) => {
    const body = request.body as { capability?: string; model?: string; tenant_id?: string };
    const tenantId = body.tenant_id || 'default';
    if (!body.capability || !body.model) {
      return reply.redirect('/settings?error=capability+and+model+required');
    }
    const [provider, model] = body.model.split('/');
    if (!provider || !model) {
      return reply.redirect('/settings?error=invalid+model');
    }
    const result = await assignModelForCapability({ tenantId, capability: body.capability, provider, model });
    const base = tenantId === 'default' ? '/settings' : `/settings?tenant_id=${encodeURIComponent(tenantId)}`;
    return reply.redirect(base + (result.ok ? '' : `&error=${encodeURIComponent(result.error ?? 'assign failed')}`));
  });

  // Save a tenant's brand knowledge.
  app.post('/settings/tenant-save', async (request, reply) => {
    const body = request.body as {
      tenant_id?: string;
      brand_voice?: string;
      language?: string;
      forbidden_terms?: string;
      style_guide?: string;
    };
    if (!body.tenant_id) return reply.redirect('/settings?error=tenant+id+required');
    await saveTenantBrand({
      tenant_id: body.tenant_id,
      brand_voice: body.brand_voice ?? '',
      language: body.language ?? 'en',
      forbidden_terms: (body.forbidden_terms ?? '').split(',').map((s) => s.trim()).filter(Boolean),
      style_guide: body.style_guide ?? undefined,
    });
    return reply.redirect(`/settings?edit=${encodeURIComponent(body.tenant_id)}`);
  });

  // Delete a tenant (knowledge + policy).
  app.post('/settings/tenants/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await removeTenantBrand(id);
    return reply.redirect('/settings');
  });

  // Refresh models: discover models from connected providers and seed them
  // into the model registry so they appear in the assignment dropdowns.
  app.post('/settings/refresh-models', async (request, reply) => {
    const connections = await listConnections();
    const connected = connections.filter((c) => c.status === 'CONNECTED').map((c) => c.provider);
    let discovered = 0;
    for (const provider of connected) {
      const models = await discoverProviderModels(provider);
      for (const m of models) {
        const existing = await prisma.modelRegistry.findUnique({
          where: { idx_model_provider_model_unique: { provider: m.provider, model: m.model } },
        });
        if (!existing) {
          await prisma.modelRegistry.create({
            data: {
              provider: m.provider,
              model: m.model,
              capabilities: ['reasoning', 'structured_output'],
              status: 'ACTIVE',
            },
          });
          discovered += 1;
        }
      }
    }
    return reply.redirect(`/settings?msg=${encodeURIComponent(`Discovered ${discovered} new model(s) from connected providers`)}`);
  });
}
