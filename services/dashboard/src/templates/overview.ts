// Overview page template — jobs by status + total cost/tokens + recent jobs.
import { renderLayout } from './layout.js';
import type { OverviewData } from '../utils/data.js';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

export function renderOverviewPage(data: OverviewData): string {
  const content = `
    <section class="stats-grid">
      <div class="stat-card"><span class="stat-value" data-stat="pending">${data.jobsByStatus.pending}</span> Pending</div>
      <div class="stat-card"><span class="stat-value" data-stat="running">${data.jobsByStatus.running}</span> Running</div>
      <div class="stat-card"><span class="stat-value" data-stat="waiting_approval">${data.jobsByStatus.waiting_approval}</span> Awaiting Approval</div>
      <div class="stat-card"><span class="stat-value" data-stat="completed">${data.jobsByStatus.completed}</span> Completed</div>
      <div class="stat-card"><span class="stat-value" data-stat="failed">${data.jobsByStatus.failed}</span> Failed</div>
      <div class="stat-card"><span class="stat-value" data-stat="cost">$${data.totalCost.toFixed(4)}</span> Total Cost</div>
      <div class="stat-card"><span class="stat-value" data-stat="tokens">${data.totalTokens.toLocaleString()}</span> Total Tokens</div>
    </section>
    <section class="recent-jobs">
      <h2>Recent Jobs</h2>
      <table class="jobs-table">
        <thead><tr><th>ID</th><th>Tenant</th><th>Recipe</th><th>Status</th><th>Progress</th><th>Created</th></tr></thead>
        <tbody id="recent-tbody">
          ${data.recentJobs
            .map(
              (job) => `
            <tr>
              <td><a href="/jobs/${job.id}">${esc(job.id.slice(0, 8))}...</a></td>
              <td>${esc(job.tenantId)}</td>
              <td>${esc(job.recipeId)}</td>
              <td><span class="status-badge status-${esc(job.status)}">${esc(job.status)}</span></td>
              <td>${job.currentStepIndex}/${job.totalSteps}</td>
              <td>${new Date(job.createdAt).toLocaleString()}</td>
            </tr>`,
            )
            .join('')}
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
