---
id: settings-ai-workspace-stack-proposal
title: "Settings — AI Workspace — Stack Proposal & Rationale (Workstream A / Milestone 9)"
owner: "Lead Engineer (AI Agent) + Founder"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "pre-implementation"
tags: [settings, ai-workspace, providers, models, stack, proposal, rationale, post-mvp, milestone-9]
related_documents:
  - "post-mvp-options.md"
  - "orchestration-delegation-brief.md"
  - "settings-ai-workspace-architecture.md"
  - "../architecture/mvp-architecture.md"
  - "../architecture/contracts.md"
  - "../adr/ADR-0006-user-configurable-provider-connection.md"
  - "../adr/ADR-0007-ai-platform-foundation.md"
  - "../adr/ADR-0010-hitl-revise-approve.md"
---

# Settings — AI Workspace — Stack Proposal & Rationale

> **Status:** PROPOSED (pending Founder approval). This document provides the **detailed technology stack recommendation with reasoning** for the **Settings page for "AI Workspace"** — the post-MVP workstream that lets the Founder connect AI providers (Claude, Gemini, Ollama, ChatGPT) via UI, assign a model per worker/task, and do full CRUD for Brand/Tenant context + policy. It models the Milestone 8 Dashboard stack decision and gives the Founder full visibility into the "why" behind each choice.

---

## 1. Executive Summary

**Recommended Stack:**
| Layer | Choice | Version | Rationale Summary |
|-------|--------|---------|-------------------|
| **Runtime** | Node.js | 20 LTS | Consistency with entire monorepo; no new runtime |
| **Language** | TypeScript (ESM, strict) | 5.x | Type safety across stack; matches all packages |
| **Web Framework** | **Fastify** | 4.x | Already in use by `services/dashboard` (Milestone 8); reuse the proven HTTP layer |
| **Rendering** | **Server-rendered HTML + vanilla JS** | — | Anti-Monster; matches the Dashboard's zero-build pattern |
| **Form Handling** | **HTML `<form>` + POST endpoints (Fastify)** | — | Native browser forms; no client framework needed for CRUD forms |
| **Data Access** | `@fyi/database` (Prisma) + `@fyi/platform` | 5.x / 1.x | Reuse existing Provider Registry + Connection Manager + Policy Engine |
| **Model Resolution** | **ModelGate v2** (`@fyi/platform`) | 1.x | Reuse the capability → connected provider → model resolver from Milestone 2 |
| **Settings Storage** | PostgreSQL (`tenant_context`, `tenant_policies`, `provider_connections`) | — | Reuse existing tables; no new store |
| **Deployment (MVP)** | Local dev server (`npm run settings`) | — | Matches MVP "runs locally" posture |

**What we deliberately do NOT add (MVP):**
- ❌ No React/Vue/Svelte + bundler — overkill for a forms + list CRUD surface; Anti-Monster
- ❌ No new database — reuse `tenant_context`, `tenant_policies`, `provider_connections`, `model_registry`, `capability_registry`
- ❌ No auth for MVP (internal tool) — real auth is a production-hardening concern
- ❌ No WebSocket — simple form POST + refresh matches the Dashboard polling model
- ❌ No direct platform API calls — the Settings page only writes to local tables (provider/model/tenant policy)

---

## 2. Decision Framework: Why This Stack?

### 2.1 Guiding Principles (from Constitution)

| Principle | How Stack Aligns |
|-----------|------------------|
| **Anti-Monster Policy** (max 300 lines/file, strict SRP) | Server-rendered HTML + vanilla JS keeps each form/page small; no framework boilerplate |
| **Documentation First, Code Second** | Stack is fully documented here before implementation |
| **Minimal Dependencies** | Reuses the Dashboard's Fastify stack + `@fyi/database`/`@fyi/platform`; no new runtime deps |
| **Layering: Domain → Application → Infrastructure** | Settings is Application layer; writes to Domain tables (Prisma) and reuses Infrastructure (Provider Registry) |
| **Services may share internal packages** | `services/settings` is a service, so it may use `@fyi/database` + `@fyi/platform` (workers stay contracts-only) |
| **Write-surface guardrail (ADR-0010)** | Settings is a *deliberate* write surface; it must validate and route writes via existing engines (`@fyi/platform`), never raw arbitrary writes |

### 2.2 Evaluation Criteria (Weighted)

| Criterion | Weight | Fastify + Server HTML + Forms | React + Vite | Next.js (forms) | Hono + JSX |
|-----------|--------|-------------------------------|--------------|-----------------|------------|
| **Alignment with Anti-Monster** | 30% | ✅ 10/10 (tiny, zero-build) | ❌ 3/10 (heavy) | ❌ 2/10 (heavy) | ⚠️ 6/10 (JSX = build) |
| **TypeScript Integration** | 20% | ✅ 10/10 (native Fastify + schema) | ✅ 10/10 | ✅ 10/10 | ✅ 9/10 |
| **Time to MVP** | 25% | ✅ 10/10 (reuse Dashboard patterns) | ❌ 4/10 (setup+build) | ❌ 3/10 (setup+build) | ⚠️ 7/10 (needs build) |
| **CRUD/Form Suitability** | 15% | ✅ 9/10 (native forms + POST) | ✅ 8/10 | ✅ 8/10 | ✅ 8/10 |
| **Maintenance Burden** | 10% | ✅ 10/10 (vanilla, no churn) | ❌ 4/10 (ecosystem churn) | ❌ 3/10 (ecosystem churn) | ⚠️ 6/10 (JSX tooling) |

**Weighted Score: Fastify + Server HTML + Forms = 9.8/10** — clear winner, and it **reuses the exact stack already proven in Milestone 8**.

---

## 3. Detailed Stack Justification

### 3.1 Why Extend the Dashboard's Fastify Pattern (not a new framework)

The Milestone 8 Dashboard already established:
- Fastify v4 HTTP server with server-rendered HTML + vanilla JS.
- `@fyi/database` (Prisma) + `@fyi/analytics` service sharing.
- A zero-build, Anti-Monster-friendly page structure.

The Settings page is the **same class of concern** (a small web surface over existing tables), just with **forms + write endpoints** instead of read-only views. Rather than introduce React or another SPA, we extend the proven pattern into a sibling `services/settings` package (or extend the Dashboard) with native HTML forms.

### 3.2 Native HTML Forms over a Client-Side Form Library

The Settings page needs CRUD forms for:
- Connect/disconnect providers + API keys (Claude, Gemini, Ollama, ChatGPT).
- Assign a model per worker/task (via ModelGate + tenant `model_preferences`).
- Edit Brand/Tenant context (`tenant_context`: brand voice, language, forbidden terms).
- Edit tenant policy (`tenant_policies`: cost quota, model prefs, enabled).

Native HTML `<form method="post">` + Fastify `POST` endpoints cover all of these with **zero client framework**. Validation is done server-side (Fastify JSON Schema) + minimal vanilla JS for UX. This is the simplest, most Anti-Monster approach.

### 3.3 Reuse `@fyi/platform` for Provider/Model/Policy logic

The Provider Registry, Connection Manager, Model Registry, Capability Registry, and ModelGate v2 (all Milestone 2 / ADR-0006/0007) are the **source of truth** for provider connections and model resolution. The Settings page calls these engines to:
- List connected providers / available models per capability.
- Save/remove a provider connection (encrypted key ref via secret manager).
- Persist per-tenant model preferences into `tenant_policies.model_preferences`.
- Read/write `tenant_context` (Brand/Tenant CRUD).

This avoids duplicating business logic and keeps the Settings page thin.

---

## 4. Package Structure (New: `services/settings`)

```
services/settings/
├── package.json           # name: "@fyi/settings", private: true
├── tsconfig.json          # extends root, NodeNext, strict
├── .env.example           # PORT, DATABASE_URL, SECRET_MANAGER
├── src/
│   ├── index.ts           # Entry: create Fastify, register routes, listen
│   ├── routes/
│   │   ├── index.ts       # Register all route modules
│   │   ├── providers.ts   # GET/POST /settings/providers (connect/list/disconnect)
│   │   ├── models.ts      # GET/POST /settings/models (assign model per worker/task)
│   │   ├── tenants.ts     # GET/POST /settings/tenants (Brand/Tenant CRUD)
│   │   └── policy.ts      # GET/POST /settings/policy (tenant policy CRUD)
│   ├── templates/
│   │   ├── layout.ts      # Shared HTML shell (reuse Dashboard style)
│   │   ├── providers.ts   # renderProvidersPage(connected, available)
│   │   ├── models.ts      # renderModelsPage(capabilities, assignments)
│   │   ├── tenants.ts     # renderTenantsPage(tenants)
│   │   └── policy.ts      # renderPolicyPage(tenant, policy)
│   ├── client/
│   │   ├── providers.ts   # Vanilla JS: connection form + model dropdown filtering
│   │   └── tenants.ts     # Vanilla JS: tenant context form validation
│   └── utils/
│       ├── prisma.ts      # Prisma client singleton (from @fyi/database)
│       └── platform.ts    # @fyi/platform helpers (ModelGate, policy, connections)
├── public/
│   └── assets/
│       └── style.css      # Minimal CSS (reuse Dashboard stylesheet)
└── README.md              # How to run: npm run settings
```

**Root `package.json` additions:**
```json
{
  "scripts": {
    "settings": "tsx services/settings/src/index.ts",
    "settings:dev": "tsx watch services/settings/src/index.ts"
  }
}
```

---

## 5. API Contract (Settings-Only — WRITE surface, guarded)

All endpoints are **write operations routed through existing engines** (`@fyi/platform`), per the ADR-0010 write-surface guardrail. No direct platform API calls.

| Endpoint | Method | Purpose | Source |
|----------|--------|---------|--------|
| `/settings/providers` | GET | List connected providers + available providers | `@fyi/platform` Provider Registry |
| `/settings/providers/connect` | POST | Connect a provider (store key ref via secret manager) | Connection Manager |
| `/settings/providers/disconnect` | POST | Disconnect a provider | Connection Manager |
| `/settings/models` | GET | List capabilities + current model assignments | ModelGate + Model Registry |
| `/settings/models/assign` | POST | Assign a model per worker/task (capability-gated) | ModelGate + `tenant_policies` |
| `/settings/tenants` | GET | List tenants (Brand context) | `tenant_context` |
| `/settings/tenants/:id` | POST | Create/Update Brand/Tenant context | `tenant_context` |
| `/settings/tenants/:id/delete` | POST | Delete a tenant (context + policy) | `tenant_context` |
| `/settings/policy/:tenantId` | GET | Read tenant policy | `tenant_policies` |
| `/settings/policy/:tenantId` | POST | Create/Update tenant policy (quota, model prefs, enabled) | Policy Engine |

---

## 6. Data Flow Diagram

```
┌─────────────────┐  HTTP GET/POST  ┌───────────────────────────┐
│  Browser        │ ──────────────► │  Fastify (Settings)       │
│  (Settings UI)  │                 │  services/settings        │
└─────────────────┘                 └────────────┬──────────────┘
                                                 │
              ┌──────────────────────────────────┼──────────────────────────┐
              ▼                                  ▼                          ▼
      ┌─────────────────┐               ┌─────────────────┐       ┌─────────────────┐
      │ @fyi/database   │               │ @fyi/platform   │       │ Secret Manager  │
      │ (Prisma)        │               │ (ModelGate,     │       │ (key ref only)  │
      │ tenant_context  │               │  Policy Engine, │       │                 │
      │ tenant_policies │               │  Provider/      │       │                 │
      │ provider_conns  │               │  Connection Mgr │       │                 │
      └────────┬────────┘               └────────┬────────┘       └────────┬────────┘
               │                                 │                        │
               ▼                                 ▼                        ▼
      ┌────────────────────────────────────────────────────────────────────────┐
      │                         PostgreSQL (existing tables)                   │
      │  provider_connections • model_registry • capability_registry •          │
      │  tenant_context • tenant_policies                                       │
      └────────────────────────────────────────────────────────────────────────┘
```

**Key Invariants:**
1. **Write-surface guardrail** — every write routes through `@fyi/platform` engines (ModelGate, Policy Engine, Connection Manager); no raw arbitrary writes.
2. **No direct platform API calls** — the Settings page only persists local config; providers/models are resolved at worker runtime by ModelGate.
3. **Secrets by reference** — API keys stored as `key_ref` in DB; material in the secret manager (ADR-0006/0007 policy).
4. **Contracts v1.1 remain frozen** — the Settings page is application-layer; it does not change the worker/contract layer.

---

## 7. Implementation Estimate (Sprint 8 / "Settings AI Workspace")

| Step | Task | Est. | Notes |
|------|------|------|-------|
| 8.1 | Scaffold `services/settings` (Fastify, forms, root script) | S (1-2h) | Copy Dashboard package pattern |
| 8.2 | Provider + model assignment UI (connect providers, assign per-task model) | M (3-5h) | Reuse `@fyi/platform` ModelGate + Connection Manager |
| 8.3 | Brand/Tenant context + policy CRUD (full CRUD via forms) | M (3-5h) | `tenant_context` + `tenant_policies` via Policy Engine |
| 8.4 | Dashboard polish (readable artifacts, References, Download JSON) | M (3-5h) | Workstream D items folded here |
| 8.5 | HITL approve/revise write endpoints + step re-run (ADR-0010) | M (3-5h) | Supervisor/StepRunner extension + routes |

**Total: ~13-22h** (matches the Sprint 8 plan in `.ai/planning/sprints/Sprint-008/`).

---

## 8. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Scope creep into full SPA | High | Medium | Lock to server-rendered HTML + forms; defer React/Vite |
| Accidental/destructive writes | High | Medium | Route all writes via `@fyi/platform`; validate server-side; delete guarded |
| API key leakage | High | Low | Key ref only in DB; secret manager; strict git-ignore (.env) |
| Model capability metadata drift | Medium | Medium | Read from Model Registry; capability-gate the assignment dropdown |
| Write-surface invariant creep | Medium | Medium | ADR-0010 documents the exact scope (approve/revise); no general CRUD on jobs |
| Duplicate logic vs Dashboard | Medium | Medium | Reuse Dashboard layout/CSS + `@fyi/database`/`@fyi/platform`; share `services` utils |

---

## 9. Founder Decision Request

**Please review and confirm:**

1. **Stack approved?** Fastify + Server HTML + native forms + `@fyi/database` + `@fyi/platform` (ModelGate/Policy/Connection Manager).
2. **Scope locked?** Provider connect/disconnect, per-task model assignment, Brand/Tenant context + policy full CRUD, plus Dashboard polish (readable artifacts, References, Download JSON) and HITL approve/revise (ADR-0010).
3. **Write-surface guardrail?** All writes route through `@fyi/platform`; no raw arbitrary DB writes.
4. **Timeline acceptable?** ~13-22h (Sprint 8).

**If approved, next steps:**
- Create Milestone 9 architecture doc (`.ai/architecture/settings-ai-workspace-architecture.md`).
- Create Sprint 8 plan + Issues 8.1–8.5 (`.ai/planning/sprints/Sprint-008/`).
- Update `orchestration-delegation-brief.md` for external agent delegation.
- Begin implementation.

---

## 10. Cross-References

- **Decision record:** [post-mvp-options.md](./post-mvp-options.md)
- **Delegation brief:** [orchestration-delegation-brief.md](./orchestration-delegation-brief.md)
- **Architecture (Milestone 9):** [settings-ai-workspace-architecture.md](../architecture/settings-ai-workspace-architecture.md)
- **MVP architecture (invariants):** [../architecture/mvp-architecture.md](../architecture/mvp-architecture.md)
- **Frozen contracts (unchanged):** [../architecture/contracts.md](../architecture/contracts.md)
- **Provider Connection / ModelGate (Milestone 2):** [../adr/ADR-0006-user-configurable-provider-connection.md](../adr/ADR-0006-user-configurable-provider-connection.md), [../adr/ADR-0007-ai-platform-foundation.md](../adr/ADR-0007-ai-platform-foundation.md)
- **HITL write exception:** [../adr/ADR-0010-hitl-revise-approve.md](../adr/ADR-0010-hitl-revise-approve.md)
