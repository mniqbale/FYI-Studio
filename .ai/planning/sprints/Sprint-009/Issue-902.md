---
id: sprint-009-issue-902
title: "Issue 9.2 — Social Account Registry CRUD"
owner: "Lead Engineer (AI Agent)"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-issue"
tags: [sprint-009, issue-902, social-accounts, oauth, crud, settings, registry]
related_documents:
  - "README.md"
  - "social-publish-architecture.md"
  - "social-publish-stack-proposal.md"
  - "Issue-901.md"
related_sprint: "Sprint-009"
---

# Issue 9.2 — Social Account Registry CRUD

> **Sprint:** 9 (Milestone 10: Social Publish & Scheduling)  
> **Estimate:** M (3-5 hours)  
> **Dependencies:** Issue 9.1 (Schema)  
> **Blockers:** None

---

## 1. Objective

Implement the **social account registry CRUD** — connect, list, and disconnect social accounts per tenant, using the Settings UI surface (Milestone 9). OAuth credentials are stored by **reference** (`token_ref`), never plaintext (ADR-0006/0007 pattern).

---

## 2. Deliverables

### 2.1 `services/settings/src/routes/social-accounts.ts`

```typescript
// services/settings/src/routes/social-accounts.ts
import { FastifyInstance } from 'fastify';
import { prisma } from '../utils/prisma.js';
import { storeSecret } from '../utils/secret.js';   // routes token material → secret manager

export async function socialAccountsRoutes(app: FastifyInstance) {
  // List connected accounts
  app.get('/settings/social-accounts', async (req, reply) => {
    const accounts = await prisma.socialAccount.findMany();
    return reply.type('text/html').send(renderSocialAccountsPage({ accounts }));
  });

  // Connect a social account (store OAuth token ref)
  app.post('/settings/social-accounts/connect', async (req, reply) => {
    const { tenantId, platform, displayName, accountRef, accessToken } = req.body as {
      tenantId: string; platform: string; displayName: string; accountRef: string; accessToken: string;
    };
    const tokenRef = await storeSecret(accessToken);   // returns a reference, not the token
    await prisma.socialAccount.create({
      data: { tenantId, platform, displayName, accountRef, tokenRef },
    });
    return reply.redirect('/settings/social-accounts');
  });

  // Disconnect a social account
  app.post('/settings/social-accounts/:id/disconnect', async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.socialAccount.update({ where: { id }, data: { enabled: false } });
    return reply.redirect('/settings/social-accounts');
  });
}
```

### 2.2 `services/settings/src/utils/secret.ts`

```typescript
// services/settings/src/utils/secret.ts
import { randomUUID } from 'node:crypto';

// Local MVP: store token material in an env-managed store; return a ref.
// Production: swap for a real vault (HashiCorp/AWS Secrets Manager) — ADR-0006/0007.
export async function storeSecret(material: string): Promise<string> {
  // MVP: write to .env-managed key store keyed by a UUID ref
  const ref = `secret:${randomUUID()}`;
  // e.g. await secretManager.put(ref, material);
  return ref;
}
```

### 2.3 `services/settings/src/templates/social-accounts.ts` (simplified)

```typescript
export function renderSocialAccountsPage({ accounts }) {
  return renderLayout({
    title: 'Social Accounts',
    content: `
      <h1>Social Accounts</h1>
      <form method="post" action="/settings/social-accounts/connect">
        <input name="tenantId" placeholder="tenant id">
        <select name="platform">
          <option value="youtube">YouTube</option>
          <option value="facebook">Facebook</option>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
        </select>
        <input name="displayName" placeholder="account name">
        <input name="accountRef" placeholder="channel/account id">
        <input type="password" name="accessToken" placeholder="OAuth access token">
        <button>Connect</button>
      </form>
      ${accounts.map(a => `
        <div>${a.platform} — ${a.displayName} (${a.enabled ? 'enabled' : 'disabled'})
          <form method="post" action="/settings/social-accounts/${a.id}/disconnect">
            <button>Disconnect</button>
          </form>
        </div>`).join('')}
    `,
  });
}
```

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `/settings/social-accounts` lists connected accounts | Visual check |
| 2 | Connect stores a `token_ref` (never the token) in `social_accounts` | DB check (no plaintext token) |
| 3 | Disconnect disables the account (keeps history) | DB check |
| 4 | YouTube-first; FB/IG/TikTok selectable but adapter deferred (Issue 9.3) | Visual + scope check |
| 5 | `pnpm run typecheck` + `pnpm run build` pass | CI check |

---

## 4. Implementation Notes

- **Never store the OAuth token in the DB** — only a `token_ref`; material in the secret manager (ADR-0006/0007).
- **Reuse the Settings UI** (`services/settings`, Milestone 9) — add the `social-accounts` route/template.

---

## 5. Definition of Done

- [ ] Connect/list/disconnect works end-to-end
- [ ] Tokens stored by reference only
- [ ] Typecheck/build pass
- [ ] Unit tests for the route (≥80% coverage)

---

## 6. Cross-References

- **Sprint Plan:** [README.md](./README.md)
- **Architecture:** [social-publish-architecture.md](../architecture/social-publish-architecture.md)
- **Provider credential pattern:** [../../adr/ADR-0006-user-configurable-provider-connection.md](../../adr/ADR-0006-user-configurable-provider-connection.md)
