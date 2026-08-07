// Analytics page template — 3 Chart.js canvases + platform analytics section
// (WS-6: merged /platform into /analytics).
import { renderLayout } from './layout.js';
import type { PlatformAnalyticsData } from '../utils/platform-data.js';

interface AnalyticsPageParams {
  tenantId?: string;
  from?: string;
  to?: string;
  platform?: PlatformAnalyticsData;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

export function renderAnalyticsPage(params: AnalyticsPageParams): string {
  const platform = params.platform;
  const perfRows = (platform?.performance ?? [])
    .map((p) => `
      <tr>
        <td><code>${esc(p.videoId)}</code></td>
        <td>${esc(p.platform)}</td>
        <td>${esc(p.snapshotDate)}</td>
        <td>${p.views.toLocaleString()}</td>
        <td>${p.likes.toLocaleString()}</td>
        <td>${p.comments.toLocaleString()}</td>
        <td>${p.watchTimeMinutes.toLocaleString()}</td>
        <td>${p.retentionPct != null ? `${p.retentionPct.toFixed(1)}%` : '—'}</td>
      </tr>
    `)
    .join('');

  const revenueRows = (platform?.revenue ?? [])
    .map((r) => `
      <tr>
        <td><code>${esc(r.videoId)}</code></td>
        <td>${esc(r.period)}</td>
        <td>${esc(r.currency)}</td>
        <td>$${r.revenue.toFixed(4)}</td>
        <td>${esc(r.tenantId)}</td>
      </tr>
    `)
    .join('');

  const content = `
    <section class="filters">
      <form method="get" class="filter-form">
        <input type="text" name="tenant_id" placeholder="Tenant ID (optional)" value="${esc(params.tenantId ?? '')}">
        <input type="date" name="from" value="${esc(params.from ?? '')}">
        <input type="date" name="to" value="${esc(params.to ?? '')}">
        <button type="submit">Filter</button>
      </form>
    </section>
    <section class="charts-grid">
      <div class="chart-container"><h3>Cost Over Time</h3><canvas id="cost-over-time"></canvas></div>
      <div class="chart-container"><h3>Cost by Worker</h3><canvas id="cost-by-worker"></canvas></div>
      <div class="chart-container"><h3>Tokens by Worker</h3><canvas id="tokens-by-worker"></canvas></div>
    </section>

    <section class="content-block">
      <h3>📊 Platform Analytics (Performa Konten & Revenue)</h3>
      <p class="muted">Data diambil dari tabel lokal via scheduler — Dashboard tidak pernah memanggil API platform saat halaman dibuka (ADR-0009).</p>
      <div class="stats-grid">
        <div class="stat-card"><span class="stat-value">${platform?.connection?.connected ? '✅' : '—'}</span> YouTube Connected</div>
        <div class="stat-card"><span class="stat-value">${(platform?.totalViews ?? 0).toLocaleString()}</span> Total Views</div>
        <div class="stat-card"><span class="stat-value">$${(platform?.totalRevenue ?? 0).toFixed(4)}</span> Total Revenue</div>
        <div class="stat-card"><span class="stat-value">${(platform?.performance ?? []).length}</span> Videos Tracked</div>
        <div class="stat-card"><span class="stat-value">${platform?.lastIngestion ? esc(platform.lastIngestion.status) : '—'}</span> Last Sync</div>
      </div>
      ${platform?.connection?.connected
        ? `<p class="muted">🔗 Channel: <strong>${esc(platform.connection.channelTitle ?? '')}</strong> (<code>${esc(platform.connection.accountRef ?? '')}</code>)</p>`
        : '<p class="muted">Belum ada channel YouTube terhubung. Klik <a href="/settings#social-section">Connect YouTube (OAuth)</a> di Settings.</p>'}
      <div class="chart-container"><h3>Revenue by Video</h3><canvas id="platform-revenue-chart"></canvas></div>
      <h4>Content Performance</h4>
      <table class="telemetry-table">
        <thead><tr><th>Video</th><th>Platform</th><th>Date</th><th>Views</th><th>Likes</th><th>Comments</th><th>Watch (min)</th><th>Retention</th></tr></thead>
        <tbody>${perfRows || '<tr><td colspan="8">Belum ada data performa. Jalankan worker ingestion.</td></tr>'}</tbody>
      </table>
      <h4>Revenue (YouTube-first)</h4>
      <table class="telemetry-table">
        <thead><tr><th>Video</th><th>Period</th><th>Currency</th><th>Revenue</th><th>Tenant</th></tr></thead>
        <tbody>${revenueRows || '<tr><td colspan="5">Belum ada data revenue.</td></tr>'}</tbody>
      </table>
    </section>
  `;

  return renderLayout({
    title: 'Analytics',
    currentPage: 'analytics',
    content,
    extraHead: '<script type="module" src="/assets/analytics.js"></script><script type="module" src="/assets/platform-analytics.js"></script>',
  });
}
