---
id: sprint-007-issue-705
title: "Issue 7.5 — E2E Smoke Test + Typecheck/Build Verification"
owner: "Lead Engineer (AI Agent)"
status: "done"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-issue"
tags: [sprint-007, issue-705, e2e, smoke-test, typecheck, build, verification, ci]
related_documents:
  - "README.md"
  - "dashboard-architecture.md"
  - "dashboard-stack-proposal.md"
  - "Issue-701.md"
  - "Issue-702.md"
  - "Issue-703.md"
  - "Issue-704.md"
related_sprint: "Sprint-007"
---

# Issue 7.5 — E2E Smoke Test + Typecheck/Build Verification

> **Sprint:** 7 (Milestone 8: Dashboard UI)  
> **Estimate:** S (1-2 hours)  
> **Dependencies:** Issues 7.1, 7.2, 7.3, 7.4 (all Dashboard components complete)  
> **Blockers:** None

---

## 1. Objective

Perform end-to-end verification that the Dashboard works correctly:
1. Seed a completed job with video artifact in the database
2. Start Dashboard server
3. Verify all 5 pages load and display data correctly
4. Verify video playback in job detail page
5. Run `pnpm run typecheck` and `pnpm run build` for entire monorepo
6. Run unit tests for Dashboard API routes

---

## 2. Deliverables

### 2.1 Test Seed Script: `services/dashboard/scripts/seed-test-job.ts`

```typescript
// services/dashboard/scripts/seed-test-job.ts
import { PrismaClient } from '@fyi/database';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const TENANT_ID = 'test-tenant-dashboard';
const JOB_ID = uuidv4();
const EXECUTION_ID = uuidv4();
const RECIPE_ID = 'video-production-v1';

async function seed() {
  console.log('🌱 Seeding test job for Dashboard E2E...');

  // 1. Create tenant context
  await prisma.tenantContext.upsert({
    where: { tenantId: TENANT_ID },
    update: {},
    create: {
      tenantId: TENANT_ID,
      brandVoice: 'Professional, engaging, and concise. Use active voice. Avoid jargon.',
      language: 'en',
      forbiddenTerms: ['guaranteed', 'miracle', 'secret'],
    },
  });

  // 2. Create tenant policy
  await prisma.tenantPolicy.upsert({
    where: { tenantId: TENANT_ID },
    update: {},
    create: {
      tenantId: TENANT_ID,
      modelPreferences: { 'text-synthesis:script': 'deepseek-v4-flash' },
      costQuota: 10.00,
      enabled: true,
    },
  });

  // 3. Create completed job with full artifacts
  const job = await prisma.job.create({
    data: {
      id: JOB_ID,
      tenantId: TENANT_ID,
      recipeId: RECIPE_ID,
      status: 'completed',
      currentStepIndex: 5,
      recipeSnapshot: {
        name: 'Video Production Pipeline',
        steps: [
          { id: 'research', capability: 'research:web', workerLabel: 'research-worker', requiresApproval: false, inputMapping: {} },
          { id: 'script', capability: 'text-synthesis:script', workerLabel: 'script-worker', requiresApproval: false, inputMapping: { topic: 'steps.research.output.summary' } },
          { id: 'voice', capability: 'voice:tts', workerLabel: 'voice-worker', requiresApproval: false, inputMapping: { script: 'steps.script.output.script' } },
          { id: 'subtitle', capability: 'subtitle:generate', workerLabel: 'subtitle-worker', requiresApproval: false, inputMapping: { audio: 'steps.voice.output.audio_url' } },
          { id: 'video', capability: 'video:compose', workerLabel: 'video-worker', requiresApproval: false, inputMapping: { script: 'steps.script.output.script', audio: 'steps.voice.output.audio_url', subtitles: 'steps.subtitle.output.subtitle_url' } },
        ],
      },
      artifacts: {
        research: { summary: 'AI orchestration platforms enable BYOAI workflows for media production.', sources: ['https://example.com/source1', 'https://example.com/source2'] },
        script: { script: 'Welcome to FYI Studio. An AI operating system for distributed media production. Build once, deploy anywhere.', title: 'FYI Studio Intro', durationSeconds: 30 },
        voice: { audio_url: `file:///tmp/fyi-studio/${EXECUTION_ID}/audio.mp3`, duration_seconds: 30.5 },
        subtitle: { subtitle_url: `file:///tmp/fyi-studio/${EXECUTION_ID}/subtitles.srt`, language: 'en' },
        video: { video_url: `file:///tmp/fyi-studio/${EXECUTION_ID}/video.mp4`, duration_seconds: 31, resolution: '1920x1080' },
      },
      createdAt: new Date(Date.now() - 3600000), // 1 hour ago
      updatedAt: new Date(),
    },
  });

  // 4. Create telemetry entries for each step
  const steps = ['research', 'script', 'voice', 'subtitle', 'video'];
  const workers = ['research-worker', 'script-worker', 'voice-worker', 'subtitle-worker', 'video-worker'];
  const providers = ['ollama', 'ollama', 'espeak-ng', 'whisper', 'ffmpeg'];
  const models = ['deepseek-v4-flash', 'deepseek-v4-flash', 'espeak-ng', 'whisper-base', 'ffmpeg'];
  
  for (let i = 0; i < steps.length; i++) {
    await prisma.telemetry.create({
      data: {
        jobId: JOB_ID,
        executionId: uuidv4(),
        workerId: workers[i],
        workerVersion: '1.0.0',
        provider: providers[i],
        model: models[i],
        tokensIn: i < 2 ? 1500 : null,
        tokensOut: i < 2 ? 800 : null,
        seconds: i === 2 ? 30.5 : i === 4 ? 31 : null,
        cost: i < 2 ? 0.0001 : 0,
        durationMs: [2500, 3200, 30500, 1200, 31000][i],
        startedAt: new Date(Date.now() - 3600000 + i * 60000),
        finishedAt: new Date(Date.now() - 3600000 + (i + 1) * 60000),
      },
    });
  }

  // 5. Create mock media files in /tmp/fyi-studio
  const fs = await import('node:fs/promises');
  const mediaDir = `/tmp/fyi-studio/${EXECUTION_ID}`;
  await fs.mkdir(mediaDir, { recursive: true });
  
  // Create dummy video file (small MP4 - 1 second of black)
  // Using a minimal valid MP4 header
  const mp4Header = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x02, 0x00,
    0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32, 0x61, 0x76, 0x63, 0x31, 0x6D, 0x70, 0x34, 0x31,
    0x00, 0x00, 0x00, 0x08, 0x66, 0x72, 0x65, 0x65, 0x6D, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);
  await fs.writeFile(path.join(mediaDir, 'video.mp4'), mp4Header);
  
  // Create dummy audio file (minimal MP3)
  const mp3Header = Buffer.from([0xFF, 0xFB, 0x90, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  await fs.writeFile(path.join(mediaDir, 'audio.mp3'), mp3Header);
  
  // Create dummy subtitle file
  const srtContent = `1
00:00:00,000 --> 00:00:05,000
Welcome to FYI Studio.

2
00:00:05,000 --> 00:00:10,000
An AI operating system for distributed media production.

3
00:00:10,000 --> 00:00:15,000
Build once, deploy anywhere.`;
  await fs.writeFile(path.join(mediaDir, 'subtitles.srt'), srtContent);

  console.log('✅ Test job seeded successfully!');
  console.log(`   Job ID: ${JOB_ID}`);
  console.log(`   Tenant: ${TENANT_ID}`);
  console.log(`   Execution ID: ${EXECUTION_ID}`);
  console.log(`   Media dir: ${mediaDir}`);
  console.log(`   Dashboard URL: http://localhost:3001/jobs/${JOB_ID}`);

  await prisma.$disconnect();
}

import path from 'node:path';
seed().catch(console.error);
```

### 2.2 E2E Test Script: `tests/e2e/dashboard.test.ts`

```typescript
// tests/e2e/dashboard.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'node:child_process';
import fetch from 'node-fetch';

const DASHBOARD_URL = 'http://localhost:3001';
let dashboardProcess: ChildProcess;

describe('Dashboard E2E Smoke Tests', () => {
  beforeAll(async () => {
    // Start dashboard server
    dashboardProcess = spawn('pnpm', ['run', 'dashboard'], {
      cwd: '/workspaces/FYI-Studio',
      stdio: 'pipe',
      env: { ...process.env, PORT: '3001' },
    });

    // Wait for server to be ready
    await waitForServer(DASHBOARD_URL + '/health', 30000);
  }, 60000);

  afterAll(() => {
    if (dashboardProcess) {
      dashboardProcess.kill('SIGTERM');
    }
  });

  it('GET /health returns ok', async () => {
    const res = await fetch(`${DASHBOARD_URL}/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('dashboard');
  });

  it('GET / returns overview HTML', async () => {
    const res = await fetch(`${DASHBOARD_URL}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('FYI Studio Dashboard');
    expect(html).toContain('Recent Jobs');
    expect(html).toContain('text/html');
  });

  it('GET /api/overview returns JSON aggregates', async () => {
    const res = await fetch(`${DASHBOARD_URL}/api/overview`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('jobsByStatus');
    expect(data).toHaveProperty('totalCost');
    expect(data).toHaveProperty('totalTokens');
    expect(data).toHaveProperty('recentJobs');
    expect(Array.isArray(data.recentJobs)).toBe(true);
  });

  it('GET /jobs returns jobs list HTML', async () => {
    const res = await fetch(`${DASHBOARD_URL}/jobs`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Jobs');
    expect(html).toContain('jobs-table');
  });

  it('GET /api/jobs returns paginated jobs', async () => {
    const res = await fetch(`${DASHBOARD_URL}/api/jobs?page=1&limit=10`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('jobs');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('page', 1);
    expect(data).toHaveProperty('limit', 10);
    expect(Array.isArray(data.jobs)).toBe(true);
  });

  it('GET /jobs/:id returns job detail HTML with video', async () => {
    // First get a job ID from the list
    const listRes = await fetch(`${DASHBOARD_URL}/api/jobs?limit=1`);
    const listData = await listRes.json();
    expect(listData.jobs.length).toBeGreaterThan(0);
    
    const jobId = listData.jobs[0].id;
    const res = await fetch(`${DASHBOARD_URL}/jobs/${jobId}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Pipeline Timeline');
    expect(html).toContain('Artifacts');
    expect(html).toContain('video-player');
    expect(html).toContain('/media/');
  });

  it('GET /api/jobs/:id returns job detail JSON', async () => {
    const listRes = await fetch(`${DASHBOARD_URL}/api/jobs?limit=1`);
    const listData = await listRes.json();
    const jobId = listData.jobs[0].id;
    
    const res = await fetch(`${DASHBOARD_URL}/api/jobs/${jobId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('job');
    expect(data).toHaveProperty('telemetry');
    expect(data).toHaveProperty('videoRef');
    expect(data.videoRef).toMatch(/\/media\/.*\/video\.mp4/);
    expect(Array.isArray(data.telemetry)).toBe(true);
    expect(data.telemetry.length).toBeGreaterThan(0);
  });

  it('GET /tenants returns tenants HTML', async () => {
    const res = await fetch(`${DASHBOARD_URL}/tenants`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Tenants');
    expect(html).toContain('tenant-card');
  });

  it('GET /api/tenants returns tenants with policy + spend', async () => {
    const res = await fetch(`${DASHBOARD_URL}/api/tenants`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('tenants');
    expect(Array.isArray(data.tenants)).toBe(true);
    if (data.tenants.length > 0) {
      const tenant = data.tenants[0];
      expect(tenant).toHaveProperty('tenantId');
      expect(tenant).toHaveProperty('brandVoice');
      expect(tenant).toHaveProperty('spendVsQuota');
      expect(tenant.spendVsQuota).toHaveProperty('spent');
      expect(tenant.spendVsQuota).toHaveProperty('quota');
      expect(tenant.spendVsQuota).toHaveProperty('percentage');
    }
  });

  it('GET /analytics returns analytics HTML with charts', async () => {
    const res = await fetch(`${DASHBOARD_URL}/analytics`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Analytics');
    expect(html).toContain('cost-over-time');
    expect(html).toContain('cost-by-capability');
    expect(html).toContain('tokens-by-worker');
    expect(html).toContain('chart.js');
  });

  it('GET /api/analytics returns chart data', async () => {
    const res = await fetch(`${DASHBOARD_URL}/api/analytics`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('costOverTime');
    expect(data).toHaveProperty('costByCapability');
    expect(data).toHaveProperty('tokensByWorker');
    expect(Array.isArray(data.costOverTime)).toBe(true);
    expect(Array.isArray(data.costByCapability)).toBe(true);
    expect(Array.isArray(data.tokensByWorker)).toBe(true);
  });

  it('GET /media/:executionId/video.mp4 serves video with Range support', async () => {
    const listRes = await fetch(`${DASHBOARD_URL}/api/jobs?limit=1`);
    const listData = await listRes.json();
    const jobId = listData.jobs[0].id;
    
    const detailRes = await fetch(`${DASHBOARD_URL}/api/jobs/${jobId}`);
    const detailData = await detailRes.json();
    const videoRef = detailData.videoRef;
    
    expect(videoRef).toBeTruthy();
    
    // Test HEAD request
    const headRes = await fetch(`${DASHBOARD_URL}${videoRef}`, { method: 'HEAD' });
    expect(headRes.status).toBe(200);
    expect(headRes.headers.get('accept-ranges')).toBe('bytes');
    expect(headRes.headers.get('content-type')).toMatch(/video\/mp4/);
    
    // Test Range request
    const rangeRes = await fetch(`${DASHBOARD_URL}${videoRef}`, {
      headers: { Range: 'bytes=0-1023' },
    });
    expect(rangeRes.status).toBe(206); // Partial Content
    expect(rangeRes.headers.get('content-range')).toMatch(/bytes 0-1023\/\d+/);
  });
});

async function waitForServer(url: string, timeout: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Server did not start within ${timeout}ms`);
}
```

### 2.3 Unit Tests for API Routes: `services/dashboard/tests/routes.test.ts`

```typescript
// services/dashboard/tests/routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { registerRoutes } from '../src/routes/index.js';
import { mediaRoutes } from '../src/routes/media.js';
import { prisma } from '../src/utils/prisma.js';

// Mock Prisma
vi.mock('@fyi/database', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    job: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    telemetry: {
      findMany: vi.fn(),
    },
    tenantContext: {
      findMany: vi.fn(),
    },
    tenantPolicy: {
      findMany: vi.fn(),
    },
    $disconnect: vi.fn(),
  })),
}));

// Mock analytics
vi.mock('@fyi/analytics', () => ({
  analytics: {
    getTotals: vi.fn(),
    getSpendByTenant: vi.fn(),
    getCostOverTime: vi.fn(),
    getCostByCapability: vi.fn(),
    getTokensByWorker: vi.fn(),
  },
}));

describe('Dashboard API Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await registerRoutes(app);
    await mediaRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/overview', () => {
    it('returns overview data', async () => {
      const { analytics } = await import('@fyi/analytics');
      (analytics.getTotals as any).mockResolvedValue({ totalCost: 0.001, totalTokens: 5000 });
      
      const { prisma } = await import('../src/utils/prisma.js');
      (prisma.job.groupBy as any).mockResolvedValue([
        { status: 'completed', _count: 5 },
        { status: 'running', _count: 2 },
      ]);
      (prisma.job.findMany as any).mockResolvedValue([]);

      const res = await app.inject({ method: 'GET', url: '/api/overview' });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data).toHaveProperty('jobsByStatus');
      expect(data).toHaveProperty('totalCost');
      expect(data).toHaveProperty('totalTokens');
    });
  });

  describe('GET /api/jobs', () => {
    it('returns paginated jobs', async () => {
      const { prisma } = await import('../src/utils/prisma.js');
      (prisma.job.findMany as any).mockResolvedValue([
        { id: '1', tenantId: 't1', recipeId: 'r1', status: 'completed', currentStepIndex: 5, createdAt: new Date(), updatedAt: new Date() },
      ]);
      (prisma.job.count as any).mockResolvedValue(1);

      const res = await app.inject({ method: 'GET', url: '/api/jobs?page=1&limit=10' });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data.jobs).toHaveLength(1);
      expect(data.total).toBe(1);
      expect(data.page).toBe(1);
    });
  });

  describe('GET /api/jobs/:id', () => {
    it('returns job detail with telemetry', async () => {
      const { prisma } = await import('../src/utils/prisma.js');
      (prisma.job.findUniqueOrThrow as any).mockResolvedValue({
        id: 'job-1',
        tenantId: 't1',
        recipeId: 'r1',
        status: 'completed',
        currentStepIndex: 5,
        recipeSnapshot: { steps: [] },
        artifacts: { video_url: 'file:///tmp/fyi-studio/exec-1/video.mp4' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.telemetry.findMany as any).mockResolvedValue([
        { workerId: 'script-worker', status: 'success', durationMs: 1000, cost: 0.001, tokensIn: 100, tokensOut: 50, provider: 'ollama', model: 'deepseek-v4-flash', executionId: 'exec-1', startedAt: new Date(), finishedAt: new Date(), createdAt: new Date() },
      ]);

      const res = await app.inject({ method: 'GET', url: '/api/jobs/job-1' });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data).toHaveProperty('job');
      expect(data).toHaveProperty('telemetry');
      expect(data).toHaveProperty('videoRef');
      expect(data.videoRef).toBe('/media/exec-1/video.mp4');
    });
  });
});
```

### 2.4 Run Commands

```bash
# 1. Seed test job
pnpm tsx services/dashboard/scripts/seed-test-job.ts

# 2. Start dashboard (in background)
pnpm run dashboard &

# 3. Run E2E tests
pnpm test tests/e2e/dashboard.test.ts

# 4. Run unit tests
pnpm test services/dashboard/tests/routes.test.ts

# 5. Run typecheck for entire monorepo
pnpm run typecheck

# 6. Run build for entire monorepo
pnpm run build
```

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Seed script creates test job + telemetry + media files | Check database + `/tmp/fyi-studio/` |
| 2 | Dashboard server starts on port 3001 | `curl localhost:3001/health` |
| 3 | All 5 HTML pages load without errors | Browser: `/`, `/jobs`, `/jobs/:id`, `/tenants`, `/analytics` |
| 4 | Job detail page shows pipeline timeline + video plays | Browser: video element plays |
| 5 | All API endpoints return correct JSON | E2E tests pass |
| 6 | Media serving works with Range requests | E2E test: 206 Partial Content |
| 7 | `pnpm run typecheck` passes (monorepo) | Exit code 0 |
| 8 | `pnpm run build` passes (monorepo) | Exit code 0 |
| 9 | Unit tests for routes pass (≥80% coverage) | `pnpm test` |
| 10 | No database writes from Dashboard | Code review + DB trigger test |

---

## 4. Definition of Done

- [ ] Seed script works and creates valid test data
- [ ] Dashboard server starts and serves all pages
- [ ] Video plays in browser on job detail page
- [ ] All E2E tests pass
- [ ] All unit tests pass
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run build` passes
- [ ] Dashboard is fully functional for Founder visual review

---

## 5. Cross-References

- **Sprint Plan:** [README.md](./README.md)
- **Architecture:** [dashboard-architecture.md](../architecture/dashboard-architecture.md)
- **Previous Issues:** [Issue-701.md](./Issue-701.md) through [Issue-704.md](./Issue-704.md)