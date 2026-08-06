// Settings "AI Workspace" page template — providers, model assignment, tenants,
// social accounts & publishing (Issue 9.2 / ADR-0008).
import { renderLayout } from './layout.js';
import type { SettingsOverview } from '../utils/settings.js';
import type { SocialAccountRow, ScheduledPublishRow } from '../utils/social-publish.js';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

export function renderSettingsPage(
  data: SettingsOverview,
  social?: { accounts: SocialAccountRow[]; schedules: ScheduledPublishRow[] },
): string {
  const { providers, assignments } = data;

  const providerRows = providers
    .map((p) => `
      <tr>
        <td><strong>${esc(p.name)}</strong><br><code>${esc(p.id)}</code></td>
        <td><span class="badge ${p.connected ? 'ok' : 'off'}">${p.connected ? 'Connected' : 'Disconnected'}</span></td>
        <td>${p.requiresApiKey ? (p.keyConfigured ? '✅ configured' : '❌ not set') : 'not required'}</td>
        <td>
          ${p.requiresApiKey ? `
            <form method="post" action="/settings/providers/${esc(p.id)}/key" class="key-form" data-validate="${esc(p.id)}">
              <input type="password" name="api_key" placeholder="Paste ${esc(p.name)} API key" autocomplete="off">
              <button type="button" class="btn btn-small validate-btn">Validate</button>
              <button type="submit" class="btn btn-small">${p.keyConfigured ? 'Update' : 'Save'}</button>
              <span class="key-status"></span>
            </form>
            ${p.keyConfigured ? `
              <form method="post" action="/settings/providers/${esc(p.id)}/key/delete" class="inline-form" onsubmit="return confirm('Delete this API key?')">
                <button type="submit" class="btn-danger btn-small">Delete</button>
              </form>
            ` : ''}
          ` : '<span class="muted">—</span>'}
        </td>
        <td>
          <form method="post" action="/settings/providers/${esc(p.id)}">
            ${p.connected
              ? `<button type="submit" name="action" value="disconnect" class="btn-danger btn-small">Disconnect</button>`
              : `<button type="submit" name="action" value="connect" class="btn btn-small">Connect</button>`}
          </form>
        </td>
      </tr>
    `)
    .join('');

  const assignmentRows = assignments
    .map((a) => {
      // Group candidates by provider (WS-B): ollama, anthropic, gemini, openai, ...
      const byProvider = new Map<string, Array<{ provider: string; model: string }>>();
      for (const c of a.candidates) {
        const list = byProvider.get(c.provider) ?? [];
        list.push(c);
        byProvider.set(c.provider, list);
      }
      const groupedOptions = [...byProvider.entries()]
        .map(([provider, models]) => `
          <optgroup label="${esc(provider)}">
            ${models.map((m) => `<option value="${esc(m.provider)}/${esc(m.model)}">${esc(m.model)}</option>`).join('')}
          </optgroup>
        `)
        .join('');
      return `
      <div class="assign-row">
        <div class="assign-info">
          <strong>${esc(a.label)}</strong>
          <code>${esc(a.capability)}</code>
          <span class="muted">needs: ${esc(a.requiredModelCaps.join(', '))}</span>
          ${a.kind === 'media' ? `<span class="badge off">media worker</span>` : ''}
          ${a.note ? `<p class="assign-note">${esc(a.note)}</p>` : ''}
        </div>
        <form method="post" action="/settings/assign" class="assign-form">
          <input type="hidden" name="capability" value="${esc(a.capability)}">
          <select name="model" class="model-select">
            <option value="">— ${a.current ? `Current: ${esc(a.current.provider)}/${esc(a.current.model)}` : 'no model assigned'} —</option>
            ${groupedOptions}
          </select>
          <button type="submit" class="btn">Assign</button>
        </form>
      </div>
    `;
    })
    .join('');

  const content = `
    <h2>Settings — AI Workspace</h2>

    <section class="settings-section">
      <h3>AI Providers</h3>
      <p class="muted">Connect the AI providers (Claude, Gemini, Ollama, ChatGPT, etc.). Keys are validated against the real provider API and stored encrypted — never in plaintext.</p>
      <table class="telemetry-table providers-table">
        <thead><tr><th>Provider</th><th>Status</th><th>API Key</th><th>Key Management</th><th>Action</th></tr></thead>
        <tbody>${providerRows || '<tr><td colspan="5">No providers.</td></tr>'}</tbody>
      </table>
    </section>

    <section class="settings-section">
      <h3>Model Assignment per Task</h3>
      <p class="muted">Choose which AI model handles each worker. Only connected + capable models are shown. Media workers (voice/subtitle/video) use local offline engines.</p>
      <div class="assignments">${assignmentRows || '<p>No worker capabilities defined.</p>'}</div>
      <form method="post" action="/settings/refresh-models" class="inline-form">
        <button type="submit" class="btn">↻ Refresh Models (discover from providers)</button>
      </form>
    </section>

    <section class="settings-section" id="social-section">
      <h3>Social Accounts & Publishing</h3>
      <p class="muted">Kelola akun social yang terhubung. Setiap akun divalidasi formatnya agar agent AI tidak salah posting. Penjadwalan publish ada di halaman <a href="/jobs">/jobs</a> (kalender).</p>

      <div class="social-toolbar">
        <button type="button" class="btn" id="add-account-btn">+ Tambah Akun Baru</button>
      </div>

      <h4>Daftar Channel / Akun</h4>
      <table class="telemetry-table social-table">
        <thead><tr><th>Nama</th><th>Platform</th><th>Account Ref</th><th>Status</th><th>Action</th></tr></thead>
        <tbody id="social-accounts-list">
          ${(social?.accounts ?? []).length === 0 ? '<tr><td colspan="5">Belum ada akun terhubung.</td></tr>' : ''}
        </tbody>
      </table>

      <!-- Popup: add new account -->
      <div class="modal-overlay" id="add-account-modal" hidden>
        <div class="modal">
          <h4>Hubungkan Akun Baru</h4>
          <form id="social-connect-form" class="brand-form">
            <label>Tenant ID
              <input name="tenant_id" value="demo" required>
            </label>
            <label>Platform
              <select name="platform" required>
                <option value="youtube">YouTube</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
              </select>
            </label>
            <label>Display Name
              <input name="display_name" placeholder="My Channel" required>
            </label>
            <label>Account Ref (channel/account id)
              <input name="account_ref" placeholder="UC... / @handle" required>
            </label>
            <label>Access Token
              <input name="access_token" placeholder="OAuth access token" required>
            </label>
            <div class="modal-actions">
              <button type="submit" class="btn">Connect</button>
              <button type="button" class="btn-clear" id="close-modal">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </section>
  `;

  return renderLayout({
    title: 'Settings',
    currentPage: 'settings',
    content,
    extraHead: '<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script><script type="module" src="/assets/settings-social.js"></script><script type="module" src="/assets/settings-providers.js"></script>',
  });
}

/** Render the brand edit form (for ?edit=<id> or ?edit=new). */
export function renderBrandEditPage(edit: string, data: SettingsOverview): string {
  const existing = edit !== 'new' ? data.tenants.find((t) => t.tenantId === edit) : undefined;
  const isNew = edit === 'new' || !existing;

  const content = `
    <h2>${isNew ? 'New Brand / Tenant' : `Edit Brand: ${esc(edit)}`}</h2>
    <form method="post" action="/settings/tenant-save" class="brand-form">
      <label>Tenant ID
        <input name="tenant_id" value="${isNew ? '' : esc(edit)}" ${isNew ? '' : 'readonly'} required>
      </label>
      <label>Brand Voice
        <textarea name="brand_voice" rows="4">${esc(existing?.brandVoice ?? '')}</textarea>
      </label>
      <label>Language
        <input name="language" value="${esc(existing ? 'en' : 'en')}">
      </label>
      <label>Forbidden Terms (comma separated)
        <input name="forbidden_terms" value="${esc('')}">
      </label>
      <button type="submit" class="btn">Save</button>
      <a href="/settings" class="btn-clear">Cancel</a>
    </form>
  `;

  return renderLayout({
    title: isNew ? 'New Brand' : `Edit ${edit}`,
    currentPage: 'settings',
    content,
  });
}
