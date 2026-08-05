// Unit tests for the AI client adapters (no real network — fetch mocked).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiClient, AiClientError } from '../src/client.js';

const openaiLike = {
  choices: [{ message: { content: 'Hello world' } }],
  usage: { prompt_tokens: 10, completion_tokens: 5 },
};

describe('AiClient adapters', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  it('calls OpenAI-compatible endpoint and returns text + usage', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => openaiLike,
    } as Response);

    const client = new AiClient();
    const res = await client.complete({ provider: 'openai', model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] });

    expect(res.text).toBe('Hello world');
    expect(res.tokens_in).toBe(10);
    expect(res.tokens_out).toBe(5);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/chat/completions');
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-openai-key');
  });

  it('throws PROVIDER_UNAVAILABLE when API key is missing', async () => {
    delete process.env.OPENAI_API_KEY;
    const client = new AiClient();
    await expect(client.complete({ provider: 'openai', model: 'gpt-4o', messages: [] })).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
      retryable: false,
    });
  });

  it('throws RATE_LIMIT_EXCEEDED (retryable) on 429', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 429, text: async () => 'slow down' } as Response);
    const client = new AiClient();
    await expect(client.complete({ provider: 'openai', model: 'gpt-4o', messages: [] })).rejects.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      retryable: true,
    });
  });

  it('throws QUOTA_EXHAUSTED (non-retryable) on 429 with insufficient_quota', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: { message: 'insufficient_quota', code: 'insufficient_quota' } }),
    } as Response);
    const client = new AiClient();
    await expect(client.complete({ provider: 'openai', model: 'gpt-4o', messages: [] })).rejects.toMatchObject({
      code: 'QUOTA_EXHAUSTED',
      retryable: false,
    });
  });

  it('calls Anthropic /messages endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ text: 'Anthropic reply' }], usage: { input_tokens: 3, output_tokens: 4 } }),
    } as Response);

    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    const client = new AiClient();
    const res = await client.complete({
      provider: 'anthropic',
      model: 'claude-3-5-sonnet',
      messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hi' }],
    });

    expect(res.text).toBe('Anthropic reply');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/messages');
    const headers = init?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('test-anthropic-key');
    const body = JSON.parse(String(init?.body));
    expect(body.system).toBe('sys');
  });

  it('calls Gemini generateContent endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Gemini reply' }] } }],
        usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3 },
      }),
    } as Response);

    process.env.GEMINI_API_KEY = 'test-gemini-key';
    const client = new AiClient();
    const res = await client.complete({ provider: 'gemini', model: 'gemini-2.5-pro', messages: [{ role: 'user', content: 'hi' }] });

    expect(res.text).toBe('Gemini reply');
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/models/gemini-2.5-pro:generateContent');
  });

  it('throws UNKNOWN_PROVIDER for unsupported provider', async () => {
    const client = new AiClient();
    await expect(client.complete({ provider: 'nope', model: 'x', messages: [] })).rejects.toMatchObject({ code: 'UNKNOWN_PROVIDER' });
  });
});
