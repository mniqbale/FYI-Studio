// Route registration — wires all dashboard route modules into the Fastify app.
import type { FastifyInstance } from 'fastify';
import { overviewRoutes } from './overview.js';
import { jobsRoutes } from './jobs.js';
import { tenantsRoutes } from './tenants.js';
import { analyticsRoutes } from './analytics.js';
import { settingsRoutes } from './settings.js';
import { socialRoutes } from './social.js';
import { youtubeOAuthRoutes } from './youtube-oauth.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await Promise.all([
    overviewRoutes(app),
    jobsRoutes(app),
    tenantsRoutes(app),
    analyticsRoutes(app),
    settingsRoutes(app),
    socialRoutes(app),
    youtubeOAuthRoutes(app),
  ]);
}
