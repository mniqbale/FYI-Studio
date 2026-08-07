// SubtitleEngine adapter layer (ADR-0011 — Capability-Only Worker Invariant).
//
// Second reference implementation of the media-engine pattern, mirroring
// VoiceEngine (voice-engine.ts) EXACTLY in shape. Per the Rule of Three, this
// exists alongside VoiceEngine as a real second implementation so we can later
// compare contracts and extract a generic MediaEngine only if ~identical.
//
// Like voice, this is the ONLY place in the subtitle path that knows a
// vendor/engine identity. A worker resolves "subtitle:generate" via ModelGate
// to get { provider, model }, then asks this factory for the matching adapter.

import { generateSubtitles } from './subtitle.js';
import { readTextAsset } from './data-plane.js';

/** Uniform result of any subtitle engine. Mirrors VoiceEngineResult shape. */
export interface SubtitleEngineResult {
  srt_path: string;
  cues: number;
  total_duration: number;
  subtitle_text: string;
  provider: string;
  model: string;
  cost_estimate: number;
}

export interface SubtitleEngine {
  readonly provider: string;
  readonly model: string;
  /** Generate an SRT subtitle file from narration text into the execution media dir. */
  generate(execution_id: string, text: string, opts?: { language?: string }): Promise<SubtitleEngineResult>;
}

/** Offline heuristic subtitle generator (word-count cues). Default fallback engine. */
const heuristicSubtitleEngine: SubtitleEngine = {
  provider: 'local',
  model: 'heuristic',
  async generate(execution_id, text, opts) {
    const subs = generateSubtitles(execution_id, text);
    const subtitle_text = readTextAsset(subs.srt_path) ?? '';
    return {
      srt_path: subs.srt_path,
      cues: subs.cues,
      total_duration: subs.total_duration,
      subtitle_text,
      provider: 'local',
      model: 'heuristic',
      cost_estimate: 0,
    };
  },
};

const ENGINES: SubtitleEngine[] = [heuristicSubtitleEngine];

/**
 * Select the subtitle engine adapter for a resolved { provider, model }.
 * Falls back to the local heuristic engine when unknown (worker stays
 * capability-only).
 */
export function getSubtitleEngine(provider: string | undefined, model: string | undefined): SubtitleEngine {
  if (!provider) return heuristicSubtitleEngine;
  const engine = ENGINES.find((e) => e.provider === provider && (model === undefined || e.model === model));
  return engine ?? heuristicSubtitleEngine;
}

/** List all registered subtitle engines. */
export function listSubtitleEngines(): Array<{ provider: string; model: string }> {
  return ENGINES.map((e) => ({ provider: e.provider, model: e.model }));
}
