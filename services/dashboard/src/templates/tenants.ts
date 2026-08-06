// Tenants page template — tenant policy + spend vs quota, with CRUD
// (add/edit/delete brand knowledge + policy). WS-3: functional, not read-only.
import { renderLayout } from './layout.js';
import type { TenantView } from '../utils/data.js';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

export function renderTenantsPage(tenants: TenantView[]): string {
  const content = `
    <h2>Tenants / Brands</h2>
    <p class="muted">Kelola brand voice, bahasa, forbidden terms, dan policy per channel. Tambah / edit / hapus di sini.</p>
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
              <div class="tenant-actions">
                <a href="/tenants?edit=${encodeURIComponent(t.tenantId)}" class="btn">Edit</a>
                <form method="post" action="/tenants/${encodeURIComponent(t.tenantId)}" class="inline-form" onsubmit="return confirm('Delete this tenant?')">
                  <button type="submit" class="btn-danger">Delete</button>
                </form>
              </div>
            </div>`;
              })
              .join('')
          : '<p>No tenants found.</p>'
      }
    </section>
    <a href="/tenants?edit=new" class="btn">+ New Brand / Tenant</a>
  `;

  return renderLayout({
    title: 'Tenants',
    currentPage: 'tenants',
    content,
  });
}

/** Render the tenant edit form (for ?edit=<id> or ?edit=new). */
export function renderTenantEditPage(edit: string, tenants: TenantView[]): string {
  const existing = edit !== 'new' ? tenants.find((t) => t.tenantId === edit) : undefined;
  const isNew = edit === 'new' || !existing;

  const content = `
    <h2>${isNew ? 'New Brand / Tenant' : `Edit Brand: ${esc(edit)}`}</h2>
    <form method="post" action="/tenants/save" class="brand-form">
      <label>Tenant ID
        <input name="tenant_id" value="${isNew ? '' : esc(edit)}" ${isNew ? '' : 'readonly'} required>
      </label>
      <label>Brand Voice
        <textarea name="brand_voice" rows="4">${esc(existing?.brandVoice ?? '')}</textarea>
      </label>
      <label>Language
        <input name="language" value="${esc(existing?.language ?? 'en')}">
      </label>
      <label>Forbidden Terms (comma separated)
        <input name="forbidden_terms" value="${esc(existing?.forbiddenTerms.join(', ') ?? '')}">
      </label>
      <button type="submit" class="btn">Save</button>
      <a href="/tenants" class="btn-clear">Cancel</a>
    </form>
  `;

  return renderLayout({
    title: isNew ? 'New Brand' : `Edit ${edit}`,
    currentPage: 'tenants',
    content,
  });
}
