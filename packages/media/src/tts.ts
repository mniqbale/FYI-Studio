// Text-to-Speech adapter (Milestone 5). Uses espeak-ng (offline, no quota) as
// the working provider — no API key, no cloud. Later replace with ElevenLabs/
// Azure TTS via ModelGate without changing the worker.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { execMediaDir } from './data-plane.js';
import { probeDuration } from './probe.js';

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

  // Report ACTUAL duration via ffprobe (same method as the video engine) so
  // voice.duration and video.duration agree on the same audio file.
  const duration_seconds = Math.round(await probeDuration(outPath, 1));

  return { audio_path: outPath, duration_seconds, voice_id: 'espeak-ng' };
}
