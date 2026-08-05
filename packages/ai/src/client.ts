// AI client — provider adapters (Milestone 3). Uses native fetch (no SDK),
// per Engineering Standards dependency minimalism. Each provider maps to an
// OpenAI-compatible chat-completions call or its native equivalent.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiRequest {
  provider: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface AiResult {
  text: string;
  tokens_in: number;
  tokens_out: number;
}

export class AiClientError extends Error {
  code: string;
  retryable: boolean;
  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

// Base URLs per provider.
const BASE_URL: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
  together: 'https://api.together.xyz/v1',
  ollama: 'http://localhost:11434/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
};

// ---- minimal env/secret helpers (self-contained, no @fyi/platform dep) ----
function envVarName(provider: string): string {
  return `${provider.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`;
}

function loadEnvIfPresent(cwd = process.cwd()): void {
  const envPath = resolve(cwd, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(idx + 1).trim();
  }
}

function resolveSecret(provider: string): string | undefined {
  return process.env[envVarName(provider)];
}

loadEnvIfPresent();

export class AiClient {
  async complete(req: AiRequest): Promise<AiResult> {
    const base = BASE_URL[req.provider];
    if (!base) {
      throw new AiClientError('UNKNOWN_PROVIDER', `No adapter for provider: ${req.provider}`);
    }

    switch (req.provider) {
      case 'anthropic':
        return this.completeAnthropic(req, base);
      case 'gemini':
        return this.completeGemini(req, base);
      default:
        // openai / openrouter / groq / together / ollama — OpenAI-compatible.
        return this.completeOpenAiCompatible(req, base);
    }
  }

  private apiKey(provider: string): string {
    const key = resolveSecret(provider);
    if (!key) {
      throw new AiClientError(
        'PROVIDER_UNAVAILABLE',
        `No API key configured for provider "${provider}". Set ${provider.toUpperCase()}_API_KEY.`,
        false,
      );
    }
    return key;
  }

  private async completeOpenAiCompatible(req: AiRequest, base: string): Promise<AiResult> {
    const key = this.apiKey(req.provider);
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        temperature: req.temperature,
        max_tokens: req.max_tokens,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // OpenAI returns 429 with insufficient_quota when the account billing is exhausted.
      if (res.status === 429 && /insufficient_quota|quota/i.test(body)) {
        throw new AiClientError('QUOTA_EXHAUSTED', `Quota exhausted: ${body}`, false);
      }
      if (res.status === 429) throw new AiClientError('RATE_LIMIT_EXCEEDED', `Rate limited (429): ${body}`, true);
      if (res.status >= 500) throw new AiClientError('PROVIDER_UNAVAILABLE', `Provider error (${res.status})`, true);
      throw new AiClientError('PROVIDER_ERROR', `Provider error (${res.status}): ${body}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      tokens_in: data.usage?.prompt_tokens ?? 0,
      tokens_out: data.usage?.completion_tokens ?? 0,
    };
  }

  private async completeAnthropic(req: AiRequest, base: string): Promise<AiResult> {
    const key = this.apiKey(req.provider);
    // Anthropic uses system as a top-level field, not a message role.
    const system = req.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const messages = req.messages.filter((m) => m.role !== 'system');

    const res = await fetch(`${base}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: req.model,
        system: system || undefined,
        messages,
        max_tokens: req.max_tokens ?? 1024,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      if (res.status === 429) throw new AiClientError('RATE_LIMIT_EXCEEDED', `Rate limited (429)`, true);
      if (res.status >= 500) throw new AiClientError('PROVIDER_UNAVAILABLE', `Provider error (${res.status})`, true);
      throw new AiClientError('PROVIDER_ERROR', `Provider error (${res.status}): ${body}`);
    }

    const data = (await res.json()) as {
      content?: Array<{ text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    return {
      text: data.content?.map((c) => c.text ?? '').join('') ?? '',
      tokens_in: data.usage?.input_tokens ?? 0,
      tokens_out: data.usage?.output_tokens ?? 0,
    };
  }

  private async completeGemini(req: AiRequest, base: string): Promise<AiResult> {
    const key = this.apiKey(req.provider);
    // Gemini uses contents: [{role: user|model, parts: [{text}]}].
    const contents = req.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : m.role === 'system' ? 'user' : 'user',
      parts: [{ text: m.content }],
    }));

    const res = await fetch(
      `${base}/models/${req.model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      if (res.status === 429) throw new AiClientError('RATE_LIMIT_EXCEEDED', `Rate limited (429)`, true);
      if (res.status >= 500) throw new AiClientError('PROVIDER_UNAVAILABLE', `Provider error (${res.status})`, true);
      throw new AiClientError('PROVIDER_ERROR', `Provider error (${res.status}): ${body}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    return {
      text: data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '',
      tokens_in: data.usageMetadata?.promptTokenCount ?? 0,
      tokens_out: data.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }
}
