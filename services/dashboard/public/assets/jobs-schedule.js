// Jobs page — schedule a publish for an approved job (WS-5).
// Interacts with the local /api/social/schedule endpoint (no platform API).
const DEFAULT_TENANT = 'demo';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('schedule-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    payload.tenant_id = payload.tenant_id || DEFAULT_TENANT;
    if (payload.scheduled_at) payload.scheduled_at = new Date(payload.scheduled_at).toISOString();
    const res = await fetch('/api/social/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const out = await res.json();
    alert(out.ok ? '✅ Konten dijadwalkan!' : `Error: ${out.error}`);
    if (out.ok) window.location.reload();
  });
});
