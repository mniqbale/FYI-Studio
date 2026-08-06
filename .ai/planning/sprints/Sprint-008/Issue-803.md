---
id: sprint-008-issue-803
title: "Issue 8.3 — Brand/Tenant Context + Policy CRUD"
owner: "Lead Engineer (AI Agent)"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-issue"
tags: [sprint-008, issue-803, tenants, brand, context, policy, crud]
related_documents:
  - "README.md"
  - "settings-ai-workspace-architecture.md"
  - "settings-ai-workspace-stack-proposal.md"
  - "Issue-801.md"
related_sprint: "Sprint-008"
---

# Issue 8.3 — Brand/Tenant Context + Policy CRUD

> **Sprint:** 8 (Milestone 9: Settings AI Workspace)  
> **Estimate:** M (3-5 hours)  
> **Dependencies:** Issue 8.1 (Scaffold)  
> **Blockers:** None

---

## 1. Objective

Implement **full CRUD** for Brand/Tenant context and policy via the Settings web UI (currently read-only on the Dashboard; CRUD exists only via CLI):
- `/settings/tenants` — create/read/update/delete Brand/Tenant context (`tenant_context`: brand voice, language, forbidden terms, constraints).
- `/settings/policy/:tenantId` — create/read/update tenant policy (`tenant_policies`: cost quota, model prefs, enabled) via the Policy Engine.

---

## 2. Deliverables

### 2.1 `services/settings/src/routes/tenants.ts`

```typescript
// services/settings/src/routes/tenants.ts
import { FastifyInstance } from 'fastify';
import { prisma } from '../utils/prisma.js';

export async function tenantsRoutes(app: FastifyInstance) {
  // List tenants (Brand context)
  app.get('/settings/tenants', async (req, reply) => {
    const tenants = await prisma.tenantContext.findMany();
    return reply.type('text/html').send(renderTenantsPage({ tenants }));
  });

  // Create/Update a tenant's Brand context
  app.post('/settings/tenants/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      brandVoice?: string; language?: string; forbiddenTerms?: string[]; constraints?: any;
    };
    await prisma.tenantContext.upsert({
      where: { tenantId: id },
      update: body,
      create: { tenantId: id, ...body },
    });
    return reply.redirect('/settings/tenants');
  });

  // Delete a tenant (context + policy)
  app.post('/settings/tenants/:id/delete', async (req, reply) => {
    const { id } = req.params as { id: string };
    // Guard: ensure no in-flight jobs before delete
    await prisma.tenantPolicy.deleteMany({ where: { tenantId: id } });
    await prisma.tenantContext.delete({ where: { tenantId: id } });
    return reply.redirect('/settings/tenants');
  });
}
```

### 2.2 `services/settings/src/routes/policy.ts`

```typescript
// services/settings/src/routes/policy.ts
import { FastifyInstance } from 'fastify';
import { tenantPolicy } from '@fyi/platform';

export async function policyRoutes(app: FastifyInstance) {
  // Read a tenant policy
  app.get('/settings/policy/:tenantId', async (req, reply) => {
    const { tenantId } = req.params as { tenantId: string };
    const policy = await tenantPolicy.getPolicy(tenantId);
    return reply.type('text/html').send(renderPolicyPage({ tenantId, policy }));
  });

  // Create/Update a tenant policy (via Policy Engine)
  app.post('/settings/policy/:tenantId', async (req, reply) => {
    const { tenantId } = req.params as { tenantId: string };
    const body = req.body as { modelPreferences?: any; costQuota?: number; enabled?: boolean };
    await tenantPolicy.upsert(tenantId, body);
    return reply.redirect(`/settings/policy/${tenantId}`);
  });
}
```

### 2.3 `services/settings/src/templates/tenants.ts` (simplified)

```typescript
export function renderTenantsPage({ tenants }) {
  return renderLayout({
    title: 'Brand / Tenants',
    content: `
      <h1>Brand / Tenants</h1>
      <form method="post" action="/settings/tenants/new-tenant">
        <input name="tenantId" placeholder="tenant id">
        <input name="brandVoice" placeholder="brand voice">
        <input name="language" placeholder="language">
        <input name="forbiddenTerms" placeholder="forbidden terms (comma-separated)">
        <button>Create</button>
      </form>
      ${tenants.map(t => `
        <form method="post" action="/settings/tenants/${t.tenantId}">
          <h3>${t.tenantId}</h3>
          <textarea name="brandVoice">${t.brandVoice}</textarea>
          <input name="language" value="${t.language}">
          <input name="forbiddenTerms" value="${(t.forbiddenTerms || []).join(',')}">
          <button>Update</button>
        </form>
        <form method="post" action="/settings/tenants/${t.tenantId}/delete">
          <button class="danger">Delete</button>
        </form>`).join('')}
    `,
  });
}
```

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `/settings/tenants` lists tenants (Brand context) | Visual check |
| 2 | Create/Update a tenant's Brand context persists to `tenant_context` | DB check |
| 3 | Delete a tenant removes context + policy (guarded) | DB check |
| 4 | `/settings/policy/:tenantId` reads/writes policy via Policy Engine | Visual + Policy Engine check |
| 5 | Policy CRUD persists to `tenant_policies` | DB check |
| 6 | Writes route via engines / scoped Prisma; no raw arbitrary writes | Code review |

---

## 4. Implementation Notes

- **Reuse `@fyi/platform` Policy Engine** for policy CRUD; use scoped Prisma for `tenant_context`.
- **Delete guard** — prevent deleting a tenant with in-flight jobs (fail with a clear error).
- **Forbidden terms** — store as array; the form accepts comma-separated text and converts.

---

## 5. Definition of Done

- [ ] Brand/Tenant context full CRUD works end-to-end
- [ ] Policy full CRUD works via Policy Engine
- [ ] `pnpm run settings:typecheck` + `settings:build` pass
- [ ] Unit tests for routes (≥80% coverage)

---

## 6. Cross-References

- **Sprint Plan:** [README.md](./README.md)
- **Architecture:** [settings-ai-workspace-architecture.md](../architecture/settings-ai-workspace-architecture.md)
- **Multi-Tenant / Policy Engine:** [../../planning/sprints/Sprint-005/README.md](../../planning/sprints/Sprint-005/README.md)
