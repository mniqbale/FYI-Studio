// Settings social section — connect/disconnect social accounts + schedule publish.
// Interacts with the local /api/social/* endpoints (no platform API calls).
const DEFAULT_TENANT = 'demo';

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

async function loadAccounts() {
  const res = await fetch(`/api/social?tenant_id=${DEFAULT_TENANT}`);
  const accounts = await res.json();
  const list = document.getElementById('social-accounts-list');
  const select = document.getElementById('schedule-account-select');
  if (!list || !select) return;
  if (accounts.length === 0) {
    list.innerHTML = '<p class="muted">No connected accounts.</p>';
    select.innerHTML = '<option value="">— no account —</option>';
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
  select.innerHTML = accounts
    .filter((a) => a.enabled)
    .map((a) => `<option value="${a.id}">${esc(a.display_name)} (${esc(a.platform)})</option>`)
    .join('');
  list.querySelectorAll('[data-action="disconnect"]').forEach((btn) => {
    btn.addEventListener('click', () => disconnect(btn.dataset.id));
  });
}

async function loadSchedules() {
  const res = await fetch(`/api/social/schedules?tenant_id=${DEFAULT_TENANT}`);
  const schedules = await res.json();
  const list = document.getElementById('schedules-list');
  if (!list) return;
  if (schedules.length === 0) {
    list.innerHTML = '<p class="muted">No scheduled publishes.</p>';
    return;
  }
  list.innerHTML = schedules
    .map(
      (s) => `
      <div class="account-chip">
        <strong>${esc(s.job_id.slice(0, 8))}</strong> · ${esc(s.scheduled_at)} · <span class="badge ok">${esc(s.status)}</span>
        <span class="muted">attempts: ${s.attempts}</span>
      </div>
    `,
    )
    .join('');
}

async function disconnect(id) {
  await fetch(`/api/social/${id}/disconnect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: DEFAULT_TENANT }),
  });
  await Promise.all([loadAccounts(), loadSchedules()]);
}

document.addEventListener('DOMContentLoaded', async () => {
  const connectForm = document.getElementById('social-connect-form');
  const scheduleForm = document.getElementById('schedule-form');

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
      if (out.ok) await Promise.all([loadAccounts(), loadSchedules()]);
    });
  }

  if (scheduleForm) {
    scheduleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(scheduleForm);
      const payload = Object.fromEntries(fd.entries());
      payload.tenant_id = payload.tenant_id || DEFAULT_TENANT;
      // datetime-local -> ISO UTC
      if (payload.scheduled_at) payload.scheduled_at = new Date(payload.scheduled_at).toISOString();
      const res = await fetch('/api/social/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const out = await res.json();
      alert(out.ok ? 'Scheduled!' : `Error: ${out.error}`);
      scheduleForm.reset();
      if (out.ok) await loadSchedules();
    });
  }

  await Promise.all([loadAccounts(), loadSchedules()]);
});
