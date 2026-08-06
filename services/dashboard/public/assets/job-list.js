// Job list page — polls the current filtered API endpoint (keeps URL query in sync).
import { startPolling } from './polling.js';

function apiUrl() {
  const q = window.location.search;
  return '/api/jobs' + (q ? q : '?page=1&limit=20');
}

function updateTable(data) {
  const tbody = document.getElementById('jobs-tbody');
  if (!tbody) return;
  tbody.innerHTML = data.jobs
    .map(
      (job) => `<tr>
        <td><a href="/jobs/${job.id}">${job.id.slice(0, 8)}...</a></td>
        <td>${job.tenantId}</td>
        <td>${job.recipeId}</td>
        <td><span class="status-badge status-${job.status}">${job.status}</span></td>
        <td>${job.currentStepIndex}</td>
        <td>${new Date(job.createdAt).toLocaleString()}</td>
        <td>${new Date(job.updatedAt).toLocaleString()}</td>
      </tr>`,
    )
    .join('');

  const info = document.querySelector('.page-info');
  if (info) {
    const totalPages = Math.max(1, Math.ceil(data.total / data.limit));
    info.textContent = `Page ${data.page} of ${totalPages} (${data.total} total)`;
  }
}

startPolling(apiUrl(), updateTable, { intervalMs: 5000 });
