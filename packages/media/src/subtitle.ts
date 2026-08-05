// Subtitle generator (Milestone 5). Converts narration/script text into an
// SRT subtitle file. MVP: splits narration into timed cues by word count and
// estimated narration rate.

import { join } from 'node:path';
import { execMediaDir, writeTextAsset } from './data-plane.js';

/** Estimate narration duration (seconds) for a piece of text (words per minute). */
export function estimateDuration(text: string, wpm = 150): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 1;
  return Math.max(1, Math.round((words / wpm) * 60));
}

/** Split text into timed SRT cues (~8-12 words each). */
export function buildSrt(text: string, startSec = 0): string {
  const sentences = text
    .trim()
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const cues: Array<{ from: number; to: number; text: string }> = [];
  let cursor = startSec;

  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).filter(Boolean);
    const totalSec = estimateDuration(sentence);
    // Split long sentences into chunks of ~10 words.
    const chunk = 10;
    for (let i = 0; i < words.length; i += chunk) {
      const slice = words.slice(i, i + chunk).join(' ');
      const chunkSec = Math.max(1, Math.round((slice.split(' ').length / 150) * 60));
      cues.push({ from: cursor, to: cursor + chunkSec, text: slice });
      cursor += chunkSec;
    }
    // Ensure minimum gap between sentences.
    if (totalSec > cursor - startSec) cursor = startSec + totalSec;
  }

  const fmt = (s: number): string => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  };

  return cues.map((c, i) => `${i + 1}\n${fmt(c.from)} --> ${fmt(c.to)}\n${c.text}\n`).join('\n');
}

/** Generate an SRT file for an execution and return { srt_path, cues, total_duration }. */
export function generateSubtitles(execution_id: string, narration: string): { srt_path: string; cues: number; total_duration: number } {
  const srt = buildSrt(narration);
  const srtPath = writeTextAsset(execution_id, 'subtitles.srt', srt);
  const cueCount = (srt.match(/\n\n/g) ?? []).length + 1;
  const total = estimateDuration(narration);
  return { srt_path: srtPath, cues: cueCount, total_duration: total };
}

export { execMediaDir };
