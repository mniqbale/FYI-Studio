// Unit tests for the VoiceEngine adapter layer (ADR-0011 + ADR-0012).
// Verifies engine selection by resolved { provider, model } and that the
// engine implements the unified MediaEngine lifecycle (run → refs/cost/metadata).
import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/tts.js', () => ({
  synthesizeSpeech: vi.fn().mockResolvedValue({
    audio_path: '/tmp/fyi-studio/x/narration.wav',
    duration_seconds: 3,
    voice_id: 'espeak-ng',
  }),
}));
vi.mock('../src/tts-replicate.js', () => ({
  synthesizeSpeechReplicate: vi.fn().mockResolvedValue({
    audio_path: '/tmp/fyi-studio/x/narration.mp3',
    duration_seconds: 4,
    voice_id: 'af_bella',
    provider: 'replicate',
    model: 'kokoro-82m',
    cost_estimate: 0.0023,
  }),
}));

import { getVoiceEngine, listVoiceEngines } from '../src/voice-engine.js';
import { runMediaEngine } from '../src/media-engine.js';

describe('VoiceEngine (MediaEngine lifecycle) selection', () => {
  it('resolves espeak-ng and runs through the shared lifecycle', async () => {
    const engine = getVoiceEngine('espeak-ng', 'espeak-ng');
    expect(engine.provider).toBe('espeak-ng');
    const outcome = await runMediaEngine(engine, { execution_id: 'exec-1' }, { text: 'hello' });
    expect(outcome.error).toBeUndefined();
    expect(outcome.refs.voice_output).toContain('narration.wav');
    expect(outcome.cost_estimate).toBe(0);
    expect(outcome.metadata?.audio_path).toContain('narration.wav');
    expect(outcome.telemetry.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('resolves replicate/kokoro-82m with real cost', async () => {
    const engine = getVoiceEngine('replicate', 'kokoro-82m');
    expect(engine.model).toBe('kokoro-82m');
    const outcome = await runMediaEngine(engine, { execution_id: 'exec-1' }, { text: 'hello', voice: 'af_bella' });
    expect(outcome.error).toBeUndefined();
    expect(outcome.refs.voice_output).toContain('narration.mp3');
    expect(outcome.cost_estimate).toBeGreaterThan(0);
  });

  it('falls back to espeak-ng for an unknown resolved engine', () => {
    expect(getVoiceEngine('some-future-vendor', 'm').provider).toBe('espeak-ng');
  });

  it('falls back to espeak-ng when no provider resolved', () => {
    expect(getVoiceEngine(undefined, undefined).provider).toBe('espeak-ng');
  });

  it('lists registered voice engines', () => {
    expect(listVoiceEngines()).toContainEqual({ provider: 'espeak-ng', model: 'espeak-ng' });
    expect(listVoiceEngines()).toContainEqual({ provider: 'replicate', model: 'kokoro-82m' });
  });
});
