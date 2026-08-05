// ModelGate v2 — the capability resolver (ADR-0007).
//
// Workers ask for a worker-capability (e.g. "research:real"); ModelGate resolves
// it to a concrete provider/model. The worker-capability maps to required model
// capabilities via `worker_capabilities` in model_policy.yaml (or defaults to
// itself). Only connected providers and models supporting ALL required model
// capabilities are considered.
//
// This remains a utility (not a service), preserving the Thin Orchestrator
// pattern (ADR-0004). It replaces the static CAPABILITY_POLICY.

import { type ModelPolicy } from './model-policy.js';
import { connectedProviderIds } from './connection-manager.js';
import { listModelsForCapabilities, modelSupportsCapabilities } from './model-registry.js';

export interface ResolvedModel {
  provider: string;
  model: string;
  params?: { temperature?: number; max_tokens?: number };
}

export interface ResolveResult {
  ok: boolean;
  model?: ResolvedModel;
  error?: {
    code: string; // e.g. "NO_CONNECTED_PROVIDER", "INCOMPATIBLE_MODEL", "NO_MODEL_FOR_CAPABILITY"
    message: string;
    retryable: boolean;
  };
}

export class ModelGate {
  private policy: ModelPolicy;

  constructor(policy: ModelPolicy) {
    this.policy = policy;
  }

  /** Required model capabilities for a worker capability. */
  private requiredModelCaps(capability: string): string[] {
    const mapped = this.policy.worker_capabilities?.[capability];
    return mapped && mapped.length > 0 ? mapped : [capability];
  }

  /**
   * Resolve a model for a worker capability.
   * @param capability e.g. "research:real", "text-synthesis:script:real"
   * @param opts.override - optional { provider, model } user choice
   * @param opts.scope - tenant scope for connection lookup
   */
  async resolve(
    capability: string,
    opts: { override?: { provider: string; model: string }; scope?: string } = {},
  ): Promise<ResolveResult> {
    const connected = await connectedProviderIds({ scope: opts.scope });
    const required = this.requiredModelCaps(capability);

    // 1. User override: must be connected AND capable, else fail explicitly.
    if (opts.override) {
      const { provider, model } = opts.override;
      if (!connected.includes(provider)) {
        return {
          ok: false,
          error: {
            code: 'NO_CONNECTED_PROVIDER',
            message: `Provider "${provider}" is not connected. Connect it first.`,
            retryable: false,
          },
        };
      }
      const capable = await modelSupportsCapabilities(provider, model, required);
      if (!capable) {
        return {
          ok: false,
          error: {
            code: 'INCOMPATIBLE_MODEL',
            message: `Model "${provider}/${model}" does not support the required capabilities for "${capability}" (${required.join(', ')}).`,
            retryable: false,
          },
        };
      }
      return { ok: true, model: { provider, model } };
    }

    // 2. Default model for the capability from policy.
    const def = this.policy.defaults[capability];
    if (def && connected.includes(def.provider)) {
      const capable = await modelSupportsCapabilities(def.provider, def.model, required);
      if (capable) {
        return { ok: true, model: { provider: def.provider, model: def.model } };
      }
    }

    // 3. Fallback: first connected + capable model.
    const candidates = await listModelsForCapabilities(connected, required);
    if (candidates.length > 0) {
      const first = candidates[0]!;
      return { ok: true, model: { provider: first.provider, model: first.model } };
    }

    // 4. No connected provider supports the capability.
    return {
      ok: false,
      error: {
        code: 'NO_MODEL_FOR_CAPABILITY',
        message:
          connected.length === 0
            ? `No AI providers connected. Connect a provider (e.g. openai, gemini) first.`
            : `No connected provider has a model supporting "${capability}" (requires: ${required.join(', ')}). Connect a provider with a capable model.`,
        retryable: false,
      },
    };
  }
}

