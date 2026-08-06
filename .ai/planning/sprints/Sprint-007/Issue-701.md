---
id: sprint-007-issue-701
title: "Issue 7.1 — Scaffold Dashboard Package (services/dashboard)"
owner: "Lead Engineer (AI Agent)"
status: "done"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-issue"
tags: [sprint-007, issue-701, scaffold, dashboard, fastify, typescript]
related_documents:
  - "README.md"
  - "dashboard-architecture.md"
  - "dashboard-stack-proposal.md"
related_sprint: "Sprint-007"
---

# Issue 7.1 — Scaffold Dashboard Package

> **Sprint:** 7 (Milestone 8: Dashboard UI)  
> **Estimate:** S (1-2 hours)  
> **Dependencies:** None  
> **Blockers:** None

---

## 1. Objective

Create the `services/dashboard` package with all foundational files:
- `package.json` with correct dependencies and scripts
- `tsconfig.json` extending root config
- Fastify entry point (`src/index.ts`)
- Route registration structure
- Environment configuration
- Root `package.json` script integration

---

## 2. Deliverables

### 2.1 `services/dashboard/package.json`

```json
{
  "name": "@fyi/dashboard",
  "version": "1.0.0",
  "private": true,
  "description": "FYI Studio Dashboard — Read-only UI over Job Ledger",
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
    "@fastify/static": "^7.0.0",
    "@fyi/database": "workspace:*",
    "@fyi/analytics": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsx": "^4.19.0",
    "@types/node": "^20.0.0"
  }
}
```

### 2.2 `services/dashboard/tsconfig.json`

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

**Note:** Root `tsconfig.json` should have `"baseUrl": ".", "paths": { "@fyi/*": ["packages/*", "services/*", "workers/*"] }` for workspace imports.

### 2.3 `services/dashboard/.env.example`

```bash
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/fyi_studio
FYI_MEDIA_ROOT=/tmp/fyi-studio
LOG_LEVEL=info
```

### 2.4 `services/dashboard/src/index.ts` (Entry Point)

```typescript
// services/dashboard/src/index.ts
import Fastify, { FastifyInstance } from 'fastify';
import { registerRoutes } from './routes/index.js';
import { mediaRoutes } from './routes/media.js';

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: { target: 'pino-pretty', options: { colorize: true } },
    },
  });

  // Register API + HTML routes
  await registerRoutes(app);
  
  // Register media static serving
  await mediaRoutes(app);

  // Health check
  app.get('/health', async () => ({ status: 'ok', service: 'dashboard' }));

  return app;
}

async function start() {
  const app = await buildApp();
  const port = Number(process.env.PORT) ?? 3001;
  const host = process.env.HOST ?? '0.0.0.0';

  try {
    await app.listen({ port, host });
    app.log.info(`🚀 Dashboard running at http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

start();
```

### 2.5 `services/dashboard/src/routes/index.ts` (Route Registration)

```typescript
// services/dashboard/src/routes/index.ts
import { FastifyInstance } from 'fastify';
import { overviewRoutes } from './overview.js';
import { jobsRoutes } from './jobs.js';
import { tenantsRoutes } from './tenants.js';
import { analyticsRoutes } from './analytics.js';

export async function registerRoutes(app: FastifyInstance) {
  // Register all route modules
  await Promise.all([
    overviewRoutes(app),
    jobsRoutes(app),
    tenantsRoutes(app),
    analyticsRoutes(app),
  ]);
}
```

### 2.6 Root `package.json` Script Updates

Add to `/workspaces/FYI-Studio/package.json`:

```json
{
  "scripts": {
    "dashboard": "tsx services/dashboard/src/index.ts",
    "dashboard:dev": "tsx watch services/dashboard/src/index.ts",
    "dashboard:build": "pnpm --filter @fyi/dashboard run build",
    "dashboard:typecheck": "pnpm --filter @fyi/dashboard run typecheck"
  }
}
```

### 2.7 Directory Structure Created

```
services/dashboard/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts
│   ├── routes/
│   │   ├── index.ts
│   │   ├── overview.ts      # Stub: exports overviewRoutes()
│   │   ├── jobs.ts          # Stub: exports jobsRoutes()
│   │   ├── tenants.ts       # Stub: exports tenantsRoutes()
│   │   ├── analytics.ts     # Stub: exports analyticsRoutes()
│   │   └── media.ts         # Stub: exports mediaRoutes()
│   ├── templates/
│   │   └── layout.ts        # Stub: exports renderLayout()
│   ├── client/
│   │   └── polling.ts       # Stub: exports startPolling()
│   └── utils/
│       ├── prisma.ts        # Stub: exports prisma client
│       ├── analytics.ts     # Stub: exports analytics helpers
│       └── media.ts         # Stub: exports media helpers
└── public/
    └── assets/
        └── style.css        # Empty initially
```

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `pnpm install` succeeds with new package | Run `pnpm install` at root |
| 2 | `pnpm run dashboard:typecheck` passes | Exit code 0 |
| 3 | `pnpm run dashboard:build` passes | Exit code 0, `dist/` created |
| 4 | `pnpm run dashboard` starts server on port 3001 | `curl http://localhost:3001/health` returns `{"status":"ok"}` |
| 5 | Server logs show "Dashboard running at http://0.0.0.0:3001" | Visual check in terminal |
| 6 | All stub route modules export functions | TypeScript compiles without errors |

---

## 4. Implementation Notes

- **Follow existing patterns** from `services/supervisor` for consistency
- **Use `tsx` for dev** (watch mode), `tsc` for build
- **Workspace dependencies** (`@fyi/database`, `@fyi/analytics`) are valid for services (not workers)
- **Logger:** Use pino with pretty transport for dev (already in `@fyi/utils` pattern)
- **No database connection in scaffold** — that comes in Issue 7.2

---

## 5. Definition of Done

- [ ] All files created as specified
- [ ] `pnpm install` succeeds
- [ ] `pnpm run dashboard:typecheck` passes
- [ ] `pnpm run dashboard:build` passes
- [ ] `pnpm run dashboard` starts and responds to `/health`
- [ ] No TypeScript errors in monorepo (`pnpm run typecheck` at root)

---

## 6. Cross-References

- **Sprint Plan:** [README.md](./README.md)
- **Architecture:** [dashboard-architecture.md](../architecture/dashboard-architecture.md)
- **Stack Proposal:** [dashboard-stack-proposal.md](../planning/dashboard-stack-proposal.md)