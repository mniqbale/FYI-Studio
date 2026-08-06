// Tenants page template — tenant policy + spend vs quota.
import { renderLayout } from './layout.js';
import type { TenantView } from '../utils/data.js';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

export function renderTenantsPage(tenants: TenantView[]): string {
  const content = `
    <section class="tenants-grid">
      ${
        tenants.length
          ? tenants
              .map((t) => {
                const pct = Math.min(100, t.spendVsQuota.percentage);
                return `
            <div class="tenant-card">
              <h3>${esc(t.tenantId)}</h3>
              <div class="tenant-meta">
                <p><strong>Brand Voice:</strong> ${esc(t.brandVoice.slice(0, 120))}${t.brandVoice.length > 120 ? '...' : ''}</p>
                <p><strong>Language:</strong> ${esc(t.language)}</p>
                <p><strong>Forbidden Terms:</strong> ${t.forbiddenTerms.length ? esc(t.forbiddenTerms.join(', ')) : 'None'}</p>
              </div>
              <div class="tenant-policy">
                ${
                  t.modelPreferences
                    ? `<p><strong>Model Preferences:</strong> <pre>${esc(JSON.stringify(t.modelPreferences, null, 2))}</pre></p>`
                    : ''
                }
                <p><strong>Cost Quota:</strong> ${t.costQuota != null ? `$${t.costQuota.toFixed(2)}` : 'Unlimited'}</p>
                <p><strong>Enabled:</strong> ${t.enabled == null ? 'n/a' : t.enabled ? 'Yes' : 'No'}</p>
              </div>
              <div class="tenant-spend">
                <strong>Spend vs Quota:</strong> $${t.spendVsQuota.spent.toFixed(4)} / $${t.spendVsQuota.quota.toFixed(2)}
                (${t.spendVsQuota.percentage.toFixed(1)}%)
                <div class="quota-bar"><div class="quota-fill" style="width:${pct}%"></div></div>
              </div>
            </div>`;
              })
              .join('')
          : '<p>No tenants found.</p>'
      }
    </section>
  `;

  return renderLayout({
    title: 'Tenants',
    currentPage: 'tenants',
    content,
  });
}
