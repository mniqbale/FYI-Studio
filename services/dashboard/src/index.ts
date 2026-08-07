// Dashboard entrypoint — Fastify server (read-only view over the Job Ledger).
// Runs locally: pnpm run dashboard (port 3001). See dashboard-architecture.md.
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyFormBody from '@fastify/formbody';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './utils/env.js';

loadEnv();

import { registerRoutes } from './routes/index.js';
import { mediaRoutes } from './routes/media.js';
import { authRoutes } from './routes/auth.js';
import { authPreHandler, isAuthEnabled } from './utils/auth.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  // Parse application/x-www-form-urlencoded POST bodies (for Settings forms).
  await app.register(fastifyFormBody);

  // Opt-in HTTP auth gate. When DASHBOARD_AUTH_TOKEN is set, every route except
  // /health, /assets/*, and the login page requires a valid token (query/header)
  // or a signed session cookie. When unset, this is a no-op (dev/tests unaffected).
  app.addHook('preHandler', authPreHandler);
  if (isAuthEnabled()) {
    app.log.info('Dashboard auth: enabled (DASHBOARD_AUTH_TOKEN is set)');
  } else {
    app.log.info('Dashboard auth: disabled (DASHBOARD_AUTH_TOKEN is not set)');
  }

  await authRoutes(app);
  await registerRoutes(app);
  await mediaRoutes(app);

  // Serve static assets (client JS, CSS) from public/assets/.
  const assetsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');
  await app.register(fastifyStatic, {
    root: assetsDir,
    prefix: '/assets/',
    decorateReply: false,
  });

  app.get('/health', async () => ({ status: 'ok', service: 'dashboard' }));

  return app;
}

async function start(): Promise<void> {
  const app = await buildApp();
  const port = Number(process.env.PORT) || 3001;
  const host = process.env.HOST ?? '0.0.0.0';
  try {
    await app.listen({ port, host });
    app.log.info(`Dashboard running at http://${host}:${port}`);
    app.log.info(`Media root: ${process.env.FYI_MEDIA_ROOT ?? '/tmp/fyi-studio'}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

if (process.env.NODE_ENV !== 'test') {
  start();
}

export { start };
