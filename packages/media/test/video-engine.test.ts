// Unit tests for the VideoEngine adapter layer (ADR-0011 + ADR-0012).
// Video is the multi-asset payload stress case for the unified MediaEngine.
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
import { runMediaEngine } from '../src/media-engine.js';

describe('VideoEngine (MediaEngine lifecycle) selection', () => {
  it('resolves the local ffmpeg engine and runs multi-asset through the lifecycle', async () => {
    const engine = getVideoEngine(undefined, undefined);
    expect(engine.provider).toBe('local');
    expect(engine.model).toBe('ffmpeg');
    const outcome = await runMediaEngine(engine, { execution_id: 'exec-1' }, {
      narration_wav: '/tmp/a.wav',
      subtitles_srt: '/tmp/b.srt',
    });
    expect(outcome.error).toBeUndefined();
    expect(outcome.refs.video).toContain('video.mp4');
    expect(outcome.cost_estimate).toBe(0);
    expect(outcome.metadata?.format).toBe('mp4');
  });

  it('falls back to ffmpeg for an unknown resolved engine', () => {
    const engine = getVideoEngine('sora', 'sora-v1');
    expect(engine.provider).toBe('local');
    expect(engine.model).toBe('ffmpeg');
  });

  it('passes multi-asset input through to the underlying engine', async () => {
    const engine = getVideoEngine(undefined, undefined);
    await runMediaEngine(engine, { execution_id: 'exec-1' }, {
      narration_wav: '/tmp/a.wav',
      subtitles_srt: '/tmp/b.srt',
      title: 'My Title',
      resolution: '1920x1080',
    });
    const { composeVideo } = await import('../src/video.js');
    expect(composeVideo).toHaveBeenCalledWith(
      expect.objectContaining({ execution_id: 'exec-1', narration_wav: '/tmp/a.wav', subtitles_srt: '/tmp/b.srt', title: 'My Title', resolution: '1920x1080' }),
    );
  });

  it('lists registered video engines', () => {
    expect(listVideoEngines()).toContainEqual({ provider: 'local', model: 'ffmpeg' });
  });
});
