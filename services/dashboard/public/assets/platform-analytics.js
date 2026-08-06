// Platform analytics page — renders revenue by video chart from local data.
// Read-only, polls the local /api/platform/analytics endpoint (no platform API).
import { startPolling } from './polling.js';

function renderCharts(data) {
  const el = document.getElementById('platform-revenue-chart');
  if (!el) return;
  const chart = el.__chart || new Chart(el, {
    type: 'bar',
    data: {
      labels: data.revenue.map((r) => `${r.videoId.slice(0, 8)} (${r.period})`),
      datasets: [{ label: 'Revenue (USD)', data: data.revenue.map((r) => r.revenue), backgroundColor: 'rgba(34,197,94,0.5)' }],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
  chart.data.labels = data.revenue.map((r) => `${r.videoId.slice(0, 8)} (${r.period})`);
  chart.data.datasets[0].data = data.revenue.map((r) => r.revenue);
  chart.update();
  el.__chart = chart;
}

startPolling('/api/platform/analytics', renderCharts, { intervalMs: 30000 });
