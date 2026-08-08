// Shared media probe helpers (Phase 2.5 — duration correctness).
//
// Single source of truth for measuring ACTUAL media duration. Both the voice
// and video engines report duration via ffprobe so that voice.duration and
// video.duration are measured the SAME way on the SAME audio file — eliminating
// the estimate-vs-actual mismatch that caused voice/video duration drift.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Probe an audio/video file's ACTUAL duration (seconds) via ffprobe.
 * Returns a positive finite number, or `fallback` when probing fails.
 */
export async function probeDuration(audioPath: string, fallback = 10): Promise<number> {
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audioPath],
      { maxBuffer: 4 * 1024 * 1024 },
    );
    const sec = Number.parseFloat(stdout.trim());
    return Number.isFinite(sec) && sec > 0 ? sec : fallback;
  } catch {
    return fallback;
  }
}
