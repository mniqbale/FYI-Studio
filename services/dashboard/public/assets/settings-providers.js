// Settings — explicit API key validation (WS-A, round 2).
// Validation happens ONLY when the user clicks the "Validate" button — NOT on
// every keystroke (which would spam the provider API and risk rate-limits).
// Shows an inline status (valid / invalid / unreachable). No key is persisted.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('form[data-validate]').forEach((form) => {
    const provider = form.dataset.validate;
    const input = form.querySelector('input[name="api_key"]');
    const status = form.querySelector('.key-status');
    const validateBtn = form.querySelector('.validate-btn');
    if (!input || !status || !validateBtn) return;

    validateBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const key = input.value.trim();
      if (!key) {
        status.textContent = 'Masukkan API key dulu';
        status.className = 'key-status err';
        return;
      }
      status.textContent = 'Validating…';
      status.className = 'key-status validating';
      validateBtn.disabled = true;
      try {
        const res = await fetch(`/api/settings/providers/${provider}/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: key }),
        });
        const out = await res.json();
        if (out.ok) {
          status.textContent = '✅ Valid';
          status.className = 'key-status ok';
        } else {
          status.textContent = `❌ ${out.reason || 'Invalid'}`;
          status.className = 'key-status err';
        }
      } catch {
        status.textContent = '❌ Cannot reach provider';
        status.className = 'key-status err';
      } finally {
        validateBtn.disabled = false;
      }
    });
  });
});
