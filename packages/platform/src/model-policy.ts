// Model Policy loader — reads model_policy.yaml (the single source of truth
// per ADR-0007) and provides typed access to capabilities, models, and defaults.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
// Default location: packages/platform/model_policy.yaml
const DEFAULT_POLICY_PATH = resolve(__dirname, '..', 'model_policy.yaml');

export interface CapabilityDef {
  description?: string;
}

export interface ModelDef {
  provider: string;
  model: string;
  version?: string;
  pricing_per_1k_tokens?: number;
  context_window?: number;
  capabilities: string[];
}

export interface DefaultDef {
  provider: string;
  model: string;
}

export interface ModelPolicy {
  capabilities: Record<string, CapabilityDef>;
  models: ModelDef[];
  defaults: Record<string, DefaultDef>;
}

export function loadModelPolicy(path = DEFAULT_POLICY_PATH): ModelPolicy {
  const raw = readFileSync(path, 'utf8');
  return parse(raw) as ModelPolicy;
}
