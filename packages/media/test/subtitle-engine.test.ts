// Unit tests for the SubtitleEngine adapter layer (ADR-0011, second impl).
// Mirrors the VoiceEngine test. Verifies adapter selection by resolved
// { provider, model } without the worker knowing the vendor.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/subtitle.js', () => ({
  generateSubtitles: vi.fn().mockReturnValue({
    srt_path: '/tmp/fyi-studio/x/subtitles.srt',
    cues: 3,
    total_duration: 12,
  }),
}));
vi.mock('../src/data-plane.js', () => ({
  readTextAsset: vi.fn().mockReturnValue('1\n00:00:00,000 --> 00:00:04,000\nHello there\n'),
}));

import { getSubtitleEngine, listSubtitleEngines } from '../src/subtitle-engine.js';

describe('SubtitleEngine adapter selection (ADR-0011)', () => {
  it('resolves the local heuristic engine by default', async () => {
    const engine = getSubtitleEngine(undefined, undefined);
    expect(engine.provider).toBe('local');
    expect(engine.model).toBe('heuristic');
    const r = await engine.generate('exec-1', 'Hello there my friend');
    expect(r.provider).toBe('local');
    expect(r.cost_estimate).toBe(0);
    expect(r.srt_path).toContain('subtitles.srt');
  });

  it('falls back to heuristic for an unknown resolved engine', async () => {
    const engine = getSubtitleEngine('some-future-asr', 'whisper');
    expect(engine.provider).toBe('local');
    expect(engine.model).toBe('heuristic');
  });

  it('lists registered subtitle engines', () => {
    expect(listSubtitleEngines()).toContainEqual({ provider: 'local', model: 'heuristic' });
  });
});
