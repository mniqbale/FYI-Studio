// Settings social section — connect/disconnect social accounts (WS-D).
// Renders accounts as a table, with a popup modal to add a new account.
// Interacts with the local /api/social/* endpoints (no platform API).
const DEFAULT_TENANT = 'demo';

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

async function loadAccounts() {
  const res = await fetch(`/api/social?tenant_id=${DEFAULT_TENANT}`);
  const accounts = await res.json();
  const tbody = document.getElementById('social-accounts-list');
  if (!tbody) return;
  if (accounts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">Belum ada akun terhubung.</td></tr>';
    return;
  }
  tbody.innerHTML = accounts
    .map(
      (a) => `
      <tr>
        <td><strong>${esc(a.display_name)}</strong></td>
        <td>${esc(a.platform)}</td>
        <td><code>${esc(a.account_ref)}</code></td>
        <td><span class="badge ${a.enabled ? 'ok' : 'off'}">${a.enabled ? 'connected' : 'disabled'}</span></td>
        <td><button class="btn-danger btn-small" data-id="${a.id}" data-action="disconnect">Disconnect</button></td>
      </tr>
    `,
    )
    .join('');
  tbody.querySelectorAll('[data-action="disconnect"]').forEach((btn) => {
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
  // Show OAuth result from the callback redirect (?oauth=success|error).
  const params = new URLSearchParams(window.location.search);
  const oauth = params.get('oauth');
  const statusEl = document.getElementById('oauth-status');
  if (statusEl && oauth) {
    if (oauth === 'success') {
      const channel = params.get('channel') ?? '';
      statusEl.innerHTML = `<span class="badge ok">✅ YouTube terhubung: ${esc(channel)}</span>`;
    } else {
      const reason = params.get('reason') ?? 'unknown';
      statusEl.innerHTML = `<span class="badge off">⚠️ OAuth gagal: ${esc(reason)}</span>`;
    }
  }

  const addBtn = document.getElementById('add-account-btn');
  const modal = document.getElementById('add-account-modal');
  const closeBtn = document.getElementById('close-modal');
  const connectForm = document.getElementById('social-connect-form');

  if (addBtn && modal) {
    addBtn.addEventListener('click', () => { modal.hidden = false; });
  }
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => { modal.hidden = true; });
  }

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
      if (out.ok) {
        modal.hidden = true;
        await loadAccounts();
      }
    });
  }

  await loadAccounts();
});
