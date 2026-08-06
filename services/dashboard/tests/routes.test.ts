// Unit tests for the Dashboard API routes — read-only JSON endpoints.
// Uses fastify.inject (no network) and mocks the data layer via vi.mock.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerRoutes } from '../src/routes/index.js';

// Mock the data layer so we don't need a live DB.
vi.mock('../src/utils/data.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/data.js')>();
  return {
    ...actual,
    getOverviewData: vi.fn(),
    getJobsList: vi.fn(),
    getJobDetail: vi.fn(),
    getTenantsView: vi.fn(),
    getAnalyticsData: vi.fn(),
  };
});

import * as data from '../src/utils/data.js';

// Mock the settings layer (used by the overview route for the neuron graph).
vi.mock('../src/utils/settings.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/settings.js')>();
  return {
    ...actual,
    getWorkerAssignments: vi.fn().mockResolvedValue([]),
  };
});

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');

describe('Dashboard API Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await registerRoutes(app);
    await app.register(fastifyStatic, { root: publicDir, prefix: '/assets/', decorateReply: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/overview returns overview aggregates', async () => {
    vi.mocked(data.getOverviewData).mockResolvedValue({
      jobsByStatus: { pending: 1, running: 2, waiting_approval: 0, completed: 5, failed: 1 },
      totalCost: 0.002,
      totalTokens: 9000,
      recentJobs: [],
    });
    const res = await app.inject({ method: 'GET', url: '/api/overview' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.jobsByStatus.completed).toBe(5);
    expect(body.totalCost).toBe(0.002);
    expect(body.totalTokens).toBe(9000);
    expect(Array.isArray(body.recentJobs)).toBe(true);
  });

  it('GET / returns overview HTML', async () => {
    vi.mocked(data.getOverviewData).mockResolvedValue({
      jobsByStatus: { pending: 0, running: 0, waiting_approval: 0, completed: 1, failed: 0 },
      totalCost: 0,
      totalTokens: 0,
      recentJobs: [],
    });
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('FYI Studio Dashboard');
  });

  it('GET /api/jobs supports pagination + filters', async () => {
    vi.mocked(data.getJobsList).mockResolvedValue({
      jobs: [{ id: 'job-1', tenantId: 't1', recipeId: 'r1', status: 'completed', currentStepIndex: 5, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      total: 1,
      page: 1,
      limit: 20,
    });
    const res = await app.inject({ method: 'GET', url: '/api/jobs?page=1&limit=20&status=completed' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.jobs).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(data.getJobsList).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', page: 1, limit: 20 }),
    );
  });

  it('GET /api/jobs/:id returns job detail', async () => {
    vi.mocked(data.getJobDetail).mockResolvedValue({
      job: {
        id: 'job-1', tenantId: 't1', recipeId: 'r1', status: 'completed', currentStepIndex: 5,
        recipeSnapshot: { steps: [] }, artifacts: {},
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      },
      telemetry: [],
      mediaUrls: [],
      videoRef: null,
    });
    const res = await app.inject({ method: 'GET', url: '/api/jobs/job-1' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.job.id).toBe('job-1');
    expect(Array.isArray(body.telemetry)).toBe(true);
  });

  it('GET /api/jobs/:id returns 404 for unknown job', async () => {
    vi.mocked(data.getJobDetail).mockRejectedValue(Object.assign(new Error('not found'), { statusCode: 404 }));
    const res = await app.inject({ method: 'GET', url: '/api/jobs/nope' });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/tenants returns tenants with spend vs quota', async () => {
    vi.mocked(data.getTenantsView).mockResolvedValue([
      { tenantId: 't1', brandVoice: 'x', language: 'en', forbiddenTerms: [], enabled: true, costQuota: 10, modelPreferences: null, spendVsQuota: { spent: 2, quota: 10, percentage: 20 } },
    ]);
    const res = await app.inject({ method: 'GET', url: '/api/tenants' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tenants[0].tenantId).toBe('t1');
    expect(body.tenants[0].spendVsQuota.percentage).toBe(20);
  });

  it('GET /api/analytics returns chart data', async () => {
    vi.mocked(data.getAnalyticsData).mockResolvedValue({
      costOverTime: [{ date: '2026-08-06', cost: 0.001, count: 2 }],
      costByWorker: [{ worker: 'script-worker', cost: 0.001, count: 2 }],
      tokensByWorker: [{ worker: 'script-worker', tokensIn: 100, tokensOut: 50, count: 2 }],
    });
    const res = await app.inject({ method: 'GET', url: '/api/analytics' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.costOverTime)).toBe(true);
    expect(Array.isArray(body.tokensByWorker)).toBe(true);
  });

  it('serves static assets from /assets', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets/polling.js' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('startPolling');
  });
});
