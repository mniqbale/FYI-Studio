// Text-to-Speech adapter (Milestone 5). Uses espeak-ng (offline, no quota) as
// the working provider — no API key, no cloud. Later replace with ElevenLabs/
// Azure TTS via ModelGate without changing the worker.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { execMediaDir } from './data-plane.js';

const execFileAsync = promisify(execFile);

export interface TtsResult {
  audio_path: string;
  duration_seconds: number;
  voice_id: string;
}

/** Synthesize narration text to a WAV file via espeak-ng. Returns result + path. */
export async function synthesizeSpeech(execution_id: string, text: string): Promise<TtsResult> {
  if (!text || !text.trim()) throw new Error('TTS: no narration text provided');
  const { dir } = execMediaDir(execution_id);
  const outPath = join(dir, 'narration.wav');

  // espeak-ng writes directly to a WAV file with `-w`.
  await execFileAsync('espeak-ng', ['-w', outPath, text], { maxBuffer: 64 * 1024 * 1024 });

  const { statSync } = await import('node:fs');
  const size = statSync(outPath).size;
  // Rough duration estimate: ~16ms of audio per byte at 8kHz mono 16-bit (espeak default ~8kHz).
  const bytesPerSecond = 8000 * 2; // 8kHz * 16bit
  const duration_seconds = size > 0 ? Math.max(1, Math.round(size / bytesPerSecond)) : 1;

  return { audio_path: outPath, duration_seconds, voice_id: 'espeak-ng' };
}
