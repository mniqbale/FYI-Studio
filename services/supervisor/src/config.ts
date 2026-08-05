// Supervisor static configuration for the MVP (S1.4).
// In later milestones these become model_policy.yaml + tenant_context tables.

import { type ModelPolicy } from '@fyi/contracts';

// Queue name per worker queue. Workers publish results to `completion-queue`.
export const COMPLETION_QUEUE = 'completion-queue';

// Map: capability -> worker queue name.
// Keys align with the worker capabilities implemented in S1.3 (mock) and M3 (real).
export const CAPABILITY_QUEUE: Record<string, string> = {
  'research:mock': 'research-queue',
  'text-synthesis:script': 'script-queue',
  'speech-synthesis:voice': 'voice-queue',
  'research:real': 'research-real-queue',
  'text-synthesis:script:real': 'script-real-queue',
};

// Map: capability -> model policy (MVP static; replaces ModelGate for skeleton run).
export const CAPABILITY_POLICY: Record<string, ModelPolicy> = {
  'research:mock': { provider: 'mock', model: 'mock-research-model', temperature: 0.7, max_tokens: 2048 },
  'text-synthesis:script': { provider: 'mock', model: 'mock-script-model', temperature: 0.7, max_tokens: 4096 },
  'speech-synthesis:voice': { provider: 'mock', model: 'mock-voice-model' },
};

// MVP: single static tenant context fragment.
// A real system reads tenant_context from PostgreSQL (Knowledge Layer).
export const DEFAULT_TENANT_CONTEXT = {
  brand_voice: 'professional',
  language: 'en',
  forbidden_terms: [],
};
