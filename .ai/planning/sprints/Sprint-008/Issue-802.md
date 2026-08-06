---
id: sprint-008-issue-802
title: "Issue 8.2 — Provider + Model Assignment UI"
owner: "Lead Engineer (AI Agent)"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-issue"
tags: [sprint-008, issue-802, providers, models, modelgate, connection-manager, assignment]
related_documents:
  - "README.md"
  - "settings-ai-workspace-architecture.md"
  - "settings-ai-workspace-stack-proposal.md"
  - "Issue-801.md"
related_sprint: "Sprint-008"
---

# Issue 8.2 — Provider + Model Assignment UI

> **Sprint:** 8 (Milestone 9: Settings AI Workspace)  
> **Estimate:** M (3-5 hours)  
> **Dependencies:** Issue 8.1 (Scaffold)  
> **Blockers:** None

---

## 1. Objective

Implement the **AI provider connection** and **per-worker/task model assignment** UI:
- `/settings/providers` — connect/disconnect AI providers (Claude, Gemini, Ollama, ChatGPT) via `@fyi/platform` Connection Manager.
- `/settings/models` — assign a model per worker/task (research → gemma, script → deepseek-v4-flash, etc.) via ModelGate + `tenant_policies.model_preferences`.
- The model dropdown must be **capability-gated** (only connected + capable models shown).

---

## 2. Deliverables

### 2.1 `services/settings/src/routes/providers.ts`

```typescript
// services/settings/src/routes/providers.ts
import { FastifyInstance } from 'fastify';
import { connectionManager } from '@fyi/platform';

export async function providersRoutes(app: FastifyInstance) {
  // List connected + available providers
  app.get('/settings/providers', async (req, reply) => {
    const [connected, available] = await Promise.all([
      connectionManager.listConnections(),
      connectionManager.listAvailableProviders(),
    ]);
    return reply.type('text/html').send(renderProvidersPage({ connected, available }));
  });

  // Connect a provider (store key ref; key material → secret manager)
  app.post('/settings/providers/connect', async (req, reply) => {
    const { provider, apiKey } = req.body as { provider: string; apiKey: string };
    await connectionManager.connect({ provider, apiKey });  // validates + stores key_ref
    return reply.redirect('/settings/providers');
  });

  // Disconnect a provider
  app.post('/settings/providers/disconnect', async (req, reply) => {
    const { provider } = req.body as { provider: string };
    await connectionManager.disconnect({ provider });
    return reply.redirect('/settings/providers');
  });
}
```

### 2.2 `services/settings/src/routes/models.ts`

```typescript
// services/settings/src/routes/models.ts
import { FastifyInstance } from 'fastify';
import { modelGate, tenantPolicy } from '@fyi/platform';

export async function modelsRoutes(app: FastifyInstance) {
  // List capabilities + current assignments
  app.get('/settings/models', async (req, reply) => {
    const capabilities = await modelGate.listCapabilities();
    const assignments = await tenantPolicy.getModelPreferences();
    return reply.type('text/html').send(renderModelsPage({ capabilities, assignments }));
  });

  // Assign a model per worker/task (capability-gated)
  app.post('/settings/models/assign', async (req, reply) => {
    const { tenantId, capability, modelId } = req.body as {
      tenantId: string; capability: string; modelId: string;
    };
    // Validate: capability must be resolvable (connected + capable)
    const resolved = await modelGate.resolve({ capability, tenantId, preferredModel: modelId });
    await tenantPolicy.upsertModelPreference(tenantId, { [capability]: modelId });
    return reply.redirect('/settings/models');
  });
}
```

### 2.3 `services/settings/src/templates/providers.ts` (simplified)

```typescript
export function renderProvidersPage({ connected, available }) {
  return renderLayout({
    title: 'AI Providers',
    content: `
      <h1>AI Providers</h1>
      <h2>Connected</h2>
      <ul>${connected.map(p => `<li>${p.provider}
        <form method="post" action="/settings/providers/disconnect">
          <input type="hidden" name="provider" value="${p.provider}">
          <button>Disconnect</button>
        </form></li>`).join('')}</ul>
      <h2>Connect a provider</h2>
      <form method="post" action="/settings/providers/connect">
        <select name="provider">${available.map(p => `<option value="${p}">${p}</option>`).join('')}</select>
        <input type="password" name="apiKey" placeholder="API key">
        <button>Connect</button>
      </form>
    `,
  });
}
```

### 2.4 `services/settings/src/templates/models.ts` (capability-gated dropdown)

```typescript
export function renderModelsPage({ capabilities, assignments }) {
  return renderLayout({
    title: 'Model Assignment',
    content: `
      <h1>Model per Worker/Task</h1>
      ${capabilities.map(cap => `
        <form method="post" action="/settings/models/assign">
          <input type="hidden" name="tenantId" value="${assignments.tenantId}">
          <label>${cap.capability}</label>
          <select name="modelId">
            ${cap.candidateModels.map(m => `
              <option value="${m.id}" ${assignments[cap.capability] === m.id ? 'selected' : ''}>${m.id}</option>
            `).join('')}
          </select>
          <input type="hidden" name="capability" value="${cap.capability}">
          <button>Assign</button>
        </form>`).join('')}
    `,
  });
}
```

### 2.5 `services/settings/src/utils/platform.ts`

```typescript
// services/settings/src/utils/platform.ts
import { connectionManager, modelGate, tenantPolicy } from '@fyi/platform';
export { connectionManager, modelGate, tenantPolicy };
```

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `/settings/providers` lists connected + available providers | Visual check |
| 2 | Connect Claude/Gemini/Ollama/ChatGPT stores a `key_ref` in `provider_connections` | DB check |
| 3 | Disconnect removes the connection | DB check |
| 4 | `/settings/models` shows capabilities with capability-gated model dropdowns | Visual check (only connected + capable models) |
| 5 | Assigning a model persists to `tenant_policies.model_preferences` | DB check + ModelGate resolution |
| 6 | No raw arbitrary writes; all via `@fyi/platform` engines | Code review |

---

## 4. Implementation Notes

- **Reuse `@fyi/platform`** — Connection Manager (ADR-0006/0007), ModelGate, Policy Engine. Do NOT reimplement.
- **Secrets** — pass `apiKey` to `connectionManager.connect`; the manager stores `key_ref` and routes material to the secret manager.
- **Capability gating** — build the model dropdown from `modelGate.candidates({ capability, tenantId })` so only connected + capable models appear.

---

## 5. Definition of Done

- [ ] Provider connect/disconnect works end-to-end
- [ ] Model assignment dropdown is capability-gated
- [ ] Assignments persist to `tenant_policies.model_preferences`
- [ ] `pnpm run settings:typecheck` + `settings:build` pass
- [ ] Unit tests for routes (≥80% coverage)

---

## 6. Cross-References

- **Sprint Plan:** [README.md](./README.md)
- **Architecture:** [settings-ai-workspace-architecture.md](../architecture/settings-ai-workspace-architecture.md)
- **Provider Connection / ModelGate:** [../../adr/ADR-0006-user-configurable-provider-connection.md](../../adr/ADR-0006-user-configurable-provider-connection.md), [../../adr/ADR-0007-ai-platform-foundation.md](../../adr/ADR-0007-ai-platform-foundation.md)
