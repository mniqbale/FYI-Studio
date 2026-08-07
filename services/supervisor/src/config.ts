// Supervisor static configuration for the MVP (S1.4).
//
// Per Perbaikan D, model policy comes from the SINGLE source of truth:
// model_policy.yaml (via @fyi/platform loadModelPolicy). The hardcoded
// CAPABILITY_POLICY has been removed to prevent policy drift. This module now
// only owns dispatch wiring (capability -> queue), which is orchestrator-local.

import { loadModelPolicy } from '@fyi/platform';

// Queue name per worker queue. Workers publish results to `completion-queue`.
export const COMPLETION_QUEUE = 'completion-queue';

// Map: capability -> worker queue name.
// Keys must match the capabilities the workers actually listen on. Real media
// workers use the canonical capability names (voice:tts, subtitle:generate,
// video:compose) resolved via ModelGate.
export const CAPABILITY_QUEUE: Record<string, string> = {
  'content:brief': 'planner-queue',
  'research:mock': 'research-queue',
  'text-synthesis:script': 'script-queue',
  'speech-synthesis:voice': 'voice-queue',
  'research:real': 'research-real-queue',
  'text-synthesis:script:real': 'script-real-queue',
  'voice:tts': 'voice-real-queue',
  'subtitle:generate': 'subtitle-real-queue',
  'video:compose': 'video-real-queue',
};

// Fallback policy for capabilities with no default in model_policy.yaml.
const MOCK_FALLBACK = { provider: 'mock', model: 'mock-model' };

/**
 * Resolve the model policy for a capability from the SINGLE source of truth
 * (model_policy.yaml defaults). Falls back to a mock policy for skeleton/mock
 * capabilities. Returns a contracts-compatible policy shape.
 */
export function resolvePolicy(capability: string): { provider: string; model: string } {
  const policy = loadModelPolicy();
  const def = policy.defaults?.[capability];
  return def ?? MOCK_FALLBACK;
}

// MVP: single static tenant context fragment.
// A real system reads tenant_context from PostgreSQL (Knowledge Layer).
export const DEFAULT_TENANT_CONTEXT = {
  brand_voice: 'professional',
  language: 'en',
  forbidden_terms: [],
};
