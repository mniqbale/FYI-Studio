---
id: settings-ai-workspace-architecture
title: "FYI Studio Settings AI Workspace Architecture (Milestone 9)"
owner: "Principal Architect"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-milestone"
tags: [architecture, settings, ai-workspace, milestone-9, providers, models, tenants, write-surface, post-mvp]
related_documents:
  - "mvp-architecture.md"
  - "contracts.md"
  - "engineering-standards.md"
  - "dashboard-architecture.md"
  - "../planning/settings-ai-workspace-stack-proposal.md"
  - "../planning/post-mvp-options.md"
  - "../planning/sprints/Sprint-008/README.md"
related_adr:
  - "ADR-0001"
  - "ADR-0006"
  - "ADR-0007"
  - "ADR-0010"
related_sprint:
  - "Sprint-008"
---

# FYI Studio Settings AI Workspace Architecture — Milestone 9

> **Status:** PROPOSED (pending Founder approval). This document defines the architecture for the **Settings page for "AI Workspace"** — the post-MVP workstream that lets the Founder connect AI providers via UI, assign a model per worker/task, and do full CRUD for Brand/Tenant context + policy. It extends the Milestone 8 Dashboard with a **guarded write surface** (per ADR-0010) and reuses the Milestone 2 AI Platform Foundation (`@fyi/platform`).

---

## 1. Purpose & Scope

### 1.1 Why a Settings AI Workspace?

Today, provider connections and model assignment exist only via the **CLI** (`fyi provider connect|list|disconnect|select`), and Brand/Tenant context + policy CRUD exists only via the CLI/DB. The Founder's visual-review workflow (which drove the Dashboard) needs a **web Settings page** to:
- Connect AI providers (Claude, Gemini, Ollama, ChatGPT) via UI — the infra already exists in `@fyi/platform` Provider Registry + Connection Manager (Milestone 2).
- Assign a model per worker/task (research → gemma, script → deepseek-v4-flash, etc.) via **ModelGate** + tenant `model_preferences`.
- Do full CRUD for Brand/Tenant context (`tenant_context`) + policy (`tenant_policies`).

### 1.2 Scope (MVP)

**In Scope:**
- A Settings web surface (`services/settings`) with server-rendered forms + write endpoints.
- Provider connect/disconnect (Claude, Gemini, Ollama, ChatGPT) via `@fyi/platform` Connection Manager.
- Per-worker/task model assignment via ModelGate + `tenant_policies.model_preferences`.
- Brand/Tenant context full CRUD (`tenant_context`) + policy CRUD (`tenant_policies`).
- **Dashboard polish (Workstream D):** (6) artifacts as human-readable text with a "Download JSON" button (zip or individual), (7) References/Bibliography section on `/jobs/:id`, (8) HITL **Revise** section (edit + re-run a step) — a **deliberate write exception** per ADR-0010.

**Out of Scope (Post-MVP / Hardening):**
- Authentication/Authorization (Option F: Production Hardening).
- WebSocket/push updates.
- Platform publish & analytics (Milestones 10 & 11 — separate workstreams).
- General Dashboard CRUD beyond approve/revise (ADR-0010 scope).
- Real secret vault (env vars for local MVP; production hardening).

---

## 2. Architectural Positioning

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FYI STUDIO SYSTEM (MVP + M9)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                   SERVICES (Application layer)                       │     │
│  │  ┌─────────────────────┐   ┌─────────────────────┐                  │     │
│  │  │  services/dashboard │   │  services/settings  │ (NEW - M9)       │     │
│  │  │  (read-only, M8)    │   │  (forms + WRITE,    │                  │     │
│  │  └──────────┬──────────┘   │   guarded ADR-0010) │                  │     │
│  │             │              └──────────┬──────────┘                  │     │
│  └─────────────┼─────────────────────────┼─────────────────────────────┘     │
│                │                         │                                   │
│                ▼                         ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                    @fyi/platform (AI Platform Foundation, M2)        │     │
│  │  • Provider Registry   • Connection Manager (key_ref)               │     │
│  │  • Model Registry      • Capability Registry                        │     │
│  │  • ModelGate v2 (capability → connected → model)                    │     │
│  │  • Policy Engine (tenant_policies: quota, model prefs)              │     │
│  └──────────────┬──────────────────────────────────────┬───────────────┘     │
│                 │                                      │                     │
│                 ▼                                      ▼                     │
│  ┌────────────────────────────┐        ┌─────────────────────────────┐       │
│  │  @fyi/database (Prisma)    │        │  Secret Manager (key refs)  │       │
│  │  provider_connections •    │        │  (API key material, never   │       │
│  │  model_registry •          │        │   in DB/logs)               │       │
│  │  tenant_context •          │        └─────────────────────────────┘       │
│  │  tenant_policies           │                                              │
│  └────────────┬───────────────┘                                              │
│               ▼                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐        │
│  │                       PostgreSQL (Job Ledger)                    │        │
│  └──────────────────────────────────────────────────────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Invariants:**
1. **Write-surface guardrail** — all Settings writes route through `@fyi/platform` engines (ModelGate, Policy Engine, Connection Manager); no raw arbitrary writes.
2. **No direct platform API calls** — Settings persists local config only; providers/models resolve at worker runtime by ModelGate.
3. **Secrets by reference** — API keys stored as `key_ref`; material in secret manager (ADR-0006/0007).
4. **Contracts v1.1 frozen** — Settings is application-layer; worker/contract layer unchanged.
5. **HITL write exception (ADR-0010)** — the Dashboard gains approve/revise as a *scoped, deliberate* write exception; all other views stay read-only.

---

## 3. Technology Stack

| Layer | Choice | Version | Rationale |
|-------|--------|---------|-----------|
| **Runtime** | Node.js | 20 LTS | Consistency with monorepo; no new runtime |
| **Language** | TypeScript (ESM, strict, NodeNext) | 5.x | Type safety; matches all packages |
| **Web Framework** | **Fastify** | 4.x | Proven in Milestone 8; schema validation; plugin ecosystem |
| **Rendering** | **Server-rendered HTML + Vanilla JS** | — | Anti-Monster; zero-build; matches Dashboard |
| **Forms** | **Native HTML `<form>` + Fastify POST** | — | Simplest Anti-Monster CRUD; server-side validation |
| **Data Access** | `@fyi/database` (Prisma) | 5.x | Reuse existing client; read/write tenant/provider tables |
| **AI Platform** | `@fyi/platform` (ModelGate, Policy, Connection Manager) | 1.x | Reuse Milestone 2 infrastructure |
| **Secrets** | Secret manager + `key_ref` (env for MVP) | — | ADR-0006/0007 pattern |
| **Deployment (MVP)** | Local dev server | — | `npm run settings` |

**Dependencies (`services/settings/package.json`):**
```json
{
  "dependencies": {
    "fastify": "^4.28.0",
    "@fyi/database": "workspace:*",
    "@fyi/platform": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsx": "^4.19.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## 4. Package Structure

```
services/settings/
├── package.json              # @fyi/settings (private)
├── tsconfig.json             # extends root, NodeNext, strict
├── .env.example              # PORT, DATABASE_URL, SECRET_MANAGER
├── src/
│   ├── index.ts              # Entry: create Fastify, register routes, listen
│   ├── routes/
│   │   ├── index.ts          # Register all route modules
│   │   ├── providers.ts      # GET/POST /settings/providers (connect/list/disconnect)
│   │   ├── models.ts         # GET/POST /settings/models (assign per worker/task)
│   │   ├── tenants.ts        # GET/POST /settings/tenants (Brand/Tenant CRUD)
│   │   └── policy.ts         # GET/POST /settings/policy (tenant policy CRUD)
│   ├── templates/
│   │   ├── layout.ts         # Shared HTML shell (reuse Dashboard style)
│   │   ├── providers.ts      # renderProvidersPage(connected, available)
│   │   ├── models.ts         # renderModelsPage(capabilities, assignments)
│   │   ├── tenants.ts        # renderTenantsPage(tenants)
│   │   └── policy.ts         # renderPolicyPage(tenant, policy)
│   ├── client/
│   │   ├── providers.ts      # Vanilla JS: connection form + model dropdown filtering
│   │   └── tenants.ts        # Vanilla JS: tenant context form validation
│   └── utils/
│       ├── prisma.ts         # Prisma client singleton (from @fyi/database)
│       └── platform.ts       # @fyi/platform helpers (ModelGate, policy, connections)
├── public/
│   └── assets/
│       └── style.css         # Minimal CSS (reuse Dashboard stylesheet)
└── README.md                 # How to run: npm run settings
```

**Dashboard polish additions (Workstream D, in `services/dashboard`):**
```
services/dashboard/src/
├── templates/
│   ├── job-detail.ts         # (UPDATED) readable artifacts + References section + Revise section
│   └── job-detail-partials/
│       ├── artifacts.ts      # Render artifacts as human-readable text + Download JSON
│       ├── references.ts     # References/Bibliography from research sources
│       └── revise.ts         # Revise form (edit input + re-run step)
├── routes/
│   └── jobs.ts               # (UPDATED) + POST /api/jobs/:id/approve, POST /api/jobs/:id/revise
└── utils/
    ├── artifacts.ts          # artifact → readable text formatter + zip download
    └── revise.ts             # StepRunner.reRunStep caller (delegates to Supervisor)
```

---

## 5. API Contract (Settings-Only + Dashboard HITL)

### 5.1 Settings HTML Pages (Browser Navigation)

| Route | Template | Description |
|-------|----------|-------------|
| `GET /settings` | `layout.ts` | Settings home / nav |
| `GET /settings/providers` | `providers.ts` | Connected + available providers, connect/disconnect forms |
| `GET /settings/models` | `models.ts` | Capabilities + per-worker model assignment |
| `GET /settings/tenants` | `tenants.ts` | Brand/Tenant context list + create/edit forms |
| `GET /settings/policy/:tenantId` | `policy.ts` | Tenant policy (quota, model prefs, enabled) form |

### 5.2 Settings Write Endpoints (routed via `@fyi/platform`)

| Endpoint | Method | Purpose | Engine |
|----------|--------|---------|--------|
| `/settings/providers/connect` | POST | Connect a provider (store key ref) | Connection Manager |
| `/settings/providers/disconnect` | POST | Disconnect a provider | Connection Manager |
| `/settings/models/assign` | POST | Assign a model per worker/task (capability-gated) | ModelGate + `tenant_policies` |
| `/settings/tenants/:id` | POST | Create/Update Brand/Tenant context | `tenant_context` (Prisma) |
| `/settings/tenants/:id/delete` | POST | Delete a tenant (context + policy) | `tenant_context`/`tenant_policies` |
| `/settings/policy/:tenantId` | POST | Create/Update tenant policy | Policy Engine |

### 5.3 Dashboard HITL Write Endpoints (ADR-0010 exception)

| Endpoint | Method | Purpose | Routing |
|----------|--------|---------|---------|
| `POST /api/jobs/:id/approve` | POST | Resume a `WAITING_APPROVAL` job | Delegates to Supervisor (sole writer to status) |
| `POST /api/jobs/:id/revise` | POST | Edit step input + re-run a specific step | Delegates to StepRunner.reRunStep |

---

## 6. Data Flow

### 6.1 Provider Connect (write)

```
Browser: /settings/providers → POST /settings/providers/connect { provider, api_key }
       ▼
Fastify route → @fyi/platform Connection Manager
       ├─► store key_ref in provider_connections (key material → secret manager)
       └─► validate connection → success/error
       ▼
reply.redirect('/settings/providers') → refreshed list
```

### 6.2 Per-Worker Model Assignment (write)

```
Browser: /settings/models → POST /settings/models/assign { capability, provider, model, tenant_id }
       ▼
Fastify route → ModelGate (capability → connected provider → capable model)
       ├─► validate capability + connection + model capability
       └─► persist to tenant_policies.model_preferences
       ▼
reply.redirect('/settings/models') → refreshed assignments
```

### 6.3 Dashboard Revise (HITL write — ADR-0010)

```
Browser: /jobs/:id → Revise form → POST /api/jobs/:id/revise { step_index, edited_input }
       ▼
Fastify route (services/dashboard) → services/supervisor StepRunner.reRunStep(jobId, stepIndex, input)
       ├─► (guardrail) validate job state = RUNNING/WAITING_APPROVAL for that step
       ├─► update job.artifacts with edited input
       └─► re-dispatch that step through the normal worker pipeline
       ▼
reply.json({ status: 're-running', step_index }) → Dashboard polls progress
```

---

## 7. Database Access (write via engines)

All Settings writes go through `@fyi/platform` engines or scoped Prisma calls (tenant context/policy). Example:

```typescript
// utils/platform.ts
import { modelGate, tenantPolicy } from '@fyi/platform';

export async function assignModelToCapability(tenantId: string, capability: string, modelId: string) {
  // 1. Validate: capability must be resolvable by ModelGate (connected + capable)
  const resolved = await modelGate.resolve({ capability, tenantId });
  // 2. Persist per-tenant preference
  await tenantPolicy.upsertModelPreference(tenantId, { [capability]: modelId });
  return resolved;
}
```

---

## 8. Root Package.json Integration

```json
// /workspaces/FYI-Studio/package.json
{
  "scripts": {
    "settings": "tsx services/settings/src/index.ts",
    "settings:dev": "tsx watch services/settings/src/index.ts",
    "settings:build": "pnpm --filter @fyi/settings run build",
    "settings:typecheck": "pnpm --filter @fyi/settings run typecheck"
  }
}
```

---

## 9. Environment Variables

```bash
# services/settings/.env.example
PORT=3002
DATABASE_URL=postgresql://user:pass@localhost:5432/fyi_studio
SECRET_MANAGER=env          # env for local MVP; vault for production
LOG_LEVEL=info
```

---

## 10. Definition of Done (Milestone 9)

| Criterion | Verification |
|-----------|--------------|
| `npm run settings` starts server on `http://localhost:3002` | Manual test |
| `/settings/providers` connects/disconnects Claude, Gemini, Ollama, ChatGPT | Visual + DB check (`provider_connections`) |
| `/settings/models` assigns model per worker/task; dropdown capability-gated | Visual check + ModelGate resolution |
| `/settings/tenants` full CRUD for Brand/Tenant context | Visual + DB check (`tenant_context`) |
| `/settings/policy/:tenantId` CRUD for policy (quota, model prefs, enabled) | Visual + Policy Engine check |
| Dashboard artifacts show human-readable text + "Download JSON" (zip/individual) | Visual check + download works |
| `/jobs/:id` shows References/Bibliography section from research sources | Visual check |
| Dashboard `POST /api/jobs/:id/revise` re-runs a step; `approve` resumes a job | E2E: WAITING_APPROVAL → revise → re-run → approve → complete |
| Writes route via engines (no raw arbitrary DB writes) | Code review + unit tests |
| `pnpm run typecheck` + `pnpm run build` pass | CI check |
| Unit tests for routes (≥80% coverage) | `pnpm test` |

---

## 11. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Scope creep into full SPA | High | Medium | Lock server-rendered HTML + forms; defer React/Vite |
| Accidental/destructive writes | High | Medium | Route via `@fyi/platform`; server-side validation; delete guarded |
| API key leakage | High | Low | Key ref only; secret manager; strict git-ignore (.env) |
| Model capability drift | Medium | Medium | Read from Model Registry; capability-gate assignment dropdown |
| HITL write invariant creep | Medium | Medium | ADR-0010 documents exact scope (approve/revise only) |
| Duplicate logic vs Dashboard | Medium | Medium | Reuse Dashboard layout/CSS + `@fyi/database`/`@fyi/platform` |

---

## 12. Cross-References

- **Stack Proposal:** [../planning/settings-ai-workspace-stack-proposal.md](../planning/settings-ai-workspace-stack-proposal.md)
- **Decision Record:** [../planning/post-mvp-options.md](../planning/post-mvp-options.md)
- **Delegation Brief:** [../planning/orchestration-delegation-brief.md](../planning/orchestration-delegation-brief.md)
- **Sprint Plan:** [../planning/sprints/Sprint-008/README.md](../planning/sprints/Sprint-008/README.md)
- **MVP Architecture (invariants):** [mvp-architecture.md](mvp-architecture.md)
- **Dashboard Architecture:** [dashboard-architecture.md](dashboard-architecture.md)
- **Provider Connection / ModelGate:** [../adr/ADR-0006-user-configurable-provider-connection.md](../adr/ADR-0006-user-configurable-provider-connection.md), [../adr/ADR-0007-ai-platform-foundation.md](../adr/ADR-0007-ai-platform-foundation.md)
- **HITL write exception:** [../adr/ADR-0010-hitl-revise-approve.md](../adr/ADR-0010-hitl-revise-approve.md)
- **Frozen Contracts:** [contracts.md](contracts.md)

---

## 13. Next Steps (Upon Approval)

1. Create Sprint 8 plan: `.ai/planning/sprints/Sprint-008/README.md`
2. Create Issues 8.1–8.5: `.ai/planning/sprints/Sprint-008/Issue-801.md` through `Issue-805.md`
3. Update `orchestration-delegation-brief.md` with finalized scope
4. Scaffold `services/settings` package
5. Begin implementation per Sprint 8 plan
