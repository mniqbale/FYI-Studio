// Unit tests for the Context Assembly Engine (Milestone 4).
// `assembleContext` reads tenant knowledge + memory from the DB-backed
// `knowledge-base` and `memory` modules; those are mocked here so the
// assembly logic can be tested in isolation (no Prisma / network).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assembleContext } from '../src/context-assembly.js';

// Mock the DB-backed modules feeding assembleContext.
// vi.hoisted is required so the mock fns exist before the hoisted vi.mock factory runs.
const mocks = vi.hoisted(() => ({
  getTenantKnowledge: vi.fn(),
  listMemory: vi.fn(),
}));

vi.mock('../src/knowledge-base.js', () => ({
  getTenantKnowledge: mocks.getTenantKnowledge,
}));

vi.mock('../src/memory.js', () => ({
  listMemory: mocks.listMemory,
}));

const { getTenantKnowledge, listMemory } = mocks;

/** A canned TenantContext-shaped knowledge record. */
const cannedKb = {
  tenant_id: 'tenant-1',
  brand_voice: 'Witty and direct, with a dash of irreverence.',
  language: 'en',
  style_guide: 'Short sentences. Present tense. Active voice.',
  verified_facts: ['The sun is a star.', 'Water freezes at 0C.'],
  asset_library: ['s3://assets/logo.png'],
  forbidden_terms: ['synergy', 'paradigm'],
  constraints: { max_duration_sec: 300, tone: 'playful' },
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
};

const cannedMemory = [
  {
    id: 'mem-1',
    tenant_id: 'tenant-1',
    job_id: 'job-1',
    kind: 'performance',
    content: { retention: 0.72 },
    created_at: new Date('2026-01-02T00:00:00Z'),
  },
  {
    id: 'mem-2',
    tenant_id: 'tenant-1',
    job_id: 'job-2',
    kind: 'edit',
    content: { note: 'shorten hooks' },
    created_at: new Date('2026-01-03T00:00:00Z'),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  getTenantKnowledge.mockReset();
  listMemory.mockReset();
});

describe('assembleContext', () => {
  it('assembles brand voice, forbidden terms, constraints, facts, and memory', async () => {
    getTenantKnowledge.mockResolvedValue(cannedKb);
    listMemory.mockResolvedValue(cannedMemory);

    const ctx = await assembleContext('tenant-1');

    expect(ctx.tenant_id).toBe('tenant-1');
    expect(ctx.brand_voice).toBe(cannedKb.brand_voice);
    expect(ctx.language).toBe('en');
    expect(ctx.style_guide).toBe(cannedKb.style_guide);
    expect(ctx.forbidden_terms).toEqual(['synergy', 'paradigm']);
    expect(ctx.constraints).toEqual({ max_duration_sec: 300, tone: 'playful' });
    expect(ctx.verified_facts).toEqual(['The sun is a star.', 'Water freezes at 0C.']);
    expect(ctx.memory).toHaveLength(2);
    expect(ctx.memory[0]).toMatchObject({ kind: 'performance', content: { retention: 0.72 } });
    expect(ctx.memory[1]).toMatchObject({ kind: 'edit', content: { note: 'shorten hooks' } });
    expect(getTenantKnowledge).toHaveBeenCalledWith('tenant-1');
    expect(listMemory).toHaveBeenCalledWith('tenant-1', { limit: 5 });
  });

  it('respects includeForbiddenTerms:false (empty array, content still fetched)', async () => {
    getTenantKnowledge.mockResolvedValue(cannedKb);
    listMemory.mockResolvedValue([]);

    const ctx = await assembleContext('tenant-1', { includeForbiddenTerms: false });

    expect(ctx.forbidden_terms).toEqual([]);
    expect(ctx.verified_facts).toEqual(cannedKb.verified_facts);
    expect(ctx.constraints).toEqual(cannedKb.constraints);
  });

  it('respects includeStyleGuide:false and includeFacts:false', async () => {
    getTenantKnowledge.mockResolvedValue(cannedKb);
    listMemory.mockResolvedValue([]);

    const ctx = await assembleContext('tenant-1', { includeStyleGuide: false, includeFacts: false });

    expect(ctx.style_guide).toBeUndefined();
    expect(ctx.verified_facts).toEqual([]);
    expect(ctx.brand_voice).toBe(cannedKb.brand_voice);
  });

  it('respects memoryLimit:0 (no memory fetched)', async () => {
    getTenantKnowledge.mockResolvedValue(cannedKb);
    listMemory.mockResolvedValue([]);

    const ctx = await assembleContext('tenant-1', { memoryLimit: 0 });

    expect(ctx.memory).toEqual([]);
    expect(listMemory).not.toHaveBeenCalled();
  });

  it('returns sensible empty defaults when no knowledge entry exists', async () => {
    getTenantKnowledge.mockResolvedValue(null);
    listMemory.mockResolvedValue([]);

    const ctx = await assembleContext('unknown-tenant');

    expect(ctx.tenant_id).toBe('unknown-tenant');
    expect(ctx.brand_voice).toBeUndefined();
    expect(ctx.language).toBe('en');
    expect(ctx.style_guide).toBeUndefined();
    expect(ctx.forbidden_terms).toEqual([]);
    expect(ctx.constraints).toEqual({});
    expect(ctx.verified_facts).toEqual([]);
    expect(ctx.memory).toEqual([]);
  });

  it('caps memory to memoryLimit and normalizes createdAt to ISO strings', async () => {
    getTenantKnowledge.mockResolvedValue(cannedKb);
    // Emulate the DB `take` behaviour: listMemory returns at most `limit` rows.
    listMemory.mockImplementation(async (_tid: string, opts: { limit?: number } = {}) =>
      cannedMemory.slice(0, opts.limit),
    );

    const ctx = await assembleContext('tenant-1', { memoryLimit: 1 });

    expect(ctx.memory).toHaveLength(1);
    expect(listMemory).toHaveBeenCalledWith('tenant-1', { limit: 1 });
    expect(typeof ctx.memory[0]?.created_at).toBe('string');
    expect(ctx.memory[0]?.created_at).toBe('2026-01-02T00:00:00.000Z');
  });

  it('resolves target_duration_seconds from explicit production_preferences.duration_seconds', async () => {
    getTenantKnowledge.mockResolvedValue({
      ...cannedKb,
      constraints: { production_preferences: { format: 'vertical', resolution: '1080x1920', duration: '1-3 min', duration_seconds: 120 } },
    });
    listMemory.mockResolvedValue([]);

    const ctx = await assembleContext('tenant-1');

    expect(ctx.target_duration_seconds).toBe(120);
  });

  it('falls back to parsing a "N-M min" range midpoint when duration_seconds is absent', async () => {
    getTenantKnowledge.mockResolvedValue({
      ...cannedKb,
      constraints: { production_preferences: { format: 'horizontal', resolution: '1920x1080', duration: '8-12 min' } },
    });
    listMemory.mockResolvedValue([]);

    const ctx = await assembleContext('tenant-1');

    // (8 + 12) / 2 = 10 min = 600 seconds.
    expect(ctx.target_duration_seconds).toBe(600);
  });

  it('leaves target_duration_seconds undefined when no numeric target exists', async () => {
    getTenantKnowledge.mockResolvedValue({
      ...cannedKb,
      constraints: { production_preferences: { format: 'horizontal', resolution: '1920x1080' } },
    });
    listMemory.mockResolvedValue([]);

    const ctx = await assembleContext('tenant-1');

    expect(ctx.target_duration_seconds).toBeUndefined();
  });
});
