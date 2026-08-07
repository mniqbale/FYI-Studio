// VideoEngine adapter layer (ADR-0011 — Capability-Only Worker Invariant).
//
// THIRD reference implementation of the media-engine pattern, and the true
// stress test: unlike voice/subtitle (which both take a single text input),
// video takes a MULTI-ASSET payload (audio + subtitles + title + resolution).
// This deliberately exercises whether a generic MediaEngine abstraction would
// feel natural for a multi-asset engine — or force exceptions. No refactor is
// done here; this is a parallel implementation for the Rule of Three.

import { composeVideo, type ComposeInput, type ComposeResult } from './video.js';

/** Multi-asset input for a video compose engine (differs from voice/subtitle). */
export interface VideoEngineInput {
  narration_wav: string; // reference to prior step's audio
  subtitles_srt: string; // reference to prior step's SRT
  title?: string;
  resolution?: string;
  duration_seconds?: number;
}

/** Uniform result of any video compose engine. */
export interface VideoEngineResult {
  video_path: string;
  duration_seconds: number;
  resolution: string;
  format: 'mp4';
  provider: string;
  model: string;
  cost_estimate: number;
}

export interface VideoEngine {
  readonly provider: string;
  readonly model: string;
  /** Compose a video from audio + subtitles into the execution media dir. */
  compose(execution_id: string, input: VideoEngineInput): Promise<VideoEngineResult>;
}

/** Offline ffmpeg composer. Default fallback engine. */
const ffmpegVideoEngine: VideoEngine = {
  provider: 'local',
  model: 'ffmpeg',
  async compose(execution_id, input) {
    const r: ComposeResult = await composeVideo({
      execution_id,
      narration_wav: input.narration_wav,
      subtitles_srt: input.subtitles_srt,
      title: input.title,
      resolution: input.resolution,
      duration_seconds: input.duration_seconds,
    });
    return { ...r, provider: 'local', model: 'ffmpeg', cost_estimate: 0 };
  },
};

const ENGINES: VideoEngine[] = [ffmpegVideoEngine];

/**
 * Select the video engine adapter for a resolved { provider, model }.
 * Falls back to the local ffmpeg engine when unknown (worker stays
 * capability-only).
 */
export function getVideoEngine(provider: string | undefined, model: string | undefined): VideoEngine {
  if (!provider) return ffmpegVideoEngine;
  const engine = ENGINES.find((e) => e.provider === provider && (model === undefined || e.model === model));
  return engine ?? ffmpegVideoEngine;
}

/** List all registered video engines. */
export function listVideoEngines(): Array<{ provider: string; model: string }> {
  return ENGINES.map((e) => ({ provider: e.provider, model: e.model }));
}
