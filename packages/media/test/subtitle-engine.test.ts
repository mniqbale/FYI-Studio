// Unit tests for the SubtitleEngine adapter layer (ADR-0011 + ADR-0012).
// Verifies engine selection by resolved { provider, model } and the unified
// MediaEngine lifecycle (run → refs/cost/metadata).
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
import { runMediaEngine } from '../src/media-engine.js';

describe('SubtitleEngine (MediaEngine lifecycle) selection', () => {
  it('resolves the local heuristic engine and runs through the lifecycle', async () => {
    const engine = getSubtitleEngine(undefined, undefined);
    expect(engine.provider).toBe('local');
    expect(engine.model).toBe('heuristic');
    const outcome = await runMediaEngine(engine, { execution_id: 'exec-1' }, { text: 'Hello there my friend' });
    expect(outcome.error).toBeUndefined();
    expect(outcome.refs.subtitles).toContain('subtitles.srt');
    expect(outcome.cost_estimate).toBe(0);
    expect(outcome.metadata?.srt_path).toContain('subtitles.srt');
  });

  it('falls back to heuristic for an unknown resolved engine', () => {
    const engine = getSubtitleEngine('whisper', 'whisper-1');
    expect(engine.provider).toBe('local');
    expect(engine.model).toBe('heuristic');
  });

  it('lists registered subtitle engines', () => {
    expect(listSubtitleEngines()).toContainEqual({ provider: 'local', model: 'heuristic' });
  });
});
