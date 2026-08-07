// VideoEngine — compose adapter layer (ADR-0011 + ADR-0012).
//
// A MediaEngine implementation for video (multi-asset → MP4). Per ADR-0012,
// this is the ONLY vendor-aware layer in the video path; the worker is
// capability-only and delegates the whole lifecycle to runMediaEngine.
// Video has a MULTI-ASSET input — the anti-leaky-abstraction stress case —
// kept fully typed here, NOT flattened into a shared payload.

import { composeVideo, type ComposeResult } from './video.js';
import type { MediaEngine, EngineContext } from './media-engine.js';

/** Video engine-specific MULTI-ASSET input (NOT standardized by MediaEngine). */
export interface VideoEngineInput {
  narration_wav: string;
  subtitles_srt: string;
  title?: string;
  resolution?: string;
  duration_seconds?: number;
}

/** Video engine-specific metadata (NOT standardized by MediaEngine). */
export interface VideoEngineMeta {
  video_path: string;
  duration_seconds: number;
  resolution: string;
  format: 'mp4';
}

/** Backward-compatible result shape (kept for existing tests/callers). */
export interface VideoEngineResult extends VideoEngineMeta {
  provider: string;
  model: string;
  cost_estimate: number;
}

/** ffmpeg compose engine (offline, free, default). */
const ffmpegVideoEngine: MediaEngine<VideoEngineInput, VideoEngineMeta> = {
  provider: 'local',
  model: 'ffmpeg',
  async run(ctx, input) {
    const r: ComposeResult = await composeVideo({
      execution_id: ctx.execution_id,
      narration_wav: input.narration_wav,
      subtitles_srt: input.subtitles_srt,
      title: input.title,
      resolution: input.resolution,
      duration_seconds: input.duration_seconds,
    });
    return {
      refs: { video: r.video_path },
      cost_estimate: 0,
      metadata: { video_path: r.video_path, duration_seconds: r.duration_seconds, resolution: r.resolution, format: r.format },
    };
  },
};

const ENGINES: MediaEngine<VideoEngineInput, VideoEngineMeta>[] = [ffmpegVideoEngine];

/** Select the video engine for a resolved { provider, model }; default local ffmpeg. */
export function getVideoEngine(
  provider: string | undefined,
  model: string | undefined,
): MediaEngine<VideoEngineInput, VideoEngineMeta> {
  if (!provider) return ffmpegVideoEngine;
  return ENGINES.find((e) => e.provider === provider && (model === undefined || e.model === model)) ?? ffmpegVideoEngine;
}

/** List all registered video engines. */
export function listVideoEngines(): Array<{ provider: string; model: string }> {
  return ENGINES.map((e) => ({ provider: e.provider, model: e.model }));
}

export type { EngineContext };
