// Shared HTML shell for all dashboard pages (dashboard-architecture.md §4.1).
export interface LayoutData {
  title: string;
  currentPage: 'overview' | 'jobs' | 'job-detail' | 'tenants' | 'analytics';
  content: string;
  extraHead?: string;
}

const NAV_ITEMS: Array<{ href: string; label: string; page: LayoutData['currentPage'] }> = [
  { href: '/', label: 'Overview', page: 'overview' },
  { href: '/jobs', label: 'Jobs', page: 'jobs' },
  { href: '/tenants', label: 'Tenants', page: 'tenants' },
  { href: '/analytics', label: 'Analytics', page: 'analytics' },
];

export function renderLayout(data: LayoutData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title} - FYI Studio Dashboard</title>
  <link rel="stylesheet" href="/assets/style.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  ${data.extraHead ?? ''}
</head>
<body>
  <header class="dashboard-header">
    <h1><a href="/" style="color:inherit;text-decoration:none;">FYI Studio Dashboard</a></h1>
    <nav class="dashboard-nav">
      ${NAV_ITEMS.map(
        (item) =>
          `<a href="${item.href}" class="${data.currentPage === item.page ? 'active' : ''}">${item.label}</a>`,
      ).join('')}
    </nav>
  </header>
  <main class="dashboard-main">
    ${data.content}
  </main>
  <footer class="dashboard-footer">
    <p>FYI Studio — AI Operating System for Distributed Media Production</p>
  </footer>
</body>
</html>`;
}
