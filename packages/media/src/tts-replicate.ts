// Text-to-Speech via Replicate (Kokoro-82M) — cloud, ~$0.0023/run.
//
// Unlike espeak-ng (offline, robot voice), this uses Replicate's hosted
// Kokoro-82M model for natural voices. Requires REPLICATE_API_TOKEN. The audio
// file is written into the local data plane (/tmp/fyi-studio/<exec>/narration.mp3)
// so the rest of the pipeline (subtitle, video) works unchanged.
//
// Reference: https://replicate.com/jaaari/kokoro-82m

import { join } from 'node:path';
import { writeFile, stat } from 'node:fs/promises';
import { execMediaDir } from './data-plane.js';

export interface ReplicateTtsResult {
  audio_path: string;
  duration_seconds: number;
  voice_id: string;
  provider: 'replicate';
  model: 'kokoro-82m';
  cost_estimate: number;
}

// Real version hash for jaaari/kokoro-82m (T4 GPU), pulled from Replicate's
// versions page — NOT invented.
const REPLICATE_VERSION = 'f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13';
const BASE = 'https://api.replicate.com/v1';
const COST_PER_RUN = 0.0023;

/** Estimate WAV duration (bytes / bytes-per-second) for the fallback path. */
function estimateSeconds(bytes: number, sampleRate = 24000): number {
  const bytesPerSecond = sampleRate * 2; // 16-bit mono
  return bytes > 0 ? Math.max(1, Math.round(bytes / bytesPerSecond)) : 1;
}

/**
 * Synthesize narration text to audio via Replicate Kokoro-82M.
 * Downloads the returned MP3/WAV into the local media dir.
 */
export async function synthesizeSpeechReplicate(
  execution_id: string,
  text: string,
  opts: { voice?: string; speed?: number } = {},
): Promise<ReplicateTtsResult> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('TTS-Replicate: REPLICATE_API_TOKEN is not set. Add it to .env');
  if (!text || !text.trim()) throw new Error('TTS-Replicate: no narration text provided');

  const { dir } = execMediaDir(execution_id);
  const outPath = join(dir, 'narration.mp3');

  // 1. Create a prediction on Replicate.
  const create = await fetch(`${BASE}/predictions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait' },
    body: JSON.stringify({
      version: REPLICATE_VERSION,
      input: { text, voice: opts.voice ?? 'af_bella', speed: opts.speed ?? 1 },
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!create.ok) {
    const body = await create.text().catch(() => '');
    throw new Error(`TTS-Replicate: create prediction failed (HTTP ${create.status}): ${body.slice(0, 200)}`);
  }
  const prediction = (await create.json()) as { status: string; output?: string | string[]; error?: string };

  if (prediction.status === 'failed' || prediction.error) {
    throw new Error(`TTS-Replicate: prediction failed: ${prediction.error ?? 'unknown'}`);
  }
  if (!prediction.output) {
    throw new Error('TTS-Replicate: no output URL returned');
  }
  const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;

  // 2. Download the audio.
  const audio = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!audio.ok) throw new Error(`TTS-Replicate: failed to download audio (HTTP ${audio.status})`);
  const buf = Buffer.from(await audio.arrayBuffer());
  await writeFile(outPath, buf);

  const size = (await stat(outPath)).size;
  return {
    audio_path: outPath,
    duration_seconds: estimateSeconds(size),
    voice_id: opts.voice ?? 'af_bella',
    provider: 'replicate',
    model: 'kokoro-82m',
    cost_estimate: COST_PER_RUN,
  };
}

/** Convenience: pick espeak-ng (offline) or Replicate Kokoro based on env. */
export async function synthesizeSpeechSmart(
  execution_id: string,
  text: string,
  opts: { voice?: string; speed?: number } = {},
): Promise<ReplicateTtsResult | { audio_path: string; duration_seconds: number; voice_id: string; provider: string; model: string; cost_estimate: number }> {
  if (process.env.TTS_PROVIDER === 'replicate' && process.env.REPLICATE_API_TOKEN) {
    return synthesizeSpeechReplicate(execution_id, text, opts);
  }
  // Fallback to espeak-ng (offline).
  const { synthesizeSpeech } = await import('./tts.js');
  const r = await synthesizeSpeech(execution_id, text);
  return { ...r, provider: 'espeak-ng', model: 'espeak-ng', cost_estimate: 0 };
}
