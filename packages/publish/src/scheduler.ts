// Scheduler sweep (Issue 9.4 / ADR-0008). The BullMQ repeatable job runs this
// on an interval: find due publishes, claim each (mark 'publishing'), and
// enqueue to the publish-queue. The worker then uploads and writes the result
// back via writeback.ts. `claimPublish` is atomic so overlapping scheduler
// ticks cannot double-dispatch the same row.

import { type Queue } from 'bullmq';
import { prisma } from '@fyi/database';
import { createTaskLogger } from '@fyi/utils';
import { findDuePublishes, claimPublish } from './schedule.js';

export const PUBLISH_QUEUE_NAME = 'publish-queue';

export interface PublishTask {
  scheduledPublishId: string;
  tenantId: string;
  jobId: string;
  socialAccountId: string;
  /** Platform kind resolved from the social account (e.g. 'youtube'). */
  adapter: string;
  /** Resolved social account details for the worker (no token material). */
  account: {
    id: string;
    platform: string;
    display_name: string;
    account_ref: string;
    token_ref: string;
  };
}

/**
 * Sweep due publishes and enqueue them to the publish-queue. Returns the
 * number of publishes enqueued. Accepts an injectable `queue` so unit tests can
 * pass a stub without a live Redis connection.
 */
export async function sweepDuePublishes(
  publishQueue: Pick<Queue, 'add'>,
  now = new Date(),
): Promise<number> {
  const due = await findDuePublishes(now);
  const taskLog = createTaskLogger({ job_id: 'publish-sweep', execution_id: `sweep-${Date.now()}` });
  if (due.length === 0) return 0;

  let enqueued = 0;
  for (const row of due) {
    // Load the social account to resolve the adapter kind (never the token).
    const account = await findSocialAccount(row.social_account_id);
    if (!account) {
      taskLog.warn(
        { scheduled_publish_id: row.id, social_account_id: row.social_account_id },
        'Skipping due publish: social account not found',
      );
      continue;
    }
    if (!account.enabled) {
      taskLog.warn(
        { scheduled_publish_id: row.id, social_account_id: account.id },
        'Skipping due publish: social account disabled',
      );
      continue;
    }

    // Atomically claim before enqueue to avoid double-dispatch.
    const claimed = await claimPublish(row.id);
    if (!claimed) {
      taskLog.info({ scheduled_publish_id: row.id }, 'Skipping due publish: already claimed');
      continue;
    }

    const task: PublishTask = {
      scheduledPublishId: claimed.id,
      tenantId: claimed.tenant_id,
      jobId: claimed.job_id,
      socialAccountId: account.id,
      adapter: account.platform,
      account: {
        id: account.id,
        platform: account.platform,
        display_name: account.display_name,
        account_ref: account.account_ref,
        token_ref: account.token_ref,
      },
    };
    await publishQueue.add('publish', task, {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 1, // no infinite retry (ADR-0004); retries handled by the worker/backoff
      backoff: { type: 'exponential', delay: 5_000 },
    });
    enqueued += 1;
    taskLog.info(
      { scheduled_publish_id: claimed.id, job_id: claimed.job_id, adapter: account.platform },
      'Enqueued due publish',
    );
  }
  return enqueued;
}

/** Resolve the social account backing a scheduled publish. */
async function findSocialAccount(
  id: string,
): Promise<{
  id: string;
  platform: string;
  display_name: string;
  account_ref: string;
  token_ref: string;
  enabled: boolean;
} | null> {
  const row = await prisma.socialAccount.findUnique({ where: { id } });
  if (!row) return null;
  return {
    id: row.id,
    platform: row.platform,
    display_name: row.display_name,
    account_ref: row.account_ref,
    token_ref: row.token_ref,
    enabled: row.enabled,
  };
}
