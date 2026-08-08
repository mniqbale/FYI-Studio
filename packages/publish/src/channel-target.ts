// Channel-aware publish target resolution (Phase 2.3 — Publishing-aware v1).
//
// AC-1 / AC-4: the publishing target for a job is resolved from the Channel's
// `publishing_strategy` (stored in tenant_context.constraints), NOT from a
// global/hardcoded config. This makes the Channel's strategy genuinely drive
// the publishing decision.
//
// The worker stays capability-only (ADR-0011): it never names a vendor or
// platform directly — it resolves a target and lets the adapter layer handle
// the platform specifics.

import { prisma } from '@fyi/database';
import { createTaskLogger } from '@fyi/utils';

export interface PublishTarget {
  social_account_id: string;
  platform: string;
  display_name: string;
  account_ref: string;
  token_ref: string;
  /** Which publishing_strategy entry selected this account. */
  strategy_platform: string;
}

export interface ChannelPublishingStrategy {
  platforms: string[];
  cadence?: string;
}

/**
 * Resolve the publishing target for a Channel from its `publishing_strategy`.
 * Returns the first enabled social account whose platform is listed in the
 * strategy. Throws if the strategy is missing or no matching account exists.
 */
export async function resolvePublishTarget(tenantId: string): Promise<PublishTarget> {
  const taskLog = createTaskLogger({ job_id: 'publish-resolve', execution_id: `resolve-${tenantId}` });

  // Read the Channel's publishing_strategy from tenant_context.constraints.
  const kb = await prisma.tenantContext.findUnique({ where: { tenant_id: tenantId } });
  const constraints = (kb?.constraints as Record<string, unknown> | null) ?? {};
  const strategy = constraints.publishing_strategy as ChannelPublishingStrategy | undefined;

  if (!strategy || !Array.isArray(strategy.platforms) || strategy.platforms.length === 0) {
    throw new Error(`Publish target resolution failed: Channel '${tenantId}' has no publishing_strategy`);
  }

  // Find the first enabled social account matching a strategy platform.
  const accounts = await prisma.socialAccount.findMany({
    where: { tenant_id: tenantId, enabled: true },
  });

  for (const platform of strategy.platforms) {
    const account = accounts.find((a) => a.platform === platform);
    if (account) {
      taskLog.info(
        { tenant_id: tenantId, platform, social_account_id: account.id },
        'Resolved publish target from Channel publishing_strategy',
      );
      return {
        social_account_id: account.id,
        platform: account.platform,
        display_name: account.display_name,
        account_ref: account.account_ref,
        token_ref: account.token_ref,
        strategy_platform: platform,
      };
    }
  }

  throw new Error(
    `Publish target resolution failed: Channel '${tenantId}' strategy lists [${strategy.platforms.join(', ')}] but no enabled account matches`,
  );
}

/**
 * Build the Publish Intent (AC-3): the explicit relation
 *   Channel -> Content Brief -> Video Artifact -> Platform Account -> Intent
 * captured on a ScheduledPublish. Reads the job's artifacts to resolve the
 * brief id and video pointer.
 */
export async function buildPublishIntent(
  tenantId: string,
  jobId: string,
  target: PublishTarget,
): Promise<Record<string, unknown>> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  const artifacts = (job?.artifacts as Record<string, unknown> | null) ?? {};
  const planner = (artifacts.planner as Record<string, unknown> | undefined) ?? {};
  const brief = (planner.content_brief as Record<string, unknown> | undefined) ?? {};
  const video = (artifacts.video as Record<string, unknown> | undefined) ?? {};

  return {
    channel_id: tenantId,
    content_brief_id: typeof brief.brief_id === 'string' ? brief.brief_id : undefined,
    video_artifact: typeof video.video_path === 'string' ? video.video_path : undefined,
    platform: target.platform,
    social_account_id: target.social_account_id,
    intent: 'publish-ready',
  };
}
