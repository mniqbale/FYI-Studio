// Analytics page template — 3 Chart.js canvases.
import { renderLayout } from './layout.js';

interface AnalyticsPageParams {
  tenantId?: string;
  from?: string;
  to?: string;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

export function renderAnalyticsPage(params: AnalyticsPageParams): string {
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
  `;

  return renderLayout({
    title: 'Analytics',
    currentPage: 'analytics',
    content,
    extraHead: '<script type="module" src="/assets/analytics.js"></script>',
  });
}
