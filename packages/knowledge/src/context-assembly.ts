// Context Assembly Engine (Milestone 4) — extracts relevant tenant knowledge
// and memory, then assembles a `context` block injected into the worker's
// TaskEnvelope. Per MVP: policy-driven, no vector DB.

import { getTenantKnowledge } from './knowledge-base.js';
import { listMemory } from './memory.js';

/** Options controlling what context is injected. */
export interface ContextAssemblyOptions {
  /** Include brand_voice + language in the injected context. */
  includeBrand?: boolean;
  /** Include style_guide. */
  includeStyleGuide?: boolean;
  /** Include forbidden_terms (used by prompt guards). */
  includeForbiddenTerms?: boolean;
  /** Include per-channel constraints. */
  includeConstraints?: boolean;
  /** Include verified facts. */
  includeFacts?: boolean;
  /** Max recent memory entries to include (0 = none). */
  memoryLimit?: number;
}

const DEFAULT_OPTIONS: Required<ContextAssemblyOptions> = {
  includeBrand: true,
  includeStyleGuide: true,
  includeForbiddenTerms: true,
  includeConstraints: true,
  includeFacts: true,
  memoryLimit: 5,
};

/** The assembled context block handed to a worker. */
export interface AssembledContext {
  tenant_id: string;
  brand_voice?: string;
  language?: string;
  style_guide?: string;
  forbidden_terms: string[];
  constraints: Record<string, unknown>;
  verified_facts: string[];
  memory: Record<string, unknown>[];
}

/**
 * Assemble tenant context for injection into a worker's TaskEnvelope.
 * Falls back to sensible empty defaults when no knowledge entry exists.
 */
export async function assembleContext(
  tenant_id: string,
  options: ContextAssemblyOptions = {},
): Promise<AssembledContext> {
  const opts: Required<ContextAssemblyOptions> = { ...DEFAULT_OPTIONS, ...options };
  const kb = await getTenantKnowledge(tenant_id);

  const memory =
    opts.memoryLimit > 0
      ? (await listMemory(tenant_id, { limit: opts.memoryLimit })).map((m) => ({
          kind: m.kind,
          content: m.content as unknown as Record<string, unknown>,
          created_at: m.created_at.toISOString(),
        }))
      : [];

  return {
    tenant_id,
    brand_voice: opts.includeBrand ? (kb?.brand_voice ?? undefined) : undefined,
    language: opts.includeBrand ? (kb?.language ?? 'en') : undefined,
    style_guide: opts.includeStyleGuide ? (kb?.style_guide ?? undefined) : undefined,
    forbidden_terms: opts.includeForbiddenTerms
      ? ((kb?.forbidden_terms as unknown as string[]) ?? [])
      : [],
    constraints: opts.includeConstraints
      ? ((kb?.constraints as unknown as Record<string, unknown>) ?? {})
      : {},
    verified_facts: opts.includeFacts ? ((kb?.verified_facts as unknown as string[]) ?? []) : [],
    memory,
  };
}
