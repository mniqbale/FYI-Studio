// Unit tests for the VoiceEngine adapter layer (ADR-0011 reference impl).
// Verifies that a worker picks the right engine by resolved { provider, model }
// WITHOUT the worker knowing the vendor — the factory is the only vendor-aware
// layer. No real synthesis/network here (mocked); just adapter selection.
import { describe, it, expect, vi } from 'vitest';

// Mock the underlying synthesis modules so no real espeak/network runs.
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

describe('VoiceEngine adapter selection (ADR-0011)', () => {
  it('resolves espeak-ng when provider/model is espeak-ng', async () => {
    const engine = getVoiceEngine('espeak-ng', 'espeak-ng');
    expect(engine.provider).toBe('espeak-ng');
    const r = await engine.synthesize('exec-1', 'hello');
    expect(r.provider).toBe('espeak-ng');
    expect(r.cost_estimate).toBe(0);
    expect(r.audio_path).toContain('narration.wav');
  });

  it('resolves replicate/kokoro-82m for a cloud voice engine', async () => {
    const engine = getVoiceEngine('replicate', 'kokoro-82m');
    expect(engine.provider).toBe('replicate');
    expect(engine.model).toBe('kokoro-82m');
    const r = await engine.synthesize('exec-1', 'hello', { voice: 'af_bella' });
    expect(r.provider).toBe('replicate');
    expect(r.model).toBe('kokoro-82m');
    expect(r.cost_estimate).toBeGreaterThan(0);
    expect(r.audio_path).toContain('narration.mp3');
  });

  it('falls back to espeak-ng for an unknown resolved engine (worker stays capability-only)', async () => {
    const engine = getVoiceEngine('some-future-vendor', 'some-model');
    expect(engine.provider).toBe('espeak-ng');
  });

  it('falls back to espeak-ng when no provider resolved (ModelGate failure)', async () => {
    const engine = getVoiceEngine(undefined, undefined);
    expect(engine.provider).toBe('espeak-ng');
  });

  it('lists registered voice engines', () => {
    const list = listVoiceEngines();
    expect(list).toContainEqual({ provider: 'espeak-ng', model: 'espeak-ng' });
    expect(list).toContainEqual({ provider: 'replicate', model: 'kokoro-82m' });
  });
});
