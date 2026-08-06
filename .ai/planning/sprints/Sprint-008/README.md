---
id: sprint-008-readme
title: "Sprint 8 — Settings AI Workspace Implementation Plan (Milestone 9)"
owner: "Lead Engineer (AI Agent)"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-sprint"
tags: [sprint, planning, settings, ai-workspace, providers, models, milestone-9, dashboard-polish, implementation]
related_documents:
  - "settings-ai-workspace-architecture.md"
  - "settings-ai-workspace-stack-proposal.md"
  - "post-mvp-options.md"
  - "orchestration-delegation-brief.md"
  - "Issue-801.md"
  - "Issue-802.md"
  - "Issue-803.md"
  - "Issue-804.md"
  - "Issue-805.md"
related_sprint: "Sprint-008"
---

# Sprint 8 — Settings AI Workspace Implementation Plan (Milestone 9)

> **Status:** PROPOSED (pending Founder approval). This sprint implements **Milestone 9: Settings AI Workspace** — a web Settings surface to connect AI providers via UI, assign a model per worker/task, and do full CRUD for Brand/Tenant context + policy. It also folds in **Dashboard polish (Workstream D)**: readable artifacts + Download JSON, a References/Bibliography section, and the HITL Revise/Approve write surface (ADR-0010).

---

## 1. Sprint Goal

**Build a functional Settings AI Workspace** that:
- Connects/disconnects AI providers (Claude, Gemini, Ollama, ChatGPT) via UI (reusing `@fyi/platform`).
- Assigns a model per worker/task via ModelGate + tenant `model_preferences`.
- Provides full CRUD for Brand/Tenant context + policy.
- **Plus Dashboard polish (Workstream D):** human-readable artifacts with Download JSON, References/Bibliography on `/jobs/:id`, and HITL Revise/Approve write operations (ADR-0010).
- Passes `pnpm run typecheck` and `pnpm run build`.

---

## 2. Scope

| In Scope | Out of Scope |
|----------|--------------|
| `services/settings` Fastify server (forms + write endpoints) | Authentication/Authorization |
| Provider connect/disconnect via `@fyi/platform` Connection Manager | WebSocket/push updates |
| Per-worker/task model assignment via ModelGate | Platform Publish (Milestone 10) |
| Brand/Tenant context + policy full CRUD | Platform Analytics (Milestone 11) |
| **Dashboard polish:** readable artifacts + Download JSON + References + Revise/Approve | General Dashboard CRUD beyond approve/revise |
| Reuse `@fyi/database` + `@fyi/platform` | Real secret vault (env for MVP) |

---

## 3. Issues (Tasks)

| Issue | Title | Description | Est. | Dependencies |
|-------|-------|-------------|------|--------------|
| **8.1** | Scaffold `services/settings` Package | Create Fastify package with forms, root scripts | S (1-2h) | None |
| **8.2** | Provider + Model Assignment UI | Connect/disconnect providers; assign model per worker/task (capability-gated) | M (3-5h) | 8.1 |
| **8.3** | Brand/Tenant Context + Policy CRUD | Full CRUD for `tenant_context` + `tenant_policies` via forms | M (3-5h) | 8.1 |
| **8.4** | Dashboard Polish: Readable Artifacts + References + Download JSON | (6) artifacts as human-readable text + Download JSON (zip/individual); (7) References/Bibliography section | M (3-5h) | 8.1 |
| **8.5** | HITL Revise/Approve (ADR-0010) | (8) Revise section to edit + re-run a step; approve a `WAITING_APPROVAL` job; step re-run via StepRunner | M (3-5h) | 8.4 |

**Total Estimate: 13-22 hours** (Settings + Dashboard polish folded into Sprint 8).

> **Note on Workstream D (Dashboard polish):** The Dashboard polish items — (6) readable artifacts + Download JSON, (7) References/Bibliography, (8) Revise/Approve — are **folded into Sprint 8** as Issues 8.4 and 8.5 rather than a separate Sprint 8b, because they share the `services/dashboard` codebase and the HITL write surface (ADR-0010) naturally co-locates with the Settings write-surface work. This keeps the workstreams aligned and avoids a near-empty "Sprint 8b".

---

## 4. Technical Approach

### 4.1 Package Structure
```
services/settings/
├── package.json              # @fyi/settings
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts              # Fastify entry point
│   ├── routes/
│   │   ├── index.ts
│   │   ├── providers.ts      # connect/list/disconnect
│   │   ├── models.ts         # assign per worker/task
│   │   ├── tenants.ts        # Brand/Tenant CRUD
│   │   └── policy.ts         # tenant policy CRUD
│   ├── templates/
│   │   ├── layout.ts
│   │   ├── providers.ts
│   │   ├── models.ts
│   │   ├── tenants.ts
│   │   └── policy.ts
│   ├── client/
│   │   ├── providers.ts
│   │   └── tenants.ts
│   └── utils/
│       ├── prisma.ts
│       └── platform.ts       # @fyi/platform helpers
└── public/assets/style.css
```

### 4.2 Key Patterns

**Native HTML Forms (CRUD):**
```html
<form method="post" action="/settings/providers/connect">
  <select name="provider">...</select>
  <input type="password" name="api_key" />
  <button type="submit">Connect</button>
</form>
```

**Server-side validation (Fastify schema):**
```typescript
fastify.post('/settings/providers/connect', {
  schema: { body: { type: 'object', required: ['provider', 'api_key'], ... } },
  handler: async (req, reply) => { await connectProvider(req.body); reply.redirect('/settings/providers'); }
});
```

**ModelGate reuse (capability-gated dropdown):**
```typescript
import { modelGate } from '@fyi/platform';
const candidates = await modelGate.candidates({ capability: 'research:real', tenantId });
// → only connected + capable models; build <select> from this
```

**Dashboard HITL write (ADR-0010):**
```typescript
// services/dashboard routes
fastify.post('/api/jobs/:id/revise', async (req, reply) => {
  const { stepIndex, input } = req.body;
  await stepRunner.reRunStep(jobId, stepIndex, input);  // delegated to Supervisor
  reply.send({ status: 're-running', stepIndex });
});
```

---

## 5. Acceptance Criteria (Definition of Done)

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `npm run settings` starts server on `http://localhost:3002` | Manual: `curl localhost:3002/settings` |
| 2 | `/settings/providers` connects/disconnects Claude, Gemini, Ollama, ChatGPT | Visual + DB check (`provider_connections`) |
| 3 | `/settings/models` assigns a model per worker/task; dropdown capability-gated | Visual + ModelGate resolution check |
| 4 | `/settings/tenants` full CRUD for Brand/Tenant context | Visual + DB check (`tenant_context`) |
| 5 | `/settings/policy/:tenantId` CRUD for policy | Visual + Policy Engine check |
| 6 | Dashboard artifacts show human-readable text + Download JSON (zip/individual) | Visual check + download works |
| 7 | `/jobs/:id` shows References/Bibliography from research sources | Visual check |
| 8 | Dashboard `POST /api/jobs/:id/revise` re-runs a step; `approve` resumes a job | E2E: WAITING_APPROVAL → revise → re-run → approve → complete |
| 9 | Writes route via engines; no raw arbitrary DB writes | Code review + unit tests |
| 10 | `pnpm run typecheck` + `pnpm run build` pass | CI check |
| 11 | Unit tests for routes (≥80% coverage) | `pnpm test` |

---

## 6. Dependencies & Prerequisites

- **MVP + Dashboard Complete** (Milestones 1–8 done) — verified in `current-state.md`
- **PostgreSQL + Redis running** — `pnpm run infra:up`
- **`@fyi/platform` (Milestone 2)** — Provider Registry, Connection Manager, ModelGate, Policy Engine (already implemented)
- **At least one `WAITING_APPROVAL` job** — for the Revise/Approve E2E (Issue 8.5)
- **Node.js 20+, pnpm 9+** — already in environment

---

## 7. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Scope creep into SPA | High | Medium | Lock server HTML + forms; defer React/Vite |
| Accidental/destructive writes | High | Medium | Route via `@fyi/platform`; server-side validation; delete guarded |
| API key leakage | High | Low | Key ref only; secret manager; git-ignore (.env) |
| HITL write invariant creep | Medium | Medium | ADR-0010 documents exact scope (approve/revise only) |
| StepRunner re-run breaks forward-only chain | Medium | Medium | Careful extension; unit tests; preserve single-writer (ADR-0004) |

---

## 8. Cross-References

- **Architecture:** [settings-ai-workspace-architecture.md](../architecture/settings-ai-workspace-architecture.md)
- **Stack Proposal:** [settings-ai-workspace-stack-proposal.md](../planning/settings-ai-workspace-stack-proposal.md)
- **Decision Record:** [post-mvp-options.md](../planning/post-mvp-options.md)
- **Delegation Brief:** [orchestration-delegation-brief.md](../planning/orchestration-delegation-brief.md)
- **ADR-0010 (HITL write exception):** [../../adr/ADR-0010-hitl-revise-approve.md](../../adr/ADR-0010-hitl-revise-approve.md)
- **MVP Architecture:** [../../architecture/mvp-architecture.md](../../architecture/mvp-architecture.md)

---

## 9. Next Steps

1. Founder approves this sprint plan
2. Create Issue docs (801-805) with detailed acceptance criteria
3. Update `orchestration-delegation-brief.md` with finalized scope
4. Begin implementation: Issue 8.1 → 8.2 → 8.3 → 8.4 → 8.5
