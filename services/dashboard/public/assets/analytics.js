// Analytics page — renders 3 Chart.js charts and polls every 30s.
import { startPolling } from './polling.js';

function makeChart(canvasId, type, labels, values, label) {
  const el = document.getElementById(canvasId);
  if (!el) return null;
  return new Chart(el, {
    type,
    data: { labels, datasets: [{ label, data: values, backgroundColor: 'rgba(99,132,255,0.3)', borderColor: 'rgba(99,132,255,1)', borderWidth: 1 }] },
    options: { responsive: true, maintainAspectRatio: false },
  });
}

function render(data) {
  // Cost over time (line)
  makeChart('cost-over-time', 'line', data.costOverTime.map((d) => d.date), data.costOverTime.map((d) => d.cost), 'Cost (USD)');
  // Cost by worker (bar)
  makeChart('cost-by-worker', 'bar', data.costByWorker.map((d) => d.worker), data.costByWorker.map((d) => d.cost), 'Cost (USD)');
  // Tokens by worker (bar, in+out)
  const tLabels = data.tokensByWorker.map((d) => d.worker);
  const inEl = document.getElementById('tokens-by-worker');
  if (inEl) {
    new Chart(inEl, {
      type: 'bar',
      data: {
        labels: tLabels,
        datasets: [
          { label: 'Tokens In', data: data.tokensByWorker.map((d) => d.tokensIn), backgroundColor: 'rgba(54,162,235,0.6)' },
          { label: 'Tokens Out', data: data.tokensByWorker.map((d) => d.tokensOut), backgroundColor: 'rgba(255,159,64,0.6)' },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
  }
}

startPolling('/api/analytics', render, { intervalMs: 30000 });
