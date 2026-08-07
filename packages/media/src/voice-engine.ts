// VoiceEngine — TTS adapter layer (ADR-0011 + ADR-0012).
//
// A MediaEngine implementation for voice (text → audio). Per ADR-0012, this is
// the ONLY vendor-aware layer in the voice path; the worker is capability-only
// and delegates the whole lifecycle to runMediaEngine. Engine-specific input
// ({ voice, speed }) and metadata ({ voice_id }) stay typed here — NOT forced
// into a shared payload (anti-leaky-abstraction).

import { synthesizeSpeech, type TtsResult } from './tts.js';
import { synthesizeSpeechReplicate } from './tts-replicate.js';
import type { MediaEngine, EngineContext } from './media-engine.js';

/** Voice engine-specific input (NOT standardized by MediaEngine). */
export interface VoiceEngineInput {
  text: string;
  voice?: string;
  speed?: number;
}

/** Voice engine-specific metadata (NOT standardized by MediaEngine). */
export interface VoiceEngineMeta {
  audio_path: string;
  duration_seconds: number;
  voice_id: string;
}

/** Backward-compatible result shape (kept for existing tests/callers). */
export interface VoiceEngineResult extends VoiceEngineMeta {
  provider: string;
  model: string;
  cost_estimate: number;
}

/** TTS engine: espeak-ng (offline, robot, free). */
const espeakEngine: MediaEngine<VoiceEngineInput, VoiceEngineMeta> = {
  provider: 'espeak-ng',
  model: 'espeak-ng',
  async run(_ctx, input) {
    const r: TtsResult = await synthesizeSpeech(_ctx.execution_id, input.text);
    return {
      refs: { voice_output: r.audio_path },
      cost_estimate: 0,
      metadata: { audio_path: r.audio_path, duration_seconds: r.duration_seconds, voice_id: r.voice_id },
    };
  },
};

/** TTS engine: Replicate Kokoro-82M (cloud, natural, ~$0.0023/run). */
const replicateKokoroEngine: MediaEngine<VoiceEngineInput, VoiceEngineMeta> = {
  provider: 'replicate',
  model: 'kokoro-82m',
  async run(ctx, input) {
    const r = await synthesizeSpeechReplicate(ctx.execution_id, input.text, {
      voice: input.voice,
      speed: input.speed,
    });
    return {
      refs: { voice_output: r.audio_path },
      cost_estimate: r.cost_estimate,
      metadata: { audio_path: r.audio_path, duration_seconds: r.duration_seconds, voice_id: r.voice_id },
    };
  },
};

const ENGINES: MediaEngine<VoiceEngineInput, VoiceEngineMeta>[] = [espeakEngine, replicateKokoroEngine];

/** Select the voice engine for a resolved { provider, model }; default espeak-ng. */
export function getVoiceEngine(
  provider: string | undefined,
  model: string | undefined,
): MediaEngine<VoiceEngineInput, VoiceEngineMeta> {
  if (!provider) return espeakEngine;
  return ENGINES.find((e) => e.provider === provider && (model === undefined || e.model === model)) ?? espeakEngine;
}

/** List all registered voice engines. */
export function listVoiceEngines(): Array<{ provider: string; model: string }> {
  return ENGINES.map((e) => ({ provider: e.provider, model: e.model }));
}

export type { EngineContext };
