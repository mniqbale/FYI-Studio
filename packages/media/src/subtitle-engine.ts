// SubtitleEngine — ASR/caption adapter layer (ADR-0011 + ADR-0012).
//
// A MediaEngine implementation for subtitle (text → SRT). Per ADR-0012, this is
// the ONLY vendor-aware layer in the subtitle path; the worker is capability-only
// and delegates the whole lifecycle to runMediaEngine. Engine-specific input
// ({ language }) and metadata ({ cues, total_duration, subtitle_text }) stay
// typed here — NOT forced into a shared payload (anti-leaky-abstraction).

import { generateSubtitles } from './subtitle.js';
import { readTextAsset } from './data-plane.js';
import type { MediaEngine, EngineContext } from './media-engine.js';

/** Subtitle engine-specific input (NOT standardized by MediaEngine). */
export interface SubtitleEngineInput {
  text: string;
  language?: string;
}

/** Subtitle engine-specific metadata (NOT standardized by MediaEngine). */
export interface SubtitleEngineMeta {
  srt_path: string;
  cues: number;
  total_duration: number;
  subtitle_text: string;
}

/** Backward-compatible result shape (kept for existing tests/callers). */
export interface SubtitleEngineResult extends SubtitleEngineMeta {
  provider: string;
  model: string;
  cost_estimate: number;
}

/** Heuristic subtitle engine: word-count cues (offline, free, default). */
const heuristicSubtitleEngine: MediaEngine<SubtitleEngineInput, SubtitleEngineMeta> = {
  provider: 'local',
  model: 'heuristic',
  async run(ctx, input) {
    const subs = generateSubtitles(ctx.execution_id, input.text);
    const subtitle_text = readTextAsset(subs.srt_path) ?? '';
    return {
      refs: { subtitles: subs.srt_path },
      cost_estimate: 0,
      metadata: { srt_path: subs.srt_path, cues: subs.cues, total_duration: subs.total_duration, subtitle_text },
    };
  },
};

const ENGINES: MediaEngine<SubtitleEngineInput, SubtitleEngineMeta>[] = [heuristicSubtitleEngine];

/** Select the subtitle engine for a resolved { provider, model }; default local heuristic. */
export function getSubtitleEngine(
  provider: string | undefined,
  model: string | undefined,
): MediaEngine<SubtitleEngineInput, SubtitleEngineMeta> {
  if (!provider) return heuristicSubtitleEngine;
  return ENGINES.find((e) => e.provider === provider && (model === undefined || e.model === model)) ?? heuristicSubtitleEngine;
}

/** List all registered subtitle engines. */
export function listSubtitleEngines(): Array<{ provider: string; model: string }> {
  return ENGINES.map((e) => ({ provider: e.provider, model: e.model }));
}

export type { EngineContext };
