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

  const providerCards = providers
    .map((p) => `
      <div class="provider-card">
        <div class="provider-head">
          <h4>${esc(p.name)}</h4>
          <span class="badge ${p.connected ? 'ok' : 'off'}">${p.connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <div class="provider-meta">
          <p><strong>ID:</strong> <code>${esc(p.id)}</code></p>
          <p><strong>API Key:</strong> ${p.requiresApiKey ? (p.keyConfigured ? '✅ configured' : '❌ not set') : 'not required'}</p>
          ${p.healthError ? `<p class="error-text">${esc(p.healthError)}</p>` : ''}
        </div>
        ${p.requiresApiKey ? `
          <form method="post" action="/settings/providers/${esc(p.id)}/key" class="key-form">
            <input type="password" name="api_key" placeholder="Paste ${esc(p.name)} API key" autocomplete="off">
            <button type="submit" class="btn">${p.keyConfigured ? 'Update Key' : 'Save Key'}</button>
          </form>
          ${p.keyConfigured ? `
            <form method="post" action="/settings/providers/${esc(p.id)}/key/delete" class="inline-form" onsubmit="return confirm('Delete this API key?')">
              <button type="submit" class="btn-danger">Delete Key</button>
            </form>
          ` : ''}
        ` : ''}
        <form method="post" action="/settings/providers/${esc(p.id)}">
          ${p.connected
            ? `<button type="submit" name="action" value="disconnect" class="btn-danger">Disconnect</button>`
            : `<button type="submit" name="action" value="connect" class="btn">Connect</button>`}
        </form>
      </div>
    `)
    .join('');

  const assignmentRows = assignments
    .map((a) => {
      const isLlm = a.candidates.length > 0 || a.current?.provider !== 'espeak-ng' && a.current?.provider !== 'ffmpeg' && a.current?.provider !== 'local';
      return `
      <div class="assign-row">
        <div class="assign-info">
          <strong>${esc(a.label)}</strong>
          <code>${esc(a.capability)}</code>
          <span class="muted">needs: ${esc(a.requiredModelCaps.join(', '))}</span>
          ${!isLlm ? `<span class="badge off">local engine</span>` : ''}
        </div>
        ${isLlm ? `
          <form method="post" action="/settings/assign" class="assign-form">
            <input type="hidden" name="capability" value="${esc(a.capability)}">
            <select name="model" class="model-select">
              <option value="">— ${a.current ? `Current: ${esc(a.current.provider)}/${esc(a.current.model)}` : 'no model assigned'} —</option>
              ${a.candidates
                .map((c) => `<option value="${esc(c.provider)}/${esc(c.model)}">${esc(c.provider)}/${esc(c.model)}</option>`)
                .join('')}
            </select>
            <button type="submit" class="btn">Assign</button>
          </form>
        ` : `<span class="muted">${esc(a.current?.provider ?? '')}/${esc(a.current?.model ?? '')}</span>`}
      </div>
    `;
    })
    .join('');

  const content = `
    <h2>Settings — AI Workspace</h2>

    <section class="settings-section">
      <h3>AI Providers</h3>
      <p class="muted">Connect the AI providers (Claude, Gemini, Ollama, ChatGPT, etc.). Keys are read from your environment / .env — never stored.</p>
      <div class="providers-grid">${providerCards || '<p>No providers.</p>'}</div>
    </section>

    <section class="settings-section">
      <h3>Model Assignment per Task</h3>
      <p class="muted">Choose which AI model handles each worker. Only connected + capable models are shown. Media workers (voice/subtitle/video) use local offline engines.</p>
      <div class="assignments">${assignmentRows || '<p>No worker capabilities defined.</p>'}</div>
      <form method="post" action="/settings/refresh-models" class="inline-form">
        <button type="submit" class="btn">↻ Refresh Models (discover from providers)</button>
      </form>
    </section>

    <section class="settings-section">
      <h3>Brands / Tenants</h3>
      <p class="muted">Kelola brand voice, bahasa, dan forbidden terms per channel di halaman <a href="/tenants">/tenants</a>.</p>
      <a href="/tenants" class="btn">Buka halaman Tenants</a>
    </section>

    <section class="settings-section" id="social-section">
      <h3>Social Accounts & Publishing</h3>
      <p class="muted">Connect a YouTube / Facebook / Instagram / TikTok account. Setiap akun divalidasi formatnya agar agent AI tidak salah posting. Penjadwalan publish ada di halaman <a href="/jobs">/jobs</a> (kalender).</p>

      <div class="social-connect">
        <h4>Connect account</h4>
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
          <button type="submit" class="btn">Connect</button>
        </form>
      </div>

      <h4>Connected accounts</h4>
      <div class="social-accounts" id="social-accounts-list">
        ${(social?.accounts ?? []).length === 0 ? '<p class="muted">No connected accounts.</p>' : ''}
      </div>
    </section>
  `;

  return renderLayout({
    title: 'Settings',
    currentPage: 'settings',
    content,
    extraHead: '<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script><script type="module" src="/assets/settings-social.js"></script>',
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
