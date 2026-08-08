// Thumbnail Composer — Phase 2.8 SPIKE (reference implementation, NOT production).
//
// Proves the MediaEngine abstraction (ADR-0012) can carry image compositing for
// thumbnails. Derives visual direction from Channel visual_identity (palette +
// style) + title/hook, and renders a static thumbnail via FFmpeg (offline, free).
//
// This is deliberately a spike: one engine, no vendor, no registry expansion.
// It answers "does Channel DNA + Brief + Title/Hook -> Thumbnail, and do Facts
// vs Sports produce different visual direction?" before any production worker.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { execMediaDir } from './data-plane.js';

const execFileAsync = promisify(execFile);

export interface ThumbnailInput {
  execution_id: string;
  /** Creative direction — the Script worker's title (overlay text). */
  title: string;
  /** Creative direction — the Script worker's hook (secondary line). */
  hook?: string;
  /** Channel visual_identity (from tenant_context.constraints). */
  visual_identity: { style?: string; palette?: string };
  /** Output resolution, e.g. "1280x720" (YouTube) or "1080x1920" (vertical). */
  resolution?: string;
}

export interface ThumbnailResult {
  thumbnail_path: string;
  resolution: string;
  format: 'png';
}

/** Map a Channel palette string to a solid FFmpeg background color. */
export function paletteToColor(palette: string | undefined): string {
  const p = (palette ?? '').toLowerCase();
  // Black is the base of "black / neon green / white" — check it first so the
  // background is black and neon green is used as the accent (text) color.
  if (p.includes('black')) return '0x0a0a0a';
  if (p.includes('neon green') || p.includes('green')) return '0x00ff66';
  if (p.includes('blue')) return '0x1e3a8a';
  if (p.includes('white') || p.includes('gray')) return '0x334155';
  return '0x0d0d1a';
}

/** Map a Channel style string to a text color (contrast against the bg). */
export function styleToTextColor(style: string | undefined, bg: string): string {
  const s = (style ?? '').toLowerCase();
  // On dark backgrounds use white; on light use dark.
  const isDark = bg === '0x0a0a0a' || bg === '0x0d0d1a' || bg === '0x1e3a8a' || bg === '0x334155';
  if (s.includes('high-contrast') || s.includes('bold')) return isDark ? '0x00ff66' : '0x000000';
  return isDark ? '0xffffff' : '0x000000';
}

/**
 * Compose a static thumbnail PNG from Channel visual_identity + title/hook.
 * Uses a solid palette background + title overlay (and hook as a second line).
 */
export async function composeThumbnail(input: ThumbnailInput): Promise<ThumbnailResult> {
  const { dir } = execMediaDir(input.execution_id);
  const resolution = input.resolution ?? '1280x720';
  const outPath = join(dir, 'thumbnail.png');

  const bg = paletteToColor(input.visual_identity.palette);
  const textColor = styleToTextColor(input.visual_identity.style, bg);

  // Escape single quotes, commas, and colons for the drawtext filter (commas
  // and colons are filter separators in ffmpeg).
  const esc = (s: string): string => s.replace(/'/g, "\\'").replace(/,/g, '\\,').replace(/:/g, '\\:');
  const title = input.title ? esc(input.title) : 'FYI Studio';
  const hook = input.hook ? esc(input.hook) : '';

  // Title at ~8% height, hook below it (smaller). Both centered horizontally.
  const titleFilter = `drawtext=text='${title}':x=(w-text_w)/2:y=h*0.08:fontsize=56:fontcolor=${textColor}:box=1:boxcolor=black@0.45:boxborderw=20:line_spacing=8`;
  const hookFilter = hook
    ? `,drawtext=text='${hook}':x=(w-text_w)/2:y=h*0.55:fontsize=32:fontcolor=${textColor}:box=1:boxcolor=black@0.35:boxborderw=14`
    : '';

  const args = [
    '-y',
    '-f', 'lavfi', '-i', `color=c=${bg}:s=${resolution}:d=1`,
    '-vf', `${titleFilter}${hookFilter}`,
    '-frames:v', '1',
    outPath,
  ];

  await execFileAsync('ffmpeg', args, { maxBuffer: 64 * 1024 * 1024 });

  const size = statSync(outPath).size;
  if (size === 0) throw new Error('ThumbnailCompose: ffmpeg produced empty output');

  return { thumbnail_path: outPath, resolution, format: 'png' };
}
