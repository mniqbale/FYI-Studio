// Social publish & schedule data access for the Settings page (Issue 9.2).
// Wraps @fyi/publish registry + schedule functions for the dashboard UI.
import { prisma } from './prisma.js';

export interface SocialAccountRow {
  id: string;
  tenant_id: string;
  platform: string;
  display_name: string;
  account_ref: string;
  token_ref: string;
  enabled: boolean;
}

export interface ScheduledPublishRow {
  id: string;
  tenant_id: string;
  job_id: string;
  social_account_id: string;
  scheduled_at: string;
  status: string;
  platform_response: unknown;
  attempts: number;
}

export async function listSocialAccounts(tenantId?: string): Promise<SocialAccountRow[]> {
  const rows = await prisma.socialAccount.findMany({
    where: tenantId ? { tenant_id: tenantId } : {},
    orderBy: { created_at: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    platform: r.platform,
    display_name: r.display_name,
    account_ref: r.account_ref,
    token_ref: r.token_ref,
    enabled: r.enabled,
  }));
}

export async function listScheduledPublishes(tenantId?: string): Promise<ScheduledPublishRow[]> {
  const rows = await prisma.scheduledPublish.findMany({
    where: tenantId ? { tenant_id: tenantId } : {},
    orderBy: { scheduled_at: 'desc' },
    take: 100,
  });
  return rows.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    job_id: r.job_id,
    social_account_id: r.social_account_id,
    scheduled_at: r.scheduled_at.toISOString(),
    status: r.status,
    platform_response: r.platform_response,
    attempts: r.attempts,
  }));
}

export async function getJobsForScheduling(): Promise<Array<{ id: string; status: string }>> {
  const rows = await prisma.job.findMany({
    where: { status: { in: ['COMPLETED', 'RUNNING'] } },
    select: { id: true, status: true },
    orderBy: { created_at: 'desc' },
    take: 100,
  });
  return rows;
}
