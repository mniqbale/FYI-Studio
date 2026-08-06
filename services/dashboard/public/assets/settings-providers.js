// Settings — inline API key validation (WS-A). When the user types a key and
// blurs, validate it against the real provider API and show an inline status
// (valid / invalid / unreachable) BEFORE they submit. No key is persisted here.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('form[data-validate]').forEach((form) => {
    const provider = form.dataset.validate;
    const input = form.querySelector('input[name="api_key"]');
    const status = form.querySelector('.key-status');
    if (!input || !status) return;

    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      status.textContent = '';
      status.className = 'key-status';
      timer = setTimeout(async () => {
        const key = input.value.trim();
        if (!key) return;
        status.textContent = 'Validating…';
        status.className = 'key-status validating';
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
        }
      }, 600);
    });
  });
});
