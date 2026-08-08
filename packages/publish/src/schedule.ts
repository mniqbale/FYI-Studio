// Scheduled-publish logic (Issue 9.2 / 9.4). Writes to scheduled_publishes are
// scoped here so all callers share the status-machine invariants:
//   scheduled -> publishing -> published | failed (ADR-0008).
// `attempts` tracks retries; scheduling stores `scheduled_at` in UTC.

import { prisma, Prisma, type ScheduledPublish } from '@fyi/database';

export type ScheduledPublishStatus = 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';

export interface SchedulePublishInput {
  tenant_id: string;
  job_id: string;
  social_account_id: string;
  scheduled_at: Date;
  /** Publish Intent (AC-3): Channel -> Brief -> Video -> Account -> Intent. */
  intent?: Record<string, unknown>;
}

export interface ScheduledPublishView {
  id: string;
  tenant_id: string;
  job_id: string;
  social_account_id: string;
  scheduled_at: Date;
  status: string;
  platform_response: Record<string, unknown> | null;
  intent: Record<string, unknown> | null;
  attempts: number;
  created_at: Date;
  updated_at: Date;
}

function toView(row: ScheduledPublish): ScheduledPublishView {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    job_id: row.job_id,
    social_account_id: row.social_account_id,
    scheduled_at: row.scheduled_at,
    status: row.status,
    platform_response: (row.platform_response as Record<string, unknown> | null) ?? null,
    intent: (row.intent as Record<string, unknown> | null) ?? null,
    attempts: row.attempts,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Create a scheduled publish for an approved job. Validates that the target
 * social account exists for the tenant and is enabled.
 */
export async function schedulePublish(
  input: SchedulePublishInput,
): Promise<ScheduledPublishView> {
  const account = await prisma.socialAccount.findFirst({
    where: { id: input.social_account_id, tenant_id: input.tenant_id, enabled: true },
  });
  if (!account) {
    throw new Error(
      `Cannot schedule publish: social account '${input.social_account_id}' not found or disabled for tenant '${input.tenant_id}'`,
    );
  }
  const row = await prisma.scheduledPublish.create({
    data: {
      tenant_id: input.tenant_id,
      job_id: input.job_id,
      social_account_id: input.social_account_id,
      scheduled_at: input.scheduled_at,
      status: 'scheduled',
      attempts: 0,
      intent: (input.intent ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
    },
  });
  return toView(row);
}

/** List scheduled publishes for a tenant (all statuses, newest first). */
export async function listScheduledPublishes(tenantId: string): Promise<ScheduledPublishView[]> {
  const rows = await prisma.scheduledPublish.findMany({
    where: { tenant_id: tenantId },
    orderBy: { scheduled_at: 'desc' },
  });
  return rows.map(toView);
}

/** Get a single scheduled publish by id + tenant. */
export async function getScheduledPublish(
  id: string,
  tenantId: string,
): Promise<ScheduledPublishView | null> {
  const row = await prisma.scheduledPublish.findFirst({
    where: { id, tenant_id: tenantId },
  });
  return row ? toView(row) : null;
}

/** Cancel a scheduled publish that has not yet been picked up. */
export async function cancelScheduledPublish(
  id: string,
  tenantId: string,
): Promise<ScheduledPublishView | null> {
  const existing = await getScheduledPublish(id, tenantId);
  if (!existing) return null;
  if (existing.status !== 'scheduled') {
    throw new Error(`Cannot cancel scheduled publish in status '${existing.status}'`);
  }
  const row = await prisma.scheduledPublish.update({
    where: { id },
    data: { status: 'cancelled' },
  });
  return toView(row);
}

/** Find due publishes: status='scheduled' and scheduled_at <= now (UTC). */
export async function findDuePublishes(now = new Date()): Promise<ScheduledPublishView[]> {
  const rows = await prisma.scheduledPublish.findMany({
    where: { status: 'scheduled', scheduled_at: { lte: now } },
    orderBy: { scheduled_at: 'asc' },
  });
  return rows.map(toView);
}

/**
 * Atomically claim a due publish by flipping its status to 'publishing'.
 * Returns null if the row was already claimed by another scheduler tick
 * (guards against double-dispatch on overlap). Attempt counting is handled on
 * retry/failure, not at claim time.
 */
export async function claimPublish(id: string): Promise<ScheduledPublishView | null> {
  const updated = await prisma.scheduledPublish.updateMany({
    where: { id, status: 'scheduled' },
    data: { status: 'publishing' },
  });
  if (updated.count === 0) return null;
  const row = await prisma.scheduledPublish.findUnique({ where: { id } });
  return row ? toView(row) : null;
}
