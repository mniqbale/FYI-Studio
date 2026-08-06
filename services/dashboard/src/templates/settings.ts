// Settings "AI Workspace" page template — providers, model assignment, tenants.
import { renderLayout } from './layout.js';
import type { SettingsOverview } from '../utils/settings.js';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

export function renderSettingsPage(data: SettingsOverview): string {
  const { providers, assignments, tenants } = data;

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
        <form method="post" action="/settings/providers/${esc(p.id)}">
          ${p.connected
            ? `<button type="submit" name="action" value="disconnect" class="btn-danger">Disconnect</button>`
            : `<button type="submit" name="action" value="connect" class="btn">Connect</button>`}
        </form>
      </div>
    `)
    .join('');

  const assignmentRows = assignments
    .map((a) => `
      <div class="assign-row">
        <div class="assign-info">
          <strong>${esc(a.label)}</strong>
          <code>${esc(a.capability)}</code>
          <span class="muted">needs: ${esc(a.requiredModelCaps.join(', '))}</span>
        </div>
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
      </div>
    `)
    .join('');

  const tenantCards = tenants
    .map((t) => `
      <div class="tenant-card">
        <h3>${esc(t.tenantId)}</h3>
        <p class="muted">${esc((t.brandVoice || 'No brand voice set').slice(0, 90))}</p>
        <a href="/settings?edit=${encodeURIComponent(t.tenantId)}" class="btn">Edit</a>
        <form method="post" action="/settings/tenants/${encodeURIComponent(t.tenantId)}" class="inline-form" onsubmit="return confirm('Delete this tenant?')">
          <button type="submit" class="btn-danger">Delete</button>
        </form>
      </div>
    `)
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
      <p class="muted">Choose which AI model handles each worker. Only connected + capable models are shown.</p>
      <div class="assignments">${assignmentRows || '<p>No worker capabilities defined.</p>'}</div>
    </section>

    <section class="settings-section">
      <h3>Brands / Tenants</h3>
      <p class="muted">Manage brand voice, language, and forbidden terms per channel.</p>
      <div class="tenants-grid">${tenantCards || '<p>No tenants yet.</p>'}</div>
      <a href="/settings?edit=new" class="btn">+ New Brand</a>
    </section>
  `;

  return renderLayout({
    title: 'Settings',
    currentPage: 'settings',
    content,
    extraHead: '<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>',
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
