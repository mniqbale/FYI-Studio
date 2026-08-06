// FYI Studio Dashboard — shared polling helper (browser ESM, zero deps).
export function startPolling(url, onData, options = {}) {
  const { intervalMs = 2000, onError } = options;
  let stopped = false;
  let timer = null;

  async function tick() {
    if (stopped) return;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onData(await res.json());
    } catch (e) {
      onError && onError(e);
    }
    if (!stopped) timer = setTimeout(() => void tick(), intervalMs);
  }

  void tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
