---
id: sprint-007-issue-703
title: "Issue 7.3 — Server-Rendered Pages + Client JS (Vanilla + Chart.js)"
owner: "Lead Engineer (AI Agent)"
status: "done"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-issue"
tags: [sprint-007, issue-703, frontend, vanilla-js, chartjs, polling, server-rendered]
related_documents:
  - "README.md"
  - "dashboard-architecture.md"
  - "dashboard-stack-proposal.md"
  - "Issue-701.md"
  - "Issue-702.md"
related_sprint: "Sprint-007"
---

# Issue 7.3 — Server-Rendered Pages + Client JS

> **Sprint:** 7 (Milestone 8: Dashboard UI)  
> **Estimate:** M (3-5 hours)  
> **Dependencies:** Issue 7.1 (Scaffold), Issue 7.2 (API Endpoints)  
> **Blockers:** None

---

## 1. Objective

Extract HTML templates into reusable modules, create vanilla JS client modules for polling and Chart.js integration, and wire them into the HTML pages. This separates concerns and enables maintainability while keeping zero-build architecture.

---

## 2. Deliverables

### 2.1 `services/dashboard/src/templates/layout.ts` (Shared Layout)

```typescript
// services/dashboard/src/templates/layout.ts
export interface LayoutData {
  title: string;
  currentPage: 'overview' | 'jobs' | 'job-detail' | 'tenants' | 'analytics';
  content: string;
  extraHead?: string;
}

export function renderLayout(data: LayoutData): string {
  const navItems = [
    { href: '/', label: 'Overview', page: 'overview' as const },
    { href: '/jobs', label: 'Jobs', page: 'jobs' as const },
    { href: '/tenants', label: 'Tenants', page: 'tenants' as const },
    { href: '/analytics', label: 'Analytics', page: 'analytics' as const },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title} - FYI Studio Dashboard</title>
  <link rel="stylesheet" href="/assets/style.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  ${data.extraHead ?? ''}
</head>
<body>
  <header class="dashboard-header">
    <h1><a href="/" style="color:inherit;text-decoration:none;">FYI Studio Dashboard</a></h1>
    <nav class="dashboard-nav">
      ${navItems.map(item => `
        <a href="${item.href}" class="${data.currentPage === item.page ? 'active' : ''}">${item.label}</a>
      `).join('')}
    </nav>
  </header>
  <main class="dashboard-main">
    ${data.content}
  </main>
  <footer class="dashboard-footer">
    <p>FYI Studio — AI Operating System for Distributed Media Production</p>
  </footer>
</body>
</html>`;
}
```

### 2.2 `services/dashboard/src/templates/overview.ts`

```typescript
// services/dashboard/src/templates/overview.ts
import { renderLayout } from './layout.js';
import type { OverviewData } from '../utils/analytics.js';

export function renderOverviewPage(data: OverviewData): string {
  const content = `
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
  `;

  return renderLayout({
    title: 'Overview',
    currentPage: 'overview',
    content,
    extraHead: '<script type="module" src="/assets/overview.js"></script>',
  });
}
```

### 2.3 `services/dashboard/src/templates/job-list.ts`

```typescript
// services/dashboard/src/templates/job-list.ts
import { renderLayout } from './layout.js';
import type { JobListResponse } from '../utils/analytics.js';

interface JobListPageData {
  data: JobListResponse;
  params: { page: number; limit: number; status?: string; tenantId?: string };
}

export function renderJobListPage(pageData: JobListPageData): string {
  const { data, params } = pageData;
  const totalPages = Math.ceil(data.total / params.limit);

  const content = `
    <section class="filters">
      <form method="get" class="filter-form">
        <select name="status">
          <option value="">All Status</option>
          <option value="pending" ${params.status==='pending'?'selected':''}>Pending</option>
          <option value="running" ${params.status==='running'?'selected':''}>Running</option>
          <option value="waiting_approval" ${params.status==='waiting_approval'?'selected':''}>Awaiting Approval</option>
          <option value="completed" ${params.status==='completed'?'selected':''}>Completed</option>
          <option value="failed" ${params.status==='failed'?'selected':''}>Failed</option>
        </select>
        <input type="text" name="tenant_id" placeholder="Tenant ID" value="${params.tenantId||''}">
        <button type="submit">Filter</button>
        <a href="/jobs" class="btn-clear">Clear</a>
      </form>
    </section>
    <section class="jobs-table-container">
      <table class="jobs-table">
        <thead><tr><th>ID</th><th>Tenant</th><th>Recipe</th><th>Status</th><th>Progress</th><th>Created</th><th>Updated</th></tr></thead>
        <tbody id="jobs-tbody">
          ${data.jobs.map(job => `
            <tr>
              <td><a href="/jobs/${job.id}">${job.id.slice(0,8)}...</a></td>
              <td>${job.tenantId}</td>
              <td>${job.recipeId}</td>
              <td><span class="status-badge status-${job.status}">${job.status}</span></td>
              <td>${job.currentStepIndex}/?</td>
              <td>${new Date(job.createdAt).toLocaleString()}</td>
              <td>${new Date(job.updatedAt).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
    <section class="pagination">
      ${params.page > 1 ? `<a href="?page=${params.page-1}&limit=${params.limit}&status=${params.status||''}&tenant_id=${params.tenantId||''}" class="btn">← Prev</a>` : ''}
      <span class="page-info">Page ${params.page} of ${totalPages} (${data.total} total)</span>
      ${params.page < totalPages ? `<a href="?page=${params.page+1}&limit=${params.limit}&status=${params.status||''}&tenant_id=${params.tenantId||''}" class="btn">Next →</a>` : ''}
    </section>
  `;

  return renderLayout({
    title: 'Jobs',
    currentPage: 'jobs',
    content,
    extraHead: '<script type="module" src="/assets/job-list.js"></script>',
  });
}
```

### 2.4 `services/dashboard/src/templates/job-detail.ts`

```typescript
// services/dashboard/src/templates/job-detail.ts
import { renderLayout } from './layout.js';
import type { JobDetailResponse } from '../utils/analytics.js';

export function renderJobDetailPage(data: JobDetailResponse): string {
  const { job, telemetry, videoRef } = data;
  const steps = job.recipeSnapshot?.steps ?? [];
  
  const content = `
    <section class="job-header">
      <h2>${job.id}</h2>
      <div class="job-meta">
        <span><strong>Tenant:</strong> ${job.tenantId}</span>
        <span><strong>Recipe:</strong> ${job.recipeId}</span>
        <span><strong>Status:</strong> <span class="status-badge status-${job.status}">${job.status}</span></span>
        <span><strong>Step:</strong> ${job.currentStepIndex}/${steps.length}</span>
        <span><strong>Created:</strong> ${new Date(job.createdAt).toLocaleString()}</span>
        <span><strong>Updated:</strong> ${new Date(job.updatedAt).toLocaleString()}</span>
      </div>
    </section>
    <section class="pipeline-timeline">
      <h3>Pipeline Timeline</h3>
      <div id="timeline" class="timeline">
        ${telemetry.map((t, i) => `
          <div class="timeline-step ${i < job.currentStepIndex ? 'completed' : i === job.currentStepIndex ? 'current' : 'pending'}" data-worker="${t.workerId}" data-execution-id="${t.executionId}">
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
      <div class="artifacts-grid" id="artifacts-grid">
        ${job.artifacts ? Object.entries(job.artifacts).map(([key, value]) => `
          <div class="artifact-card" data-key="${key}">
            <h4>${key}</h4>
            <pre>${JSON.stringify(value, null, 2)}</pre>
            ${key === 'video_url' && videoRef ? `
              <video id="video-player" controls class="video-player" src="${videoRef}"></video>
            ` : ''}
            ${key === 'audio_url' && videoRef ? `
              <audio controls class="audio-player" src="${videoRef.replace('video.mp4', 'audio.mp3')}"></audio>
            ` : ''}
            ${key === 'subtitle_url' && videoRef ? `
              <a href="${videoRef.replace('video.mp4', 'subtitles.srt')}" target="_blank" class="btn">Download Subtitles</a>
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
            <tr>
              <td>${t.workerId}</td>
              <td>${t.provider ?? '-'}</td>
              <td>${t.model ?? '-'}</td>
              <td>${t.tokensIn ?? '-'}</td>
              <td>${t.tokensOut ?? '-'}</td>
              <td>$${t.cost.toFixed(6)}</td>
              <td>${t.durationMs}ms</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `;

  return renderLayout({
    title: `Job ${job.id.slice(0,8)}`,
    currentPage: 'job-detail',
    content,
    extraHead: '<script type="module" src="/assets/job-detail.js"></script>',
  });
}
```

### 2.5 `services/dashboard/src/templates/tenants.ts`

```typescript
// services/dashboard/src/templates/tenants.ts
import { renderLayout } from './layout.js';
import type { TenantView } from '../utils/analytics.js';

export function renderTenantsPage(tenants: TenantView[]): string {
  const content = `
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
  `;

  return renderLayout({
    title: 'Tenants',
    currentPage: 'tenants',
    content,
  });
}
```

### 2.6 `services/dashboard/src/templates/analytics.ts`

```typescript
// services/dashboard/src/templates/analytics.ts
import { renderLayout } from './layout.js';
import type { AnalyticsData } from '../utils/analytics.js';

interface AnalyticsPageData {
  data: AnalyticsData;
  params: { tenantId?: string; from?: string; to?: string };
}

export function renderAnalyticsPage(pageData: AnalyticsPageData): string {
  const { data, params } = pageData;

  const content = `
    <section class="filters">
      <form method="get" class="filter-form">
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
  `;

  return renderLayout({
    title: 'Analytics',
    currentPage: 'analytics',
    content,
    extraHead: '<script type="module" src="/assets/analytics.js"></script>',
  });
}
```

### 2.7 `services/dashboard/src/client/polling.ts` (Shared Utility)

```typescript
// services/dashboard/src/client/polling.ts
export interface PollOptions {
  intervalMs?: number;
  onError?: (error: Error) => void;
  stopCondition?: (data: any) => boolean;
}

export function startPolling<T>(
  url: string,
  onData: (data: T) => void,
  options: PollOptions = {}
): () => void {
  const { intervalMs = 2000, onError, stopCondition } = options;
  let stopped = false;
  let controller: AbortController | null = null;

  async function tick() {
    if (stopped) return;
    controller = new AbortController();
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      onData(data);
      if (stopCondition?.(data)) {
        stopped = true;
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      onError?.(e as Error);
    }
    if (!stopped) setTimeout(tick, intervalMs);
  }

  tick();

  return () => {
    stopped = true;
    controller?.abort();
  };
}
```

### 2.8 `services/dashboard/src/client/overview.ts`

```typescript
// services/dashboard/src/client/overview.ts
import { startPolling } from './polling.js';

interface OverviewData {
  jobsByStatus: Record<string, number>;
  totalCost: number;
  totalTokens: number;
  recentJobs: any[];
}

function updateStats(data: OverviewData) {
  const statCards = document.querySelectorAll('.stat-card .stat-value');
  if (statCards.length >= 7) {
    statCards[0].textContent = String(data.jobsByStatus.pending ?? 0);
    statCards[1].textContent = String(data.jobsByStatus.running ?? 0);
    statCards[2].textContent = String(data.jobsByStatus.waiting_approval ?? 0);
    statCards[3].textContent = String(data.jobsByStatus.completed ?? 0);
    statCards[4].textContent = String(data.jobsByStatus.failed ?? 0);
    statCards[5].textContent = `$${data.totalCost.toFixed(4)}`;
    statCards[6].textContent = data.totalTokens.toLocaleString();
  }

  // Update recent jobs table
  const tbody = document.querySelector('#recent-jobs tbody') ?? document.querySelector('.recent-jobs tbody');
  if (tbody && data.recentJobs.length) {
    tbody.innerHTML = data.recentJobs.map(job => `
      <tr>
        <td><a href="/jobs/${job.id}">${job.id.slice(0,8)}...</a></td>
        <td>${job.tenantId}</td>
        <td>${job.recipeId}</td>
        <td><span class="status-badge status-${job.status}">${job.status}</span></td>
        <td>${job.currentStepIndex}/${job.totalSteps}</td>
        <td>${new Date(job.createdAt).toLocaleString()}</td>
      </tr>
    `).join('');
  }
}

// Start polling
const stopPolling = startPolling<OverviewData>('/api/overview', updateStats, { intervalMs: 2000 });

// Cleanup on page unload
window.addEventListener('beforeunload', stopPolling);
```

### 2.9 `services/dashboard/src/client/job-list.ts`

```typescript
// services/dashboard/src/client/job-list.ts
import { startPolling } from './polling.js';

interface JobListResponse {
  jobs: any[];
  total: number;
  page: number;
  limit: number;
}

function updateJobList(data: JobListResponse) {
  const tbody = document.getElementById('jobs-tbody');
  if (tbody) {
    tbody.innerHTML = data.jobs.map(job => `
      <tr>
        <td><a href="/jobs/${job.id}">${job.id.slice(0,8)}...</a></td>
        <td>${job.tenantId}</td>
        <td>${job.recipeId}</td>
        <td><span class="status-badge status-${job.status}">${job.status}</span></td>
        <td>${job.currentStepIndex}/?</td>
        <td>${new Date(job.createdAt).toLocaleString()}</td>
        <td>${new Date(job.updatedAt).toLocaleString()}</td>
      </tr>
    `).join('');
  }

  // Update pagination info
  const pageInfo = document.querySelector('.page-info');
  if (pageInfo) {
    const totalPages = Math.ceil(data.total / data.limit);
    pageInfo.textContent = `Page ${data.page} of ${totalPages} (${data.total} total)`;
  }
}

const urlParams = new URLSearchParams(window.location.search);
const apiUrl = `/api/jobs?page=${urlParams.get('page')||1}&limit=${urlParams.get('limit')||20}&status=${urlParams.get('status')||''}&tenant_id=${urlParams.get('tenant_id')||''}`;

const stopPolling = startPolling<JobListResponse>(apiUrl, updateJobList, { intervalMs: 2000 });
window.addEventListener('beforeunload', stopPolling);
```

### 2.10 `services/dashboard/src/client/job-detail.ts`

```typescript
// services/dashboard/src/client/job-detail.ts
import { startPolling } from './polling.js';

interface JobDetailResponse {
  job: any;
  telemetry: any[];
  videoRef: string | null;
}

function updateJobDetail(data: JobDetailResponse) {
  const { telemetry, videoRef } = data;
  const jobEl = document.querySelector('.job-header .status-badge');
  if (jobEl && data.job.status) {
    jobEl.textContent = data.job.status;
    jobEl.className = `status-badge status-${data.job.status}`;
  }

  // Update timeline steps
  const timeline = document.getElementById('timeline');
  if (timeline && telemetry.length) {
    timeline.innerHTML = telemetry.map((t, i) => `
      <div class="timeline-step ${i < (data.job.currentStepIndex ?? 0) ? 'completed' : i === (data.job.currentStepIndex ?? 0) ? 'current' : 'pending'}" data-worker="${t.workerId}" data-execution-id="${t.executionId}">
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
    `).join('');
  }

  // Update video if new ref
  if (videoRef) {
    const video = document.getElementById('video-player') as HTMLVideoElement;
    if (video && video.src !== videoRef) {
      video.src = videoRef;
      video.load();
    }
  }
}

const jobId = window.location.pathname.split('/').pop();
const stopPolling = startPolling<JobDetailResponse>(`/api/jobs/${jobId}`, updateJobDetail, { intervalMs: 2000 });
window.addEventListener('beforeunload', stopPolling);
```

### 2.11 `services/dashboard/src/client/analytics.ts`

```typescript
// services/dashboard/src/client/analytics.ts
import { startPolling } from './polling.js';
import { Chart } from 'chart.js/auto';

interface AnalyticsData {
  costOverTime: { date: string; cost: number }[];
  costByCapability: { capability: string; cost: number; count: number }[];
  tokensByWorker: { workerId: string; tokensIn: number; tokensOut: number; count: number }[];
}

let costOverTimeChart: Chart;
let costByCapabilityChart: Chart;
let tokensByWorkerChart: Chart;

function initCharts(data: AnalyticsData) {
  const ctx1 = document.getElementById('cost-over-time') as HTMLCanvasElement;
  const ctx2 = document.getElementById('cost-by-capability') as HTMLCanvasElement;
  const ctx3 = document.getElementById('tokens-by-worker') as HTMLCanvasElement;

  if (ctx1) {
    costOverTimeChart = new Chart(ctx1, {
      type: 'line',
      data: {
        labels: data.costOverTime.map(d => d.date),
        datasets: [{ label: 'Cost (USD)', data: data.costOverTime.map(d => d.cost), borderColor: '#3b82f6', tension: 0.1 }],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
  }

  if (ctx2) {
    costByCapabilityChart = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: data.costByCapability.map(d => d.capability),
        datasets: [{ label: 'Cost (USD)', data: data.costByCapability.map(d => d.cost), backgroundColor: '#10b981' }],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
  }

  if (ctx3) {
    tokensByWorkerChart = new Chart(ctx3, {
      type: 'bar',
      data: {
        labels: data.tokensByWorker.map(d => d.workerId),
        datasets: [
          { label: 'Tokens In', data: data.tokensByWorker.map(d => d.tokensIn), backgroundColor: '#f59e0b' },
          { label: 'Tokens Out', data: data.tokensByWorker.map(d => d.tokensOut), backgroundColor: '#ef4444' },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
  }
}

function updateCharts(data: AnalyticsData) {
  if (costOverTimeChart) {
    costOverTimeChart.data.labels = data.costOverTime.map(d => d.date);
    costOverTimeChart.data.datasets[0].data = data.costOverTime.map(d => d.cost);
    costOverTimeChart.update();
  }
  if (costByCapabilityChart) {
    costByCapabilityChart.data.labels = data.costByCapability.map(d => d.capability);
    costByCapabilityChart.data.datasets[0].data = data.costByCapability.map(d => d.cost);
    costByCapabilityChart.update();
  }
  if (tokensByWorkerChart) {
    tokensByWorkerChart.data.labels = data.tokensByWorker.map(d => d.workerId);
    tokensByWorkerChart.data.datasets[0].data = data.tokensByWorker.map(d => d.tokensIn);
    tokensByWorkerChart.data.datasets[1].data = data.tokensByWorker.map(d => d.tokensOut);
    tokensByWorkerChart.update();
  }
}

// Initial load
fetch('/api/analytics').then(r => r.json()).then(initCharts).catch(console.error);

// Poll for updates (slower for analytics - 30s)
const stopPolling = startPolling<AnalyticsData>('/api/analytics', updateCharts, { intervalMs: 30000 });
window.addEventListener('beforeunload', stopPolling);
```

### 2.12 `services/dashboard/public/assets/style.css`

```css
/* services/dashboard/public/assets/style.css */
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background: #f9fafb; }
a { color: #3b82f6; text-decoration: none; }
a:hover { text-decoration: underline; }

.dashboard-header { background: #fff; border-bottom: 1px solid #e5e7eb; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; }
.dashboard-header h1 { font-size: 1.25rem; font-weight: 600; }
.dashboard-nav { display: flex; gap: 1.5rem; }
.dashboard-nav a { color: #6b7280; font-weight: 500; padding: 0.25rem 0; border-bottom: 2px solid transparent; }
.dashboard-nav a.active, .dashboard-nav a:hover { color: #3b82f6; border-bottom-color: #3b82f6; }

.dashboard-main { max-width: 1400px; margin: 0 auto; padding: 2rem; }
.dashboard-footer { text-align: center; padding: 2rem; color: #9ca3af; font-size: 0.875rem; border-top: 1px solid #e5e7eb; margin-top: 3rem; }

.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
.stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem; text-align: center; }
.stat-value { display: block; font-size: 2rem; font-weight: 700; color: #111827; margin-bottom: 0.25rem; }
.stat-card > div:last-child { color: #6b7280; font-size: 0.875rem; }

.status-badge { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; text-transform: capitalize; }
.status-pending { background: #fef3c7; color: #92400e; }
.status-running { background: #dbeafe; color: #1e40af; }
.status-waiting_approval { background: #fce7f3; color: #9d174d; }
.status-completed { background: #d1fae5; color: #065f46; }
.status-failed { background: #fee2e2; color: #991b1b; }

table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 0.5rem; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
th { background: #f9fafb; font-weight: 600; color: #374151; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: #f9fafb; }

.filters { margin-bottom: 1.5rem; }
.filter-form { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; }
.filter-form select, .filter-form input { padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem; }
.filter-form button, .btn { padding: 0.5rem 1rem; background: #3b82f6; color: #fff; border: none; border-radius: 0.375rem; cursor: pointer; font-weight: 500; }
.filter-form button:hover, .btn:hover { background: #2563eb; }
.btn-clear { color: #6b7280; }
.pagination { display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1.5rem; }

.job-header { background: #fff; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.job-meta { display: flex; flex-wrap: wrap; gap: 2rem; margin-top: 1rem; color: #4b5563; }

.timeline { display: flex; flex-direction: column; gap: 0.75rem; }
.timeline-step { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: #fff; border-radius: 0.5rem; border: 1px solid #e5e7eb; }
.timeline-step.pending { opacity: 0.5; }
.timeline-step.current { border-color: #3b82f6; box-shadow: 0 0 0 1px #3b82f6; }
.timeline-step.completed { border-color: #10b981; }
.step-info { display: flex; align-items: center; gap: 0.5rem; min-width: 200px; }
.step-name { font-weight: 500; }
.step-status { font-size: 1.25rem; }
.step-metrics { display: flex; gap: 1.5rem; color: #6b7280; font-size: 0.875rem; }

.artifacts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; }
.artifact-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1rem; }
.artifact-card h4 { margin-bottom: 0.5rem; color: #374151; }
.artifact-card pre { background: #f3f4f6; padding: 0.75rem; border-radius: 0.375rem; overflow: auto; font-size: 0.75rem; max-height: 300px; }
.video-player, .audio-player { width: 100%; max-width: 640px; margin-top: 0.5rem; }

.quota-bar { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin-top: 0.5rem; }
.quota-fill { height: 100%; background: #10b981; transition: width 0.3s; }
.quota-fill[style*="100%"], .quota-fill[style*="99%"], .quota-fill[style*="98%"], .quota-fill[style*="97%"], .quota-fill[style*="96%"], .quota-fill[style*="95%"] { background: #ef4444; }

.charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem; }
.chart-container { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem; }
.chart-container h3 { margin-bottom: 1rem; font-size: 1rem; }
.chart-container canvas { max-height: 300px; }

.tenants-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.5rem; }
.tenant-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem; }
.tenant-card h3 { margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e5e7eb; }
.tenant-meta p, .tenant-policy p { margin: 0.5rem 0; font-size: 0.875rem; color: #4b5563; }
.tenant-spend { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; }

@media (max-width: 768px) {
  .dashboard-header { flex-direction: column; gap: 1rem; }
  .dashboard-nav { width: 100%; justify-content: space-around; }
  .dashboard-main { padding: 1rem; }
  .charts-grid { grid-template-columns: 1fr; }
}
```

### 2.13 Update Route Files to Use Templates

Each route file (`overview.ts`, `jobs.ts`, `tenants.ts`, `analytics.ts`) should import and use the template functions instead of inline HTML.

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | All 5 pages use shared layout + template modules | Code review: imports from `templates/` |
| 2 | Vanilla JS polling works on all pages | Browser: stats update without refresh |
| 3 | Job detail timeline updates in real-time | Browser: run a job, watch steps complete |
| 4 | Video plays in job detail page | Browser: `/jobs/:id` → video plays |
| 5 | Analytics charts render + update | Browser: `/analytics` → 3 charts visible |
| 6 | Chart.js loaded from CDN | Network tab: chart.js requested from cdn.jsdelivr.net |
| 7 | No build step required | `pnpm run dashboard` works without `pnpm run build` first |
| 8 | TypeScript compiles | `pnpm run typecheck` passes |

---

## 4. Implementation Notes

- **Template separation** enables testing HTML rendering in isolation
- **Client modules** are ES modules (`<script type="module">`) — no bundler needed
- **Polling interval:** 2s for overview/jobs/job-detail, 30s for analytics
- **Stop condition:** Job detail polling could stop when job status = completed/failed
- **Chart.js** from CDN — vendor locally if air-gapped needed later

---

## 5. Definition of Done

- [ ] All template modules created and used by routes
- [ ] All client modules created and loaded by pages
- [ ] Polling works on all pages
- [ ] Charts render on analytics page
- [ ] Video plays on job detail page
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run build` passes
- [ ] CSS loads and styles all pages correctly

---

## 6. Cross-References

- **Sprint Plan:** [README.md](./README.md)
- **Architecture:** [dashboard-architecture.md](../architecture/dashboard-architecture.md)
- **Previous Issues:** [Issue-701.md](./Issue-701.md), [Issue-702.md](./Issue-702.md)