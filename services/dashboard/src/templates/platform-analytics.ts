// Platform analytics page template — content performance + revenue (ADR-0009).
// Read-only; shows data ingested into local tables by the scheduled worker.
import { renderLayout } from './layout.js';
import type { PlatformAnalyticsData } from '../utils/platform-data.js';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

export function renderPlatformAnalyticsPage(data: PlatformAnalyticsData): string {
  const { performance, revenue, totalRevenue, totalViews, lastIngestion } = data;

  const perfRows = performance
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

  const revenueRows = revenue
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
    <section class="stats-grid">
      <div class="stat-card"><span class="stat-value">${totalViews.toLocaleString()}</span> Total Views</div>
      <div class="stat-card"><span class="stat-value">$${totalRevenue.toFixed(4)}</span> Total Revenue</div>
      <div class="stat-card"><span class="stat-value">${performance.length}</span> Videos Tracked</div>
      <div class="stat-card"><span class="stat-value">${lastIngestion ? lastIngestion.status : '—'}</span> Last Sync</div>
    </section>

    <section class="chart-container">
      <h3>Revenue by Video</h3>
      <canvas id="platform-revenue-chart"></canvas>
    </section>

    <section class="content-block">
      <h3>Content Performance (views / likes / comments / watch time)</h3>
      <p class="muted">Data diambil dari tabel lokal via scheduler — Dashboard tidak pernah memanggil API platform saat halaman dibuka.</p>
      <table class="telemetry-table">
        <thead><tr><th>Video</th><th>Platform</th><th>Date</th><th>Views</th><th>Likes</th><th>Comments</th><th>Watch (min)</th><th>Retention</th></tr></thead>
        <tbody>${perfRows || '<tr><td colspan="8">Belum ada data performa. Jalankan worker ingestion.</td></tr>'}</tbody>
      </table>
    </section>

    <section class="content-block">
      <h3>Revenue (YouTube-first)</h3>
      <table class="telemetry-table">
        <thead><tr><th>Video</th><th>Period</th><th>Currency</th><th>Revenue</th><th>Tenant</th></tr></thead>
        <tbody>${revenueRows || '<tr><td colspan="5">Belum ada data revenue.</td></tr>'}</tbody>
      </table>
    </section>

    ${lastIngestion ? `<p class="muted">Ingestion terakhir: ${esc(lastIngestion.runStartedAt)} · units ${lastIngestion.unitsConsumed}/${lastIngestion.unitsRemaining + lastIngestion.unitsConsumed} · status ${esc(lastIngestion.status)}</p>` : ''}
  `;

  return renderLayout({
    title: 'Platform Analytics',
    currentPage: 'analytics',
    content,
    extraHead: '<script type="module" src="/assets/platform-analytics.js"></script>',
  });
}
