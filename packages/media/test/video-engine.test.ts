// Unit tests for the VideoEngine adapter layer (ADR-0011, third impl — stress test).
// Mirrors voice/subtitle tests: verifies adapter selection by resolved
// { provider, model } without the worker knowing the vendor. Video is the
// multi-asset payload case.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/video.js', () => ({
  composeVideo: vi.fn().mockResolvedValue({
    video_path: '/tmp/fyi-studio/x/video.mp4',
    duration_seconds: 12,
    resolution: '1280x720',
    format: 'mp4',
  }),
}));

import { getVideoEngine, listVideoEngines } from '../src/video-engine.js';

describe('VideoEngine adapter selection (ADR-0011 — stress test)', () => {
  it('resolves the local ffmpeg engine by default', async () => {
    const engine = getVideoEngine(undefined, undefined);
    expect(engine.provider).toBe('local');
    expect(engine.model).toBe('ffmpeg');
    const r = await engine.compose('exec-1', {
      narration_wav: '/tmp/fyi-studio/x/narration.wav',
      subtitles_srt: '/tmp/fyi-studio/x/subtitles.srt',
    });
    expect(r.provider).toBe('local');
    expect(r.cost_estimate).toBe(0);
    expect(r.format).toBe('mp4');
    expect(r.video_path).toContain('video.mp4');
  });

  it('falls back to ffmpeg for an unknown resolved engine', async () => {
    const engine = getVideoEngine('sora', 'sora-v1');
    expect(engine.provider).toBe('local');
    expect(engine.model).toBe('ffmpeg');
  });

  it('passes multi-asset input through to the underlying engine', async () => {
    const engine = getVideoEngine(undefined, undefined);
    await engine.compose('exec-1', {
      narration_wav: '/tmp/a.wav',
      subtitles_srt: '/tmp/b.srt',
      title: 'My Title',
      resolution: '1920x1080',
    });
    const { composeVideo } = await import('../src/video.js');
    expect(composeVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        execution_id: 'exec-1',
        narration_wav: '/tmp/a.wav',
        subtitles_srt: '/tmp/b.srt',
        title: 'My Title',
        resolution: '1920x1080',
      }),
    );
  });

  it('lists registered video engines', () => {
    expect(listVideoEngines()).toContainEqual({ provider: 'local', model: 'ffmpeg' });
  });
});
