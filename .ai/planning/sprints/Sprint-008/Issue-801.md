---
id: sprint-008-issue-801
title: "Issue 8.1 — Scaffold Settings Package (services/settings)"
owner: "Lead Engineer (AI Agent)"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-issue"
tags: [sprint-008, issue-801, scaffold, settings, fastify, typescript]
related_documents:
  - "README.md"
  - "settings-ai-workspace-architecture.md"
  - "settings-ai-workspace-stack-proposal.md"
related_sprint: "Sprint-008"
---

# Issue 8.1 — Scaffold Settings Package

> **Sprint:** 8 (Milestone 9: Settings AI Workspace)  
> **Estimate:** S (1-2 hours)  
> **Dependencies:** None  
> **Blockers:** None

---

## 1. Objective

Create the `services/settings` package with all foundational files:
- `package.json` with correct dependencies and scripts
- `tsconfig.json` extending root config
- Fastify entry point (`src/index.ts`)
- Route registration structure
- Environment configuration
- Root `package.json` script integration

---

## 2. Deliverables

### 2.1 `services/settings/package.json`

```json
{
  "name": "@fyi/settings",
  "version": "1.0.0",
  "private": true,
  "description": "FYI Studio Settings — AI Workspace (providers, models, tenants, policy)",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "clean": "rm -rf dist"
  },
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

### 2.2 `services/settings/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "noEmit": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 2.3 `services/settings/.env.example`

```bash
PORT=3002
DATABASE_URL=postgresql://user:***@localhost:5432/fyi_studio
SECRET_MANAGER=env
LOG_LEVEL=info
```

### 2.4 `services/settings/src/index.ts` (Entry Point)

```typescript
// services/settings/src/index.ts
import Fastify, { FastifyInstance } from 'fastify';
import { registerRoutes } from './routes/index.js';

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: { target: 'pino-pretty', options: { colorize: true } },
    },
  });

  await registerRoutes(app);

  app.get('/health', async () => ({ status: 'ok', service: 'settings' }));

  return app;
}

async function start() {
  const app = await buildApp();
  const port = Number(process.env.PORT) ?? 3002;
  const host = process.env.HOST ?? '0.0.0.0';
  try {
    await app.listen({ port, host });
    app.log.info(`⚙️  Settings running at http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

start();
```

### 2.5 `services/settings/src/routes/index.ts` (Route Registration)

```typescript
// services/settings/src/routes/index.ts
import { FastifyInstance } from 'fastify';
import { providersRoutes } from './providers.js';
import { modelsRoutes } from './models.js';
import { tenantsRoutes } from './tenants.js';
import { policyRoutes } from './policy.js';

export async function registerRoutes(app: FastifyInstance) {
  await Promise.all([
    providersRoutes(app),
    modelsRoutes(app),
    tenantsRoutes(app),
    policyRoutes(app),
  ]);
}
```

### 2.6 Root `package.json` Script Updates

```json
{
  "scripts": {
    "settings": "tsx services/settings/src/index.ts",
    "settings:dev": "tsx watch services/settings/src/index.ts",
    "settings:build": "pnpm --filter @fyi/settings run build",
    "settings:typecheck": "pnpm --filter @fyi/settings run typecheck"
  }
}
```

### 2.7 Directory Structure Created

```
services/settings/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts
│   ├── routes/
│   │   ├── index.ts
│   │   ├── providers.ts      # Stub: exports providersRoutes()
│   │   ├── models.ts         # Stub: exports modelsRoutes()
│   │   ├── tenants.ts        # Stub: exports tenantsRoutes()
│   │   └── policy.ts         # Stub: exports policyRoutes()
│   ├── templates/
│   │   └── layout.ts         # Stub: exports renderLayout()
│   ├── client/
│   │   └── providers.ts      # Stub
│   └── utils/
│       ├── prisma.ts         # Stub: exports prisma client
│       └── platform.ts       # Stub: exports @fyi/platform helpers
└── public/
    └── assets/
        └── style.css         # Empty initially
```

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `pnpm install` succeeds with new package | Run `pnpm install` at root |
| 2 | `pnpm run settings:typecheck` passes | Exit code 0 |
| 3 | `pnpm run settings:build` passes | Exit code 0, `dist/` created |
| 4 | `pnpm run settings` starts server on port 3002 | `curl http://localhost:3002/health` returns `{"status":"ok"}` |
| 5 | All stub route modules export functions | TypeScript compiles without errors |

---

## 4. Implementation Notes

- **Follow the Dashboard package pattern** (`services/dashboard`) for consistency — Fastify, pino, tsx.
- **Workspace dependencies** (`@fyi/database`, `@fyi/platform`) are valid for services (not workers).
- **No database writes in scaffold** — those come in Issues 8.2/8.3.

---

## 5. Definition of Done

- [ ] All files created as specified
- [ ] `pnpm install` succeeds
- [ ] `pnpm run settings:typecheck` passes
- [ ] `pnpm run settings:build` passes
- [ ] `pnpm run settings` starts and responds to `/health`
- [ ] No TypeScript errors in monorepo (`pnpm run typecheck` at root)

---

## 6. Cross-References

- **Sprint Plan:** [README.md](./README.md)
- **Architecture:** [settings-ai-workspace-architecture.md](../architecture/settings-ai-workspace-architecture.md)
- **Stack Proposal:** [settings-ai-workspace-stack-proposal.md](../planning/settings-ai-workspace-stack-proposal.md)
