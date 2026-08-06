---
id: sprint-007-issue-702
title: "Issue 7.2 — Read-Only API Endpoints"
owner: "Lead Engineer (AI Agent)"
status: "done"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-issue"
tags: [sprint-007, issue-702, api, endpoints, prisma, analytics, read-only]
related_documents:
  - "README.md"
  - "dashboard-architecture.md"
  - "dashboard-stack-proposal.md"
  - "Issue-701.md"
related_sprint: "Sprint-007"
---

# Issue 7.2 — Read-Only API Endpoints

> **Sprint:** 7 (Milestone 8: Dashboard UI)  
> **Estimate:** M (3-5 hours)  
> **Dependencies:** Issue 7.1 (Scaffold)  
> **Blockers:** None

---

## 1. Objective

Implement all read-only JSON API endpoints for the Dashboard:
- `GET /api/overview` — Dashboard overview aggregates
- `GET /api/jobs` — Paginated, filterable job list
- `GET /api/jobs/:id` — Job detail with telemetry and artifacts
- `GET /api/tenants` — Tenants with policy + spend vs quota
- `GET /api/analytics` — Chart data (cost over time, by capability, tokens by worker)

All endpoints use `@fyi/database` (Prisma) and `@fyi/analytics` — **no writes to Job Ledger**.

---

## 2. Deliverables

### 2.1 `services/dashboard/src/utils/prisma.ts`

```typescript
// services/dashboard/src/utils/prisma.ts
import { PrismaClient } from '@fyi/database';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### 2.2 `services/dashboard/src/utils/analytics.ts`

```typescript
// services/dashboard/src/utils/analytics.ts
import { analytics } from '@fyi/analytics';
import { prisma } from './prisma.js';

export async function getOverviewData(tenantId?: string) {
  const where = tenantId ? { tenantId } : {};
  
  const [jobsByStatus, totals, recentJobs] = await Promise.all([
    prisma.job.groupBy({
      by: ['status'],
      where,
      _count: true,
    }),
    analytics.getTotals(tenantId),
    prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { 
        id: true, tenantId: true, recipeId: true, status: true, 
        createdAt: true, updatedAt: true, currentStepIndex: true, 
        recipeSnapshot: true 
      },
    }),
  ]);

  const statusCounts = jobsByStatus.reduce((acc, item) => {
    acc[item.status] = item._count;
    return acc;
  }, {} as Record<string, number>);

  return {
    jobsByStatus: {
      pending: statusCounts.pending ?? 0,
      running: statusCounts.running ?? 0,
      waiting_approval: statusCounts.waiting_approval ?? 0,
      completed: statusCounts.completed ?? 0,
      failed: statusCounts.failed ?? 0,
    },
    totalCost: totals.totalCost ?? 0,
    totalTokens: totals.totalTokens ?? 0,
    recentJobs: recentJobs.map(job => ({
      id: job.id,
      tenantId: job.tenantId,
      recipeId: job.recipeId,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      currentStepIndex: job.currentStepIndex,
      totalSteps: job.recipeSnapshot?.steps?.length ?? 0,
    })),
  };
}

export async function getJobsList(params: {
  page: number;
  limit: number;
  status?: string;
  tenantId?: string;
}) {
  const { page, limit, status, tenantId } = params;
  const where: any = {};
  if (status) where.status = status;
  if (tenantId) where.tenantId = tenantId;

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: { 
        id: true, tenantId: true, recipeId: true, status: true, 
        currentStepIndex: true, createdAt: true, updatedAt: true 
      },
    }),
    prisma.job.count({ where }),
  ]);

  return {
    jobs: jobs.map(job => ({
      id: job.id,
      tenantId: job.tenantId,
      recipeId: job.recipeId,
      status: job.status,
      currentStepIndex: job.currentStepIndex,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    })),
    total,
    page,
    limit,
  };
}

export async function getJobDetail(jobId: string) {
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  
  const telemetry = await prisma.telemetry.findMany({
    where: { jobId },
    orderBy: { startedAt: 'asc' },
  });

  const videoRef = job.artifacts?.video_url
    ? `/media/${extractExecutionId(job.artifacts.video_url)}/video.mp4`
    : null;

  return {
    job: {
      ...job,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    },
    telemetry: telemetry.map(t => ({
      ...t,
      startedAt: t.startedAt.toISOString(),
      finishedAt: t.finishedAt.toISOString(),
      createdAt: t.createdAt.toISOString(),
    })),
    videoRef,
  };
}

export async function getTenantsView() {
  const [contexts, policies, spend] = await Promise.all([
    prisma.tenantContext.findMany(),
    prisma.tenantPolicy.findMany(),
    analytics.getSpendByTenant(),
  ]);

  return contexts.map(ctx => {
    const policy = policies.find(p => p.tenantId === ctx.tenantId) ?? null;
    const spent = spend[ctx.tenantId] ?? 0;
    const quota = policy?.costQuota ?? 0;
    return {
      tenantId: ctx.tenantId,
      brandVoice: ctx.brandVoice,
      language: ctx.language,
      forbiddenTerms: ctx.forbiddenTerms,
      policy,
      spendVsQuota: {
        spent,
        quota,
        percentage: quota > 0 ? (spent / quota) * 100 : 0,
      },
    };
  });
}

export async function getAnalyticsData(params: { tenantId?: string; from?: string; to?: string } = {}) {
  const { tenantId, from, to } = params;
  
  // Use @fyi/analytics for aggregations
  const [costOverTime, costByCapability, tokensByWorker] = await Promise.all([
    analytics.getCostOverTime({ tenantId, from, to }),
    analytics.getCostByCapability({ tenantId, from, to }),
    analytics.getTokensByWorker({ tenantId, from, to }),
  ]);

  return {
    costOverTime: costOverTime.map(d => ({ date: d.date, cost: d.cost })),
    costByCapability: costByCapability.map(d => ({ capability: d.capability, cost: d.cost, count: d.count })),
    tokensByWorker: tokensByWorker.map(d => ({ workerId: d.workerId, tokensIn: d.tokensIn, tokensOut: d.tokensOut, count: d.count })),
  };
}

function extractExecutionId(url: string): string {
  // file:///tmp/fyi-studio/abc-123-def/video.mp4 → abc-123-def
  const match = url.match(/\/fyi-studio\/([^/]+)\//);
  return match?.[1] ?? 'unknown';
}
```

### 2.3 `services/dashboard/src/routes/overview.ts`

```typescript
// services/dashboard/src/routes/overview.ts
import { FastifyInstance } from 'fastify';
import { getOverviewData } from '../utils/analytics.js';

export async function overviewRoutes(app: FastifyInstance) {
  // JSON API
  app.get('/api/overview', async (request) => {
    const tenantId = request.query.tenant_id as string | undefined;
    return getOverviewData(tenantId);
  });

  // HTML Page
  app.get('/', async (request, reply) => {
    const tenantId = request.query.tenant_id as string | undefined;
    const data = await getOverviewData(tenantId);
    const html = renderOverviewPage(data);
    return reply.type('text/html').send(html);
  });
}

function renderOverviewPage(data: Awaited<ReturnType<typeof getOverviewData>>): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FYI Studio Dashboard</title>
  <link rel="stylesheet" href="/assets/style.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
</head>
<body>
  ${renderLayout(`
    <header class="dashboard-header">
      <h1>FYI Studio Dashboard</h1>
      <nav><a href="/jobs">Jobs</a> | <a href="/tenants">Tenants</a> | <a href="/analytics">Analytics</a></nav>
    </header>
    <main class="dashboard-main">
      <section class="stats-grid">
        <div class="stat-card"><span class="stat-value">${data.jobsByStatus.pending}</span> Pending</div>
        <div class="stat-card"><span class="stat-value">${data.jobsByStatus.running}</span> Running</div>
        <div class="stat-card"><span class="stat-value">${data.jobsByStatus.waiting_approval}</span> Awaiting Approval</div>
        <div class="stat-card"><span class="stat-value">${data.jobsByStatus.completed}</span> Completed</div>
        <div class="stat-card"><span class="stat-value">${data.jobsByStatus.failed}</span> Failed</div>
        <div class="stat-card"><span class="stat-value">$${data.totalCost.toFixed(4)}</span> Total Cost</div>
        <div class="stat-card"><span class="stat-value">${data.totalTokens.toLocaleString()}</span> Total Tokens</div>
      </section>
      <section class="recent-jobs">
        <h2>Recent Jobs</h2>
        <table class="jobs-table">
          <thead><tr><th>ID</th><th>Tenant</th><th>Recipe</th><th>Status</th><th>Progress</th><th>Created</th></tr></thead>
          <tbody>
            ${data.recentJobs.map(job => `
              <tr>
                <td><a href="/jobs/${job.id}">${job.id.slice(0,8)}...</a></td>
                <td>${job.tenantId}</td>
                <td>${job.recipeId}</td>
                <td><span class="status-badge status-${job.status}">${job.status}</span></td>
                <td>${job.currentStepIndex}/${job.totalSteps}</td>
                <td>${new Date(job.createdAt).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
    </main>
  `)}`
  <script type="module" src="/assets/overview.js"></script>
</body></html>`;
}

function renderLayout(content: string): string {
  return content; // Simplified - layout is inline above
}
```

### 2.4 `services/dashboard/src/routes/jobs.ts`

```typescript
// services/dashboard/src/routes/jobs.ts
import { FastifyInstance } from 'fastify';
import { getJobsList, getJobDetail } from '../utils/analytics.js';

export async function jobsRoutes(app: FastifyInstance) {
  // JSON API: List
  app.get('/api/jobs', async (request) => {
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 20));
    const status = request.query.status as string | undefined;
    const tenantId = request.query.tenant_id as string | undefined;
    return getJobsList({ page, limit, status, tenantId });
  });

  // JSON API: Detail
  app.get('/api/jobs/:id', async (request) => {
    return getJobDetail(request.params.id as string);
  });

  // HTML Page: List
  app.get('/jobs', async (request, reply) => {
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 20));
    const status = request.query.status as string | undefined;
    const tenantId = request.query.tenant_id as string | undefined;
    const data = await getJobsList({ page, limit, status, tenantId });
    const html = renderJobListPage(data, { page, limit, status, tenantId });
    return reply.type('text/html').send(html);
  });

  // HTML Page: Detail
  app.get('/jobs/:id', async (request, reply) => {
    const data = await getJobDetail(request.params.id as string);
    const html = renderJobDetailPage(data);
    return reply.type('text/html').send(html);
  });
}

function renderJobListPage(data: Awaited<ReturnType<typeof getJobsList>>, params: any): string {
  const totalPages = Math.ceil(data.total / params.limit);
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Jobs - FYI Dashboard</title>
<link rel="stylesheet" href="/assets/style.css">
</head><body>
  ${renderLayout(`
    <header class="dashboard-header"><h1>Jobs</h1><nav><a href="/">Overview</a> | <a href="/tenants">Tenants</a> | <a href="/analytics">Analytics</a></nav></header>
    <main class="dashboard-main">
      <section class="filters">
        <form method="get">
          <select name="status"><option value="">All Status</option>
            <option value="pending" ${params.status==='pending'?'selected':''}>Pending</option>
            <option value="running" ${params.status==='running'?'selected':''}>Running</option>
            <option value="waiting_approval" ${params.status==='waiting_approval'?'selected':''}>Awaiting Approval</option>
            <option value="completed" ${params.status==='completed'?'selected':''}>Completed</option>
            <option value="failed" ${params.status==='failed'?'selected':''}>Failed</option>
          </select>
          <input type="text" name="tenant_id" placeholder="Tenant ID" value="${params.tenantId||''}">
          <button type="submit">Filter</button>
          <a href="/jobs">Clear</a>
        </form>
      </section>
      <section class="jobs-table-container">
        <table class="jobs-table">
          <thead><tr><th>ID</th><th>Tenant</th><th>Recipe</th><th>Status</th><th>Progress</th><th>Created</th><th>Updated</th></tr></thead>
          <tbody>
            ${data.jobs.map(job => `
              <tr>
                <td><a href="/jobs/${job.id}">${job.id.slice(0,8)}...</a></td>
                <td>${job.tenantId}</td>
                <td>${job.recipeId}</td>
                <td><span class="status-badge status-${job.status}">${job.status}</span></td>
                <td>${job.currentStepIndex}/${'?'}</td>
                <td>${new Date(job.createdAt).toLocaleString()}</td>
                <td>${new Date(job.updatedAt).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
      <section class="pagination">
        ${params.page > 1 ? `<a href="?page=${params.page-1}&limit=${params.limit}&status=${params.status||''}&tenant_id=${params.tenantId||''}">← Prev</a>` : ''}
        <span>Page ${params.page} of ${totalPages} (${data.total} total)</span>
        ${params.page < totalPages ? `<a href="?page=${params.page+1}&limit=${params.limit}&status=${params.status||''}&tenant_id=${params.tenantId||''}">Next →</a>` : ''}
      </section>
    </main>
  `)}
  <script type="module" src="/assets/job-list.js"></script>
</body></html>`;
}

function renderJobDetailPage(data: Awaited<ReturnType<typeof getJobDetail>>): string {
  const { job, telemetry, videoRef } = data;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Job ${job.id.slice(0,8)} - FYI Dashboard</title>
<link rel="stylesheet" href="/assets/style.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
</head><body>
  ${renderLayout(`
    <header class="dashboard-header"><h1>Job Detail</h1><nav><a href="/">Overview</a> | <a href="/jobs">Jobs</a> | <a href="/tenants">Tenants</a> | <a href="/analytics">Analytics</a></nav></header>
    <main class="dashboard-main">
      <section class="job-header">
        <h2>${job.id}</h2>
        <div class="job-meta">
          <span><strong>Tenant:</strong> ${job.tenantId}</span>
          <span><strong>Recipe:</strong> ${job.recipeId}</span>
          <span><strong>Status:</strong> <span class="status-badge status-${job.status}">${job.status}</span></span>
          <span><strong>Step:</strong> ${job.currentStepIndex}/${job.recipeSnapshot?.steps?.length ?? '?'}</span>
          <span><strong>Created:</strong> ${new Date(job.createdAt).toLocaleString()}</span>
          <span><strong>Updated:</strong> ${new Date(job.updatedAt).toLocaleString()}</span>
        </div>
      </section>
      <section class="pipeline-timeline">
        <h3>Pipeline Timeline</h3>
        <div id="timeline" class="timeline">
          ${telemetry.map((t, i) => `
            <div class="timeline-step ${i < job.currentStepIndex ? 'completed' : i === job.currentStepIndex ? 'current' : 'pending'}" data-worker="${t.workerId}">
              <div class="step-info">
                <span class="step-name">${t.workerId}</span>
                <span class="step-status">${t.status === 'success' ? '✓' : t.status === 'failure' ? '✗' : '⟳'}</span>
              </div>
              <div class="step-metrics">
                <span>${t.durationMs}ms</span>
                <span>$${t.cost.toFixed(6)}</span>
                <span>${t.tokensIn ?? 0}/${t.tokensOut ?? 0} tokens</span>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
      <section class="artifacts">
        <h3>Artifacts</h3>
        <div class="artifacts-grid">
          ${job.artifacts ? Object.entries(job.artifacts).map(([key, value]) => `
            <div class="artifact-card">
              <h4>${key}</h4>
              <pre>${JSON.stringify(value, null, 2)}</pre>
              ${key === 'video_url' && videoRef ? `
                <video id="video-player" controls style="width:100%;max-width:640px;" src="${videoRef}"></video>
              ` : ''}
            </div>
          `).join('') : '<p>No artifacts yet</p>'}
        </div>
      </section>
      <section class="telemetry">
        <h3>Telemetry</h3>
        <table class="telemetry-table">
          <thead><tr><th>Worker</th><th>Provider</th><th>Model</th><th>Tokens In</th><th>Tokens Out</th><th>Cost</th><th>Duration</th></tr></thead>
          <tbody>
            ${telemetry.map(t => `
              <tr><td>${t.workerId}</td><td>${t.provider ?? '-'}</td><td>${t.model ?? '-'}</td><td>${t.tokensIn ?? '-'}</td><td>${t.tokensOut ?? '-'}</td><td>$${t.cost.toFixed(6)}</td><td>${t.durationMs}ms</td></tr>
            `).join('')}
          </tbody>
        </table>
      </section>
    </main>
  `)}
  <script type="module" src="/assets/job-detail.js"></script>
</body></html>`;
}

function renderLayout(content: string): string {
  return content;
}
```

### 2.5 `services/dashboard/src/routes/tenants.ts`

```typescript
// services/dashboard/src/routes/tenants.ts
import { FastifyInstance } from 'fastify';
import { getTenantsView } from '../utils/analytics.js';

export async function tenantsRoutes(app: FastifyInstance) {
  app.get('/api/tenants', async () => {
    return { tenants: await getTenantsView() };
  });

  app.get('/tenants', async (request, reply) => {
    const tenants = await getTenantsView();
    const html = renderTenantsPage(tenants);
    return reply.type('text/html').send(html);
  });
}

function renderTenantsPage(tenants: Awaited<ReturnType<typeof getTenantsView>>): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Tenants - FYI Dashboard</title>
<link rel="stylesheet" href="/assets/style.css">
</head><body>
  ${renderLayout(`
    <header class="dashboard-header"><h1>Tenants</h1><nav><a href="/">Overview</a> | <a href="/jobs">Jobs</a> | <a href="/analytics">Analytics</a></nav></header>
    <main class="dashboard-main">
      <section class="tenants-grid">
        ${tenants.map(t => `
          <div class="tenant-card">
            <h3>${t.tenantId}</h3>
            <div class="tenant-meta">
              <p><strong>Brand Voice:</strong> ${t.brandVoice.slice(0,100)}...</p>
              <p><strong>Language:</strong> ${t.language}</p>
              <p><strong>Forbidden Terms:</strong> ${t.forbiddenTerms.join(', ') || 'None'}</p>
            </div>
            <div class="tenant-policy">
              ${t.policy ? `
                <p><strong>Model Preferences:</strong> ${JSON.stringify(t.policy.modelPreferences)}</p>
                <p><strong>Cost Quota:</strong> $${t.policy.costQuota.toFixed(2)}</p>
                <p><strong>Enabled:</strong> ${t.policy.enabled ? 'Yes' : 'No'}</p>
              ` : '<p><em>No policy configured</em></p>'}
            </div>
            <div class="tenant-spend">
              <strong>Spend vs Quota:</strong> $${t.spendVsQuota.spent.toFixed(4)} / $${t.spendVsQuota.quota.toFixed(2)} 
              (${t.spendVsQuota.percentage.toFixed(1)}%)
              <div class="quota-bar"><div class="quota-fill" style="width:${Math.min(100, t.spendVsQuota.percentage)}%"></div></div>
            </div>
          </div>
        `).join('')}
      </section>
    </main>
  `)}
</body></html>`;
}

function renderLayout(content: string): string {
  return content;
}
```

### 2.6 `services/dashboard/src/routes/analytics.ts`

```typescript
// services/dashboard/src/routes/analytics.ts
import { FastifyInstance } from 'fastify';
import { getAnalyticsData } from '../utils/analytics.js';

export async function analyticsRoutes(app: FastifyInstance) {
  app.get('/api/analytics', async (request) => {
    const tenantId = request.query.tenant_id as string | undefined;
    const from = request.query.from as string | undefined;
    const to = request.query.to as string | undefined;
    return getAnalyticsData({ tenantId, from, to });
  });

  app.get('/analytics', async (request, reply) => {
    const tenantId = request.query.tenant_id as string | undefined;
    const from = request.query.from as string | undefined;
    const to = request.query.to as string | undefined;
    const data = await getAnalyticsData({ tenantId, from, to });
    const html = renderAnalyticsPage(data, { tenantId, from, to });
    return reply.type('text/html').send(html);
  });
}

function renderAnalyticsPage(data: Awaited<ReturnType<typeof getAnalyticsData>>, params: any): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Analytics - FYI Dashboard</title>
<link rel="stylesheet" href="/assets/style.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
</head><body>
  ${renderLayout(`
    <header class="dashboard-header"><h1>Analytics</h1><nav><a href="/">Overview</a> | <a href="/jobs">Jobs</a> | <a href="/tenants">Tenants</a></nav></header>
    <main class="dashboard-main">
      <section class="filters">
        <form method="get">
          <input type="text" name="tenant_id" placeholder="Tenant ID (optional)" value="${params.tenantId||''}">
          <input type="date" name="from" value="${params.from||''}">
          <input type="date" name="to" value="${params.to||''}">
          <button type="submit">Filter</button>
        </form>
      </section>
      <section class="charts-grid">
        <div class="chart-container"><h3>Cost Over Time</h3><canvas id="cost-over-time"></canvas></div>
        <div class="chart-container"><h3>Cost by Capability</h3><canvas id="cost-by-capability"></canvas></div>
        <div class="chart-container"><h3>Tokens by Worker</h3><canvas id="tokens-by-worker"></canvas></div>
      </section>
    </main>
  `)}
  <script type="module" src="/assets/analytics.js"></script>
</body></html>`;
}

function renderLayout(content: string): string {
  return content;
}
```

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `GET /api/overview` returns correct aggregates | `curl localhost:3001/api/overview` → JSON with jobsByStatus, totalCost, totalTokens, recentJobs |
| 2 | `GET /api/jobs` supports pagination + filters | `curl "localhost:3001/api/jobs?page=1&limit=5&status=completed"` |
| 3 | `GET /api/jobs/:id` returns job + telemetry + videoRef | `curl localhost:3001/api/jobs/<id>` → JSON with job, telemetry[], videoRef |
| 4 | `GET /api/tenants` returns tenants with policy + spend | `curl localhost:3001/api/tenants` → JSON with tenants[] |
| 5 | `GET /api/analytics` returns chart data | `curl localhost:3001/api/analytics` → JSON with costOverTime, costByCapability, tokensByWorker |
| 6 | All HTML pages render without errors | Browser: `/`, `/jobs`, `/jobs/:id`, `/tenants`, `/analytics` |
| 7 | **No writes to database** | Code review: no `prisma.job.create`, `update`, `delete`, etc. |
| 8 | TypeScript compiles (`pnpm run typecheck`) | Exit code 0 |

---

## 4. Implementation Notes

- **Reuse `@fyi/analytics`** for all aggregations — don't duplicate logic
- **Prisma queries** should be efficient (use `select`, avoid N+1)
- **Error handling:** Return 404 for not found, 500 for server errors (Fastify default)
- **Validation:** Use Fastify schema validation for query params
- **Types:** Export response types from `utils/analytics.ts` for client use

---

## 5. Definition of Done

- [ ] All 5 API endpoints implemented and tested
- [ ] All 5 HTML pages render correctly
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run build` passes
- [ ] No database writes in any route handler
- [ ] Unit tests for each endpoint (≥80% coverage)

---

## 6. Cross-References

- **Sprint Plan:** [README.md](./README.md)
- **Architecture:** [dashboard-architecture.md](../architecture/dashboard-architecture.md)
- **Stack Proposal:** [dashboard-stack-proposal.md](../planning/dashboard-stack-proposal.md)
- **Previous Issue:** [Issue-701.md](./Issue-701.md)