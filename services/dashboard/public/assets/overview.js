// Overview page — polls /api/overview every 2s.
import { startPolling } from './polling.js';

function updateStats(data) {
  const map = {
    pending: String(data.jobsByStatus.pending ?? 0),
    running: String(data.jobsByStatus.running ?? 0),
    waiting_approval: String(data.jobsByStatus.waiting_approval ?? 0),
    completed: String(data.jobsByStatus.completed ?? 0),
    failed: String(data.jobsByStatus.failed ?? 0),
    cost: `$${(data.totalCost ?? 0).toFixed(4)}`,
    tokens: (data.totalTokens ?? 0).toLocaleString(),
  };
  document.querySelectorAll('[data-stat]').forEach((el) => {
    const key = el.getAttribute('data-stat');
    if (key && map[key] != null) el.textContent = map[key];
  });
  const tbody = document.getElementById('recent-tbody');
  if (tbody && data.recentJobs && data.recentJobs.length) {
    tbody.innerHTML = data.recentJobs
      .map(
        (job) => `<tr>
          <td><a href="/jobs/${job.id}">${job.id.slice(0, 8)}...</a></td>
          <td>${job.tenantId}</td>
          <td>${job.recipeId}</td>
          <td><span class="status-badge status-${job.status}">${job.status}</span></td>
          <td>${job.currentStepIndex}/${job.totalSteps}</td>
          <td>${new Date(job.createdAt).toLocaleString()}</td>
        </tr>`,
      )
      .join('');
  }
}

startPolling('/api/overview', updateStats, { intervalMs: 2000 });
