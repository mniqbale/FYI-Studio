// Unit tests for ModelGate v2 resolution logic (S2.4).
// Uses an in-memory policy (no DB/network) to test resolution paths + failures.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelGate } from '../src/modelgate.js';
import type { ModelPolicy } from '../src/model-policy.js';

const POLICY: ModelPolicy = {
  capabilities: { reasoning: { description: 'x' }, vision: {} },
  models: [
    { provider: 'openai', model: 'gpt-4o', capabilities: ['reasoning', 'vision'] },
    { provider: 'ollama', model: 'llama3.1', capabilities: ['reasoning'] },
    { provider: 'ollama', model: 'qwen2.5', capabilities: ['structured_output'] },
  ],
  defaults: {
    'research:real': { provider: 'openai', model: 'gpt-4o' },
  },
  worker_capabilities: {
    'research:real': ['reasoning', 'structured_output'],
  },
};

// Mock the connection + registry modules so tests are hermetic.
vi.mock('../src/connection-manager.js', () => ({
  connectedProviderIds: vi.fn(),
}));
vi.mock('../src/model-registry.js', () => ({
  modelSupportsCapabilities: vi.fn(),
  listModelsForCapabilities: vi.fn(),
}));

import { connectedProviderIds } from '../src/connection-manager.js';
import { modelSupportsCapabilities, listModelsForCapabilities } from '../src/model-registry.js';

const mockConnected = vi.mocked(connectedProviderIds);
const mockSupports = vi.mocked(modelSupportsCapabilities);
const mockList = vi.mocked(listModelsForCapabilities);

function makeGate() {
  return new ModelGate(POLICY);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ModelGate v2', () => {
  it('returns the default model when its provider is connected and capable', async () => {
    mockConnected.mockResolvedValue(['openai']);
    mockSupports.mockResolvedValue(true);
    const res = await makeGate().resolve('research:real');
    expect(res.ok).toBe(true);
    expect(res.model).toEqual({ provider: 'openai', model: 'gpt-4o' });
    expect(mockSupports).toHaveBeenCalledWith('openai', 'gpt-4o', ['reasoning', 'structured_output']);
  });

  it('honors a valid user override', async () => {
    mockConnected.mockResolvedValue(['ollama']);
    mockSupports.mockResolvedValue(true);
    const res = await makeGate().resolve('research:real', { override: { provider: 'ollama', model: 'llama3.1' } });
    expect(res.ok).toBe(true);
    expect(res.model).toEqual({ provider: 'ollama', model: 'llama3.1' });
  });

  it('rejects an override for a non-connected provider (NO_CONNECTED_PROVIDER)', async () => {
    mockConnected.mockResolvedValue(['openai']);
    const res = await makeGate().resolve('research:real', { override: { provider: 'vertex', model: 'x' } });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('NO_CONNECTED_PROVIDER');
    expect(res.error?.retryable).toBe(false);
    expect(mockSupports).not.toHaveBeenCalled();
  });

  it('rejects an override with an incompatible model (INCOMPATIBLE_MODEL)', async () => {
    mockConnected.mockResolvedValue(['openai']);
    mockSupports.mockResolvedValue(false);
    const res = await makeGate().resolve('research:real', { override: { provider: 'openai', model: 'gpt-4o' } });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INCOMPATIBLE_MODEL');
  });

  it('falls back to first connected+capable model when default unavailable', async () => {
    mockConnected.mockResolvedValue(['openai']);
    mockSupports.mockResolvedValue(false); // default model not capable
    mockList.mockResolvedValue([
      { id: 'm1', provider: 'openai', model: 'gpt-4o-mini', capabilities: ['reasoning', 'structured_output'], status: 'ACTIVE' } as never,
    ]);
    const res = await makeGate().resolve('research:real');
    expect(res.ok).toBe(true);
    expect(res.model?.model).toBe('gpt-4o-mini');
  });

  it('returns NO_MODEL_FOR_CAPABILITY when no provider is connected', async () => {
    mockConnected.mockResolvedValue([]);
    mockList.mockResolvedValue([]);
    const res = await makeGate().resolve('research:real');
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('NO_MODEL_FOR_CAPABILITY');
    expect(res.error?.message).toContain('No AI providers connected');
  });

  it('returns NO_MODEL_FOR_CAPABILITY when connected providers lack a capable model', async () => {
    mockConnected.mockResolvedValue(['openai']);
    mockSupports.mockResolvedValue(false);
    mockList.mockResolvedValue([]);
    const res = await makeGate().resolve('research:real');
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('NO_MODEL_FOR_CAPABILITY');
  });
});
