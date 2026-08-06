// Settings social section — connect/disconnect social accounts (WS-4).
// Interacts with the local /api/social/* endpoints (no platform API).
// Scheduling moved to /jobs (WS-5).
const DEFAULT_TENANT = 'demo';

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

async function loadAccounts() {
  const res = await fetch(`/api/social?tenant_id=${DEFAULT_TENANT}`);
  const accounts = await res.json();
  const list = document.getElementById('social-accounts-list');
  if (!list) return;
  if (accounts.length === 0) {
    list.innerHTML = '<p class="muted">No connected accounts.</p>';
    return;
  }
  list.innerHTML = accounts
    .map(
      (a) => `
      <div class="account-chip">
        <strong>${esc(a.display_name)}</strong> · ${esc(a.platform)} · <code>${esc(a.account_ref)}</code>
        <span class="badge ${a.enabled ? 'ok' : 'off'}">${a.enabled ? 'connected' : 'disabled'}</span>
        <button class="btn-danger btn-small" data-id="${a.id}" data-action="disconnect">Disconnect</button>
      </div>
    `,
    )
    .join('');
  list.querySelectorAll('[data-action="disconnect"]').forEach((btn) => {
    btn.addEventListener('click', () => disconnect(btn.dataset.id));
  });
}

async function disconnect(id) {
  await fetch(`/api/social/${id}/disconnect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: DEFAULT_TENANT }),
  });
  await loadAccounts();
}

document.addEventListener('DOMContentLoaded', async () => {
  const connectForm = document.getElementById('social-connect-form');

  if (connectForm) {
    connectForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(connectForm);
      const payload = Object.fromEntries(fd.entries());
      payload.tenant_id = payload.tenant_id || DEFAULT_TENANT;
      const res = await fetch('/api/social/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const out = await res.json();
      alert(out.ok ? `Connected ${out.account.platform} account` : `Error: ${out.error}`);
      connectForm.reset();
      if (out.ok) await loadAccounts();
    });
  }

  await loadAccounts();
});
