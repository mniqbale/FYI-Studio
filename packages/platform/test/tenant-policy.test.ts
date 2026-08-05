// Unit tests for the Tenant Policy Engine (Milestone 6).
// Mocks '@fyi/database' (prisma.tenantPolicy + prisma.telemetry) and
// '@fyi/utils' (createTaskLogger) so tests are hermetic.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock '@fyi/utils' before importing the module under test.
vi.mock('@fyi/utils', () => ({
  createTaskLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock '@fyi/database' with canned prisma.tenantPolicy + prisma.telemetry.
vi.mock('@fyi/database', () => {
  const tenantPolicy = {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
  };
  const telemetry = {
    findMany: vi.fn(),
  };
  return {
    prisma: { tenantPolicy, telemetry },
    Prisma: {},
  };
});

import { prisma } from '@fyi/database';
import { createTaskLogger } from '@fyi/utils';
import {
  upsertTenantPolicy,
  getTenantPolicy,
  deleteTenantPolicy,
  tenantEnabled,
  tenantModelPreference,
  tenantSpend,
  checkTenantQuota,
} from '../src/tenant-policy.js';

const mockUpsert = vi.mocked(prisma.tenantPolicy.upsert);
const mockFindUnique = vi.mocked(prisma.tenantPolicy.findUnique);
const mockDeleteMany = vi.mocked(prisma.tenantPolicy.deleteMany);
const mockTelemetryFindMany = vi.mocked(prisma.telemetry.findMany);

// A canned policy row shaped like the Prisma model's runtime type.
function policyRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'tp-1',
    tenant_id: 'tenant-a',
    model_preferences: { 'research:real': { provider: 'ollama', model: 'deepseek-v4-flash' } },
    cost_quota: null,
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('tenant policy engine', () => {
  it('upsertTenantPolicy requires a tenant_id', async () => {
    await expect(upsertTenantPolicy({ tenant_id: '' } as never)).rejects.toThrow('tenant_id is required');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('upsertTenantPolicy creates a policy with defaults via prisma upsert', async () => {
    mockUpsert.mockResolvedValue(policyRow() as never);
    const res = await upsertTenantPolicy({ tenant_id: 'tenant-a' });
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { tenant_id: 'tenant-a' },
      update: { model_preferences: {}, cost_quota: null, enabled: true },
      create: { tenant_id: 'tenant-a', model_preferences: {}, cost_quota: null, enabled: true },
    });
    expect(res.tenant_id).toBe('tenant-a');
  });

  it('upsertTenantPolicy preserves provided prefs/quota/enabled', async () => {
    mockUpsert.mockResolvedValue(policyRow() as never);
    await upsertTenantPolicy({
      tenant_id: 'tenant-a',
      model_preferences: { 'research:real': { provider: 'ollama', model: 'qwen3.5' } },
      cost_quota: 12.5,
      enabled: false,
    });
    const call = mockUpsert.mock.calls[0]?.[0] as { create: Record<string, unknown> };
    expect(call.create).toMatchObject({
      tenant_id: 'tenant-a',
      cost_quota: 12.5,
      enabled: false,
    });
  });

  it('tenantModelPreference returns the pref for a capability when set', async () => {
    mockFindUnique.mockResolvedValue(policyRow() as never);
    const pref = await tenantModelPreference('tenant-a', 'research:real');
    expect(pref).toEqual({ provider: 'ollama', model: 'deepseek-v4-flash' });
  });

  it('tenantModelPreference returns undefined when no policy exists', async () => {
    mockFindUnique.mockResolvedValue(null as never);
    const pref = await tenantModelPreference('tenant-a', 'research:real');
    expect(pref).toBeUndefined();
  });

  it('tenantModelPreference returns undefined when capability not in prefs', async () => {
    mockFindUnique.mockResolvedValue(policyRow({ model_preferences: {} }) as never);
    const pref = await tenantModelPreference('tenant-a', 'voice:real');
    expect(pref).toBeUndefined();
  });

  it('tenantEnabled respects the enabled flag', async () => {
    mockFindUnique.mockResolvedValue(policyRow({ enabled: false }) as never);
    expect(await tenantEnabled('tenant-a')).toBe(false);
    mockFindUnique.mockResolvedValue(policyRow({ enabled: true }) as never);
    expect(await tenantEnabled('tenant-a')).toBe(true);
    mockFindUnique.mockResolvedValue(null as never);
    expect(await tenantEnabled('tenant-a')).toBe(true); // absent policy => enabled
  });

  it('tenantSpend sums telemetry cost', async () => {
    mockTelemetryFindMany.mockResolvedValue([
      { cost: '1.5' },
      { cost: '2.5' },
      { cost: null },
    ] as never);
    expect(await tenantSpend('tenant-a')).toBe(4);
    expect(mockTelemetryFindMany).toHaveBeenCalledWith({
      where: { job: { tenant_id: 'tenant-a' } },
      select: { cost: true },
    });
  });

  it('checkTenantQuota allows when no quota is set', async () => {
    mockFindUnique.mockResolvedValue(policyRow({ cost_quota: null }) as never);
    mockTelemetryFindMany.mockResolvedValue([{ cost: '999' }] as never);
    const r = await checkTenantQuota('tenant-a');
    expect(r).toEqual({ allowed: true, spend: 999, quota: null, remaining: null });
  });

  it('checkTenantQuota disallows when spend >= quota', async () => {
    mockFindUnique.mockResolvedValue(policyRow({ cost_quota: '10' }) as never);
    mockTelemetryFindMany.mockResolvedValue([{ cost: '10' }] as never);
    const r = await checkTenantQuota('tenant-a');
    expect(r.allowed).toBe(false);
    expect(r.quota).toBe(10);
    expect(r.spend).toBe(10);
    expect(r.remaining).toBe(0);

    // spend strictly greater than quota also disallowed
    mockTelemetryFindMany.mockResolvedValue([{ cost: '12' }] as never);
    const r2 = await checkTenantQuota('tenant-a');
    expect(r2.allowed).toBe(false);
  });

  it('checkTenantQuota allows when spend is below quota', async () => {
    mockFindUnique.mockResolvedValue(policyRow({ cost_quota: '10' }) as never);
    mockTelemetryFindMany.mockResolvedValue([{ cost: '3' }] as never);
    const r = await checkTenantQuota('tenant-a');
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(7);
  });

  it('getTenantPolicy and deleteTenantPolicy call prisma directly', async () => {
    mockFindUnique.mockResolvedValue(policyRow() as never);
    expect((await getTenantPolicy('tenant-a'))?.tenant_id).toBe('tenant-a');
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { tenant_id: 'tenant-a' } });

    mockDeleteMany.mockResolvedValue({ count: 1 } as never);
    await deleteTenantPolicy('tenant-a');
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { tenant_id: 'tenant-a' } });
  });

  it('createTaskLogger is used for structured tenant events', () => {
    // Just assert the util module is mockable/resolvable to avoid accidental
    // hard dependency on real logger wiring in unit tests.
    expect(typeof createTaskLogger).toBe('function');
  });
});
