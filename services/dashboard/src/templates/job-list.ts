// Job list page template — paginated, filterable table + publish schedule
// calendar (WS-5). Schedule a publish for an approved job and see it on a
// dynamic monthly calendar.
import { renderLayout } from './layout.js';
import type { JobListResponse } from '../utils/data.js';
import type { ScheduledPublishRow, SocialAccountRow } from '../utils/social-publish.js';

interface JobListPageData {
  data: JobListResponse;
  params: { page: number; limit: number; status?: string; tenantId?: string };
  schedules?: ScheduledPublishRow[];
  accounts?: SocialAccountRow[];
  schedulableJobs?: Array<{ id: string; status: string }>;
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
  const { data, params, schedules = [], accounts = [], schedulableJobs = [] } = pageData;
  const totalPages = Math.max(1, Math.ceil(data.total / params.limit));

  // Build a monthly calendar of scheduled publishes (WS-5).
  const calendar = buildCalendar(schedules);

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

    <section class="content-block">
      <h3>📅 Jadwal Publish (Kalender)</h3>
      <p class="muted">Lihat konten yang dijadwalkan secara visual. Geser/ubah tanggal untuk menyesuaikan (mis. pindah ke tanggal penting).</p>
      <div class="calendar" id="publish-calendar">${calendar}</div>
      <div class="schedule-form-wrap">
        <h4>Jadwalkan publish baru</h4>
        <form id="schedule-form" class="brand-form">
          <label>Tenant ID <input name="tenant_id" value="${esc(params.tenantId ?? 'demo')}" required></label>
          <label>Job ID
            <select name="job_id" required>
              <option value="">— pilih job —</option>
              ${schedulableJobs.map((j) => `<option value="${esc(j.id)}">${esc(j.id.slice(0, 8))}... (${esc(j.status)})</option>`).join('')}
            </select>
          </label>
          <label>Social Account
            <select name="social_account_id" required>
              <option value="">— pilih akun —</option>
              ${accounts.filter((a) => a.enabled).map((a) => `<option value="${esc(a.id)}">${esc(a.display_name)} (${esc(a.platform)})</option>`).join('')}
            </select>
          </label>
          <label>Tanggal & Waktu (UTC) <input type="datetime-local" name="scheduled_at" required></label>
          <button type="submit" class="btn">Jadwalkan</button>
        </form>
      </div>
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
    extraHead: '<script type="module" src="/assets/job-list.js"></script><script type="module" src="/assets/jobs-schedule.js"></script>',
  });
}

/** Build a simple monthly calendar grid with scheduled publishes marked. */
function buildCalendar(schedules: ScheduledPublishRow[]): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = firstDay.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Map scheduled publishes to their day-of-month.
  const byDay = new Map<number, ScheduledPublishRow[]>();
  for (const s of schedules) {
    const d = new Date(s.scheduled_at);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      const list = byDay.get(day) ?? [];
      list.push(s);
      byDay.set(day, list);
    }
  }

  const cells: string[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push('<div class="cal-cell empty"></div>');
  for (let day = 1; day <= daysInMonth; day++) {
    const items = byDay.get(day) ?? [];
    const isToday = day === now.getDate();
    cells.push(`
      <div class="cal-cell ${isToday ? 'today' : ''}">
        <span class="cal-day">${day}</span>
        ${items.map((s) => `<div class="cal-event status-${esc(s.status)}" title="${esc(s.job_id)}">${esc(s.job_id.slice(0, 6))}…</div>`).join('')}
      </div>
    `);
  }

  return `<div class="cal-head">${esc(monthName)}</div><div class="cal-grid">${cells.join('')}</div>`;
}
