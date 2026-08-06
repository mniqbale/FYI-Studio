// Settings routes — "AI Workspace" (Workstream A).
// GET /settings shows providers + model assignment + tenants; POST handlers
// connect/disconnect providers, assign a model to a worker capability, and
// CRUD tenant brand knowledge.
import type { FastifyInstance } from 'fastify';
import {
  getSettingsOverview,
  connectProviderById,
  disconnectProviderById,
  assignModelForCapability,
  saveTenantBrand,
  removeTenantBrand,
} from '../utils/settings.js';
import { renderSettingsPage, renderBrandEditPage } from '../templates/settings.js';

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  // Page (GET) — list providers, assignments, tenants.
  app.get('/settings', async (request, reply) => {
    const q = request.query as { edit?: string; tenant_id?: string };
    const data = await getSettingsOverview(q.tenant_id);
    if (q.edit) {
      return reply.type('text/html').send(renderBrandEditPage(q.edit, data));
    }
    return reply.type('text/html').send(renderSettingsPage(data));
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
}
