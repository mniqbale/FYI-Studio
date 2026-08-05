// Provider Registry — catalog of known AI providers (ADR-0007).
//
// This is the static provider metadata: id, display name, base URL, and whether
// it requires an API key. It is the "known providers" list; whether a provider
// is actually usable for a given capability is determined by ModelGate v2 after
// checking connections + model registry.

export interface ProviderDefinition {
  /** Canonical id, e.g. "openai". Lowercase, no spaces. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Base API URL (informational; real calls happen in workers via the SDK). */
  base_url?: string;
  /** Whether connecting requires an API key. */
  requires_api_key: boolean;
}

/** Known providers per ADR-0007 §Provider Registry. */
export const PROVIDER_CATALOG: ProviderDefinition[] = [
  { id: 'openai', name: 'OpenAI', base_url: 'https://api.openai.com/v1', requires_api_key: true },
  { id: 'anthropic', name: 'Anthropic', base_url: 'https://api.anthropic.com/v1', requires_api_key: true },
  { id: 'gemini', name: 'Google Gemini', base_url: 'https://generativelanguage.googleapis.com/v1beta', requires_api_key: true },
  { id: 'openrouter', name: 'OpenRouter', base_url: 'https://openrouter.ai/api/v1', requires_api_key: true },
  { id: 'groq', name: 'Groq', base_url: 'https://api.groq.com/openai/v1', requires_api_key: true },
  { id: 'ollama', name: 'Ollama (local)', base_url: 'http://localhost:11434', requires_api_key: false },
  { id: 'azure', name: 'Azure OpenAI', requires_api_key: true },
  { id: 'vertex', name: 'Google Vertex AI', requires_api_key: true },
  { id: 'together', name: 'Together AI', base_url: 'https://api.together.xyz/v1', requires_api_key: true },
];

const byId = new Map(PROVIDER_CATALOG.map((p) => [p.id, p]));

/** Get a provider definition by id, or undefined if unknown. */
export function getProvider(id: string): ProviderDefinition | undefined {
  return byId.get(id.toLowerCase());
}

/** List all known provider ids. */
export function listProviderIds(): string[] {
  return PROVIDER_CATALOG.map((p) => p.id);
}
