// VoiceEngine adapter layer (ADR-0011 — Capability-Only Worker Invariant).
//
// This is the ONLY place in the voice path that knows a vendor/engine identity.
// A worker resolves a capability (e.g. "voice:tts") via ModelGate to get
// { provider, model }, then asks this factory for the matching adapter. Adding a
// new voice engine (ElevenLabs, Azure, Kokoro, ...) = add an adapter here +
// register it; the worker code is untouched.
//
// Uniform interface: every voice engine implements `synthesize` and returns the
// same shape, so callers (workers) never branch on provider.

import { synthesizeSpeech, type TtsResult } from './tts.js';
import { synthesizeSpeechReplicate } from './tts-replicate.js';

/** Uniform result of any voice engine synthesis. */
export interface VoiceEngineResult {
  audio_path: string;
  duration_seconds: number;
  voice_id: string;
  provider: string;
  model: string;
  cost_estimate: number;
}

export interface VoiceEngine {
  readonly provider: string;
  readonly model: string;
  /** Synthesize narration text to an audio file in the execution media dir. */
  synthesize(execution_id: string, text: string, opts?: { voice?: string; speed?: number }): Promise<VoiceEngineResult>;
}

/** espeak-ng — offline, no quota, robot voice. Default fallback engine. */
const espeakEngine: VoiceEngine = {
  provider: 'espeak-ng',
  model: 'espeak-ng',
  async synthesize(execution_id, text, opts) {
    const r: TtsResult = await synthesizeSpeech(execution_id, text);
    return { ...r, provider: 'espeak-ng', model: 'espeak-ng', cost_estimate: 0 };
  },
};

/** Replicate Kokoro-82M — cloud, natural voice, ~$0.0023/run. */
const replicateKokoroEngine: VoiceEngine = {
  provider: 'replicate',
  model: 'kokoro-82m',
  async synthesize(execution_id, text, opts) {
    const r = await synthesizeSpeechReplicate(execution_id, text, {
      voice: opts?.voice,
      speed: opts?.speed,
    });
    return { ...r, provider: 'replicate', model: 'kokoro-82m' };
  },
};

const ENGINES: VoiceEngine[] = [espeakEngine, replicateKokoroEngine];

/**
 * Select the voice engine adapter for a resolved { provider, model }.
 * Falls back to espeak-ng (offline) when the resolved engine is unknown or the
 * provider is not a recognized voice engine — the worker stays capability-only.
 */
export function getVoiceEngine(provider: string | undefined, model: string | undefined): VoiceEngine {
  if (!provider) return espeakEngine;
  const engine = ENGINES.find((e) => e.provider === provider && (model === undefined || e.model === model));
  return engine ?? espeakEngine;
}

/** List all registered voice engine providers (for registry/discovery). */
export function listVoiceEngines(): Array<{ provider: string; model: string }> {
  return ENGINES.map((e) => ({ provider: e.provider, model: e.model }));
}
