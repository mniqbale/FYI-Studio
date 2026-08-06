// Human-readable rendering + JSON download helpers for job artifacts.
//
// Point 6: artifacts shown as readable text (not raw JSON) with a "Download
// JSON" button (individual, or all as a single ZIP).
// Point 7: a References/Bibliography section derived from research sources.
//
// The ZIP writer uses the STORE method (no compression) — pure Node, no dep,
// satisfying the Anti-Monster "prefer native" rule. CRC32 is computed by hand.

/** Extract a human-readable value from an artifact object for a known key. */
export function humanReadable(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    // If it's an array of simple values, join them; otherwise pretty-print.
    if (value.every((v) => typeof v === 'string' || typeof v === 'number')) return value.join(', ');
    return JSON.stringify(value, null, 2);
  }
  // Object — pick the most useful scalar field for a concise one-liner.
  const obj = value as Record<string, unknown>;
  const prio = ['summary', 'title', 'script', 'text', 'content', 'description', 'name', 'url'];
  for (const p of prio) {
    if (typeof obj[p] === 'string') return obj[p];
  }
  const readable = Object.entries(obj)
    .filter(([k, v]) => k !== '_references' && (typeof v === 'string' || typeof v === 'number'))
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
  if (readable) return readable;
  return JSON.stringify(value, null, 2);
}

/** Extract reference URLs/sources for the Bibliography section (point 7). */
export function extractSources(artifacts: Record<string, unknown>): string[] {
  const sources: string[] = [];
  const seen = new Set<string>();
  const add = (s: unknown): void => {
    if (typeof s === 'string' && !seen.has(s)) {
      seen.add(s);
      sources.push(s);
    }
  };
  for (const value of Object.values(artifacts)) {
    if (!value || typeof value !== 'object') continue;
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.sources)) {
      for (const s of obj.sources) {
        if (typeof s === 'string') add(s);
        else if (s && typeof s === 'object') {
          const so = s as Record<string, unknown>;
          if (typeof so.url === 'string') add(so.url);
          else if (typeof so.title === 'string') add(`${so.title}${so.url ? ` — ${so.url}` : ''}`);
        }
      }
    }
    // Also scan for any *_url / url fields that look like references.
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && (k === 'url' || k.endsWith('_url')) && (v.startsWith('http') || v.startsWith('https'))) {
        add(v);
      }
    }
  }
  return sources;
}

/** Serialize the full artifact set as a pretty JSON string. */
export function serializeArtifacts(artifacts: Record<string, unknown>): string {
  return JSON.stringify(artifacts, null, 2);
}

// ---- Minimal ZIP writer (STORE method, no compression) ----

/** CRC-32 (IEEE 802.3) — pure JS table-driven. Exported for testing. */
export function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Build a ZIP archive in memory (STORE method). Returns a Buffer.
 * @param files map of filename -> content (string or Buffer).
 */
export function buildZip(files: Record<string, string | Buffer>): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const entries = Object.entries(files);

  for (const [name, content] of entries) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // local file header signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0x0800, 6); // general purpose: UTF-8
    localHeader.writeUInt16LE(0, 8); // compression method: STORE
    localHeader.writeUInt32LE(0, 10); // mod time/date
    localHeader.writeUInt32LE(0, 12); // crc32 (high) — set low below
    localHeader.writeUInt32LE(crc, 14); // crc-32
    localHeader.writeUInt32LE(data.length, 18); // compressed size
    localHeader.writeUInt32LE(data.length, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26); // filename length
    localHeader.writeUInt16LE(0, 28); // extra length
    chunks.push(localHeader, nameBuf, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // central dir signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0x0800, 8); // general purpose
    centralHeader.writeUInt16LE(0, 10); // method
    centralHeader.writeUInt32LE(0, 12); // time/date
    centralHeader.writeUInt32LE(crc, 16); // crc-32
    centralHeader.writeUInt32LE(data.length, 20); // compressed
    centralHeader.writeUInt32LE(data.length, 24); // uncompressed
    centralHeader.writeUInt16LE(nameBuf.length, 28); // filename length
    centralHeader.writeUInt16LE(0, 30); // extra
    centralHeader.writeUInt16LE(0, 32); // comment
    centralHeader.writeUInt16LE(0, 34); // disk start
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42); // local header offset
    central.push(centralHeader, nameBuf);

    offset += 30 + nameBuf.length + data.length;
  }

  const centralOffset = chunks.reduce((n, b) => n + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // end of central dir signature
  eocd.writeUInt16LE(entries.length, 8); // total entries (disk)
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(central.reduce((n, b) => n + b.length, 0), 12); // central size
  eocd.writeUInt32LE(centralOffset, 16); // central offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...chunks, ...central, eocd]);
}

/** Flatten artifacts into { filename -> JSON string } for the ZIP download. */
export function artifactsAsZipFiles(artifacts: Record<string, unknown>): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [key, value] of Object.entries(artifacts)) {
    if (key === '_references') continue; // merge references into a single file below
    files[`artifact-${key}.json`] = JSON.stringify(value, null, 2);
  }
  if (artifacts._references) {
    files['references.json'] = JSON.stringify(artifacts._references, null, 2);
  }
  files['all-artifacts.json'] = JSON.stringify(artifacts, null, 2);
  return files;
}
