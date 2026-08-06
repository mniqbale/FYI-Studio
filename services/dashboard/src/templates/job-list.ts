// Job list page template — paginated, filterable table.
import { renderLayout } from './layout.js';
import type { JobListResponse } from '../utils/data.js';

interface JobListPageData {
  data: JobListResponse;
  params: { page: number; limit: number; status?: string; tenantId?: string };
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

function qs(params: JobListPageData['params']): string {
  const parts: string[] = [];
  if (params.status) parts.push(`status=${encodeURIComponent(params.status)}`);
  if (params.tenantId) parts.push(`tenant_id=${encodeURIComponent(params.tenantId)}`);
  parts.push(`limit=${params.limit}`);
  return parts.join('&');
}

export function renderJobListPage(pageData: JobListPageData): string {
  const { data, params } = pageData;
  const totalPages = Math.max(1, Math.ceil(data.total / params.limit));

  const content = `
    <section class="filters">
      <form method="get" class="filter-form">
        <select name="status">
          <option value="">All Status</option>
          <option value="pending" ${params.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="running" ${params.status === 'running' ? 'selected' : ''}>Running</option>
          <option value="waiting_approval" ${params.status === 'waiting_approval' ? 'selected' : ''}>Awaiting Approval</option>
          <option value="completed" ${params.status === 'completed' ? 'selected' : ''}>Completed</option>
          <option value="failed" ${params.status === 'failed' ? 'selected' : ''}>Failed</option>
        </select>
        <input type="text" name="tenant_id" placeholder="Tenant ID" value="${esc(params.tenantId ?? '')}">
        <button type="submit">Filter</button>
        <a href="/jobs" class="btn-clear">Clear</a>
      </form>
    </section>
    <section class="jobs-table-container">
      <table class="jobs-table">
        <thead><tr><th>ID</th><th>Tenant</th><th>Recipe</th><th>Status</th><th>Step</th><th>Created</th><th>Updated</th></tr></thead>
        <tbody id="jobs-tbody">
          ${data.jobs
            .map(
              (job) => `
            <tr>
              <td><a href="/jobs/${job.id}">${esc(job.id.slice(0, 8))}...</a></td>
              <td>${esc(job.tenantId)}</td>
              <td>${esc(job.recipeId)}</td>
              <td><span class="status-badge status-${esc(job.status)}">${esc(job.status)}</span></td>
              <td>${job.currentStepIndex}</td>
              <td>${new Date(job.createdAt).toLocaleString()}</td>
              <td>${new Date(job.updatedAt).toLocaleString()}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </section>
    <section class="pagination">
      ${params.page > 1 ? `<a href="?page=${params.page - 1}&${qs(params)}" class="btn">← Prev</a>` : ''}
      <span class="page-info">Page ${params.page} of ${totalPages} (${data.total} total)</span>
      ${params.page < totalPages ? `<a href="?page=${params.page + 1}&${qs(params)}" class="btn">Next →</a>` : ''}
    </section>
  `;

  return renderLayout({
    title: 'Jobs',
    currentPage: 'jobs',
    content,
    extraHead: '<script type="module" src="/assets/job-list.js"></script>',
  });
}
