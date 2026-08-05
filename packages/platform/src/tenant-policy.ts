// Tenant Policy Engine (Milestone 6, MVP-scoped).
//
// Manages per-tenant policies: model preferences by capability and a cost
// quota. Enforces tenant isolation and per-tenant model selection / budget.
// A/B testing, Worker Registry v2, and dashboard are deferred to post-MVP.

import { prisma, Prisma } from '@fyi/database';
import type { TenantPolicy } from '@fyi/database';
import { createTaskLogger } from '@fyi/utils';

/** Per-capability model preference. */
export interface ModelPreference {
  provider: string;
  model: string;
}

/** Input for creating/updating a tenant policy. */
export interface TenantPolicyInput {
  tenant_id: string;
  model_preferences?: Record<string, ModelPreference>;
  cost_quota?: number | null;
  enabled?: boolean;
}

/** Upsert a tenant policy (idempotent by tenant_id). */
export async function upsertTenantPolicy(input: TenantPolicyInput): Promise<TenantPolicy> {
  if (!input.tenant_id) throw new Error('tenant_id is required');
  const data = {
    model_preferences: (input.model_preferences ?? {}) as unknown as Prisma.InputJsonValue,
    cost_quota: input.cost_quota !== undefined ? input.cost_quota : null,
    enabled: input.enabled ?? true,
  };
  return prisma.tenantPolicy.upsert({
    where: { tenant_id: input.tenant_id },
    update: data,
    create: { tenant_id: input.tenant_id, ...data },
  });
}

/** Get a tenant policy, or null if none exists. */
export async function getTenantPolicy(tenant_id: string): Promise<TenantPolicy | null> {
  return prisma.tenantPolicy.findUnique({ where: { tenant_id } });
}

/** Delete a tenant policy. */
export async function deleteTenantPolicy(tenant_id: string): Promise<void> {
  await prisma.tenantPolicy.deleteMany({ where: { tenant_id } });
}

/** Whether a tenant is allowed to run jobs (policy absent => enabled). */
export async function tenantEnabled(tenant_id: string): Promise<boolean> {
  const policy = await getTenantPolicy(tenant_id);
  return policy ? policy.enabled : true;
}

/** Per-tenant model preference for a capability, if set. */
export async function tenantModelPreference(
  tenant_id: string,
  capability: string,
): Promise<ModelPreference | undefined> {
  const policy = await getTenantPolicy(tenant_id);
  if (!policy) return undefined;
  const prefs = policy.model_preferences as unknown as Record<string, ModelPreference> | undefined;
  return prefs?.[capability];
}

/** Total cost spent by a tenant so far (sum of telemetry.cost via joined jobs). */
export async function tenantSpend(tenant_id: string): Promise<number> {
  const rows = await prisma.telemetry.findMany({
    where: { job: { tenant_id } },
    select: { cost: true },
  });
  return rows.reduce((acc, r) => acc + (Number(r.cost) || 0), 0);
}

/** Check if a tenant has exceeded its cost quota. Returns { allowed, remaining, quota }. */
export async function checkTenantQuota(
  tenant_id: string,
): Promise<{ allowed: boolean; spend: number; quota: number | null; remaining: number | null }> {
  const policy = await getTenantPolicy(tenant_id);
  const spend = await tenantSpend(tenant_id);
  const quota = policy?.cost_quota != null ? Number(policy.cost_quota) : null;
  if (quota == null) return { allowed: true, spend, quota: null, remaining: null };
  const remaining = quota - spend;
  return { allowed: remaining > 0, spend, quota, remaining };
}

/** Log a quota/tenant event with tenant context (structured logging). */
export function logTenantEvent(tenant_id: string, msg: string, extra: Record<string, unknown> = {}): void {
  createTaskLogger({ job_id: 'tenant', execution_id: tenant_id }).info({ tenant_id, ...extra }, msg);
}
