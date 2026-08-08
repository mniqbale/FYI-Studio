// ThumbnailEngine — MediaEngine adapter for thumbnail compositing (Phase 2.8 SPIKE).
//
// A MediaEngine implementation (ADR-0012) for image:thumbnail. Per ADR-0012 this
// is the ONLY vendor-aware layer in the thumbnail path; a future worker would be
// capability-only and delegate the whole lifecycle to runMediaEngine. This spike
// proves the abstraction carries image compositing without a leaky abstraction.

import { composeThumbnail, type ThumbnailInput, type ThumbnailResult } from './thumbnail.js';
import type { MediaEngine, EngineContext } from './media-engine.js';

/** Thumbnail engine-specific input (NOT standardized by MediaEngine). */
export interface ThumbnailEngineInput {
  title: string;
  hook?: string;
  visual_identity: { style?: string; palette?: string };
  resolution?: string;
}

/** Thumbnail engine-specific metadata (NOT standardized by MediaEngine). */
export interface ThumbnailEngineMeta {
  thumbnail_path: string;
  resolution: string;
  format: 'png';
}

/** FFmpeg thumbnail compose engine (offline, free, default). */
const ffmpegThumbnailEngine: MediaEngine<ThumbnailEngineInput, ThumbnailEngineMeta> = {
  provider: 'local',
  model: 'ffmpeg',
  async run(ctx, input) {
    const r: ThumbnailResult = await composeThumbnail({
      execution_id: ctx.execution_id,
      title: input.title,
      hook: input.hook,
      visual_identity: input.visual_identity,
      resolution: input.resolution,
    });
    return {
      refs: { thumbnail: r.thumbnail_path },
      cost_estimate: 0,
      metadata: { thumbnail_path: r.thumbnail_path, resolution: r.resolution, format: r.format },
    };
  },
};

const ENGINES: MediaEngine<ThumbnailEngineInput, ThumbnailEngineMeta>[] = [ffmpegThumbnailEngine];

/** Select the thumbnail engine for a resolved { provider, model }; default local ffmpeg. */
export function getThumbnailEngine(
  provider: string | undefined,
  model: string | undefined,
): MediaEngine<ThumbnailEngineInput, ThumbnailEngineMeta> {
  if (!provider) return ffmpegThumbnailEngine;
  return ENGINES.find((e) => e.provider === provider && (model === undefined || e.model === model)) ?? ffmpegThumbnailEngine;
}

/** List all registered thumbnail engines. */
export function listThumbnailEngines(): Array<{ provider: string; model: string }> {
  return ENGINES.map((e) => ({ provider: e.provider, model: e.model }));
}

export type { EngineContext };
