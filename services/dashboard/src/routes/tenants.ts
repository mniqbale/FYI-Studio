// Tenants routes — list tenants with policy + spend vs quota, plus CRUD
// (add/edit/delete brand knowledge + policy). WS-3: moved brand CRUD here from
// Settings so /tenants is functional, not just read-only.
import type { FastifyInstance } from 'fastify';
import { getTenantsView } from '../utils/data.js';
import { renderTenantsPage, renderTenantEditPage } from '../templates/tenants.js';
import { saveTenantBrand, removeTenantBrand } from '../utils/settings.js';

export async function tenantsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/tenants', async () => ({ tenants: await getTenantsView() }));

  app.get('/tenants', async (request, reply) => {
    const q = request.query as { edit?: string };
    const tenants = await getTenantsView();
    if (q.edit) {
      return reply.type('text/html').send(renderTenantEditPage(q.edit, tenants));
    }
    return reply.type('text/html').send(renderTenantsPage(tenants));
  });

  // Save a tenant's brand knowledge + policy.
  app.post('/tenants/save', async (request, reply) => {
    const body = request.body as {
      tenant_id?: string;
      brand_voice?: string;
      language?: string;
      forbidden_terms?: string;
      style_guide?: string;
    };
    if (!body.tenant_id) return reply.redirect('/tenants?error=tenant+id+required');
    await saveTenantBrand({
      tenant_id: body.tenant_id,
      brand_voice: body.brand_voice ?? '',
      language: body.language ?? 'en',
      forbidden_terms: (body.forbidden_terms ?? '').split(',').map((s) => s.trim()).filter(Boolean),
      style_guide: body.style_guide ?? undefined,
    });
    return reply.redirect(`/tenants?edit=${encodeURIComponent(body.tenant_id)}`);
  });

  // Delete a tenant (knowledge + policy).
  app.post('/tenants/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await removeTenantBrand(id);
    return reply.redirect('/tenants');
  });
}
