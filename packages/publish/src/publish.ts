// Publish execution + write-back (Issue 9.3 / 9.4 / ADR-0008). The worker
// resolves the video file pointer from the job artifacts, calls the platform
// adapter, and on success writes the result back to scheduled_publishes
// (platform_response + status) and jobs.artifacts.published. On failure it
// increments attempts and, if retryable and under the cap, re-enqueues with
// backoff (ADR-0004: no infinite self-retry).

import { type Queue } from 'bullmq';
import { prisma } from '@fyi/database';
import { createTaskLogger } from '@fyi/utils';
import type { PlatformAdapter, PlatformPublishError } from './adapters/types.js';
import type { PublishTask } from './scheduler.js';

export const MAX_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 5_000;

/** The artifact key under which the composed video pointer is stored. */
export const VIDEO_ARTIFACT_KEYS = ['video.video_path', 'video_path', 'video.url'] as const;

/** Resolve the absolute video file pointer from a job's artifacts. */
export function resolveVideoPath(artifacts: Record<string, unknown>): string | undefined {
  const refs = (artifacts._references as Record<string, string> | undefined) ?? {};
  if (refs.video) return refs.video;
  for (const key of VIDEO_ARTIFACT_KEYS) {
    const value = lookupPath(artifacts, key);
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

function lookupPath(obj: Record<string, unknown>, path: string): unknown {
  let current: unknown = obj;
  for (const part of path.split('.')) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Build the title/description for an upload from a job's artifacts. */
export function buildUploadMetadata(
  artifacts: Record<string, unknown>,
): { title: string; description: string } {
  const script = (artifacts.script as Record<string, unknown> | undefined) ?? {};
  const title = typeof script.title === 'string' ? script.title : 'FYI Studio Video';
  const summary = (artifacts.research as Record<string, unknown> | undefined)?.summary;
  const description = typeof summary === 'string' ? summary : '';
  return { title, description };
}

/**
 * Execute a single publish: resolve the video pointer, invoke the adapter, and
 * write the result back. Returns the PublishResult on success. On failure it
 * throws the original error (retry decision handled by `runPublish`).
 */
export async function executePublish(
  adapter: PlatformAdapter,
  task: PublishTask,
): Promise<{ videoId: string; url: string; platform: string }> {
  const taskLog = createTaskLogger({ job_id: task.jobId, execution_id: `publish-${task.scheduledPublishId}` });
  const job = await prisma.job.findUnique({ where: { id: task.jobId } });
  if (!job) {
    throw new Error(`Publish aborted: job '${task.jobId}' not found`);
  }
  const artifacts = (job.artifacts as Record<string, unknown>) ?? {};
  const videoPath = resolveVideoPath(artifacts);
  if (!videoPath) {
    throw new Error(`Publish aborted: no video artifact found for job '${task.jobId}'`);
  }
  const { title, description } = buildUploadMetadata(artifacts);

  taskLog.info({ adapter: adapter.platform, video_path: videoPath, title }, 'Publishing to platform');
  const result = await adapter.publish({
    videoPath,
    title,
    description,
    tokenRef: task.account.token_ref,
    tenantId: task.tenantId,
  });
  taskLog.info({ video_id: result.videoId, url: result.url }, 'Publish succeeded');
  return result;
}

/** Write a successful result back to scheduled_publishes + jobs.artifacts. */
export async function writePublishSuccess(
  scheduledPublishId: string,
  jobId: string,
  result: { videoId: string; url: string; platform: string },
): Promise<void> {
  await prisma.scheduledPublish.update({
    where: { id: scheduledPublishId },
    data: {
      status: 'published',
      platform_response: { videoId: result.videoId, url: result.url, platform: result.platform },
    },
  });
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (job) {
    const artifacts = ((job.artifacts as Record<string, unknown>) ?? {}) as Record<string, unknown>;
    const published = {
      platform: result.platform,
      url: result.url,
      videoId: result.videoId,
      published_at: new Date().toISOString(),
    };
    await prisma.job.update({
      where: { id: jobId },
      data: { artifacts: { ...artifacts, published } },
    });
  }
}

/** Record a failed publish: status='failed' + platform_response.error. */
export async function writePublishFailure(
  scheduledPublishId: string,
  error: Error,
): Promise<void> {
  await prisma.scheduledPublish.update({
    where: { id: scheduledPublishId },
    data: {
      status: 'failed',
      platform_response: { error: error.message },
    },
  });
}

/**
 * Retry decision: returns true when the error is retryable AND attempts are
 * under the cap. Non-retryable errors (e.g. no adapter, missing file) and
 * exhausted attempts become terminal failures.
 */
export function shouldRetry(error: Error, attempts: number, max = MAX_ATTEMPTS): boolean {
  if (attempts >= max) return false;
  const err = error as Partial<PlatformPublishError>;
  if (typeof err.retryable === 'boolean') return err.retryable;
  return true; // plain errors default to retryable
}

/**
 * Run a publish task end-to-end with retry-with-backoff. On success writes the
 * result back. On a retryable, under-cap failure re-enqueues to the
 * publish-queue (incrementing attempts) and leaves status 'publishing' so the
 * next attempt owns it. On a terminal failure writes status='failed'.
 */
export async function runPublish(
  publishQueue: Pick<Queue, 'add'>,
  adapter: PlatformAdapter,
  task: PublishTask,
  opts: { maxAttempts?: number; retryDelayMs?: number } = {},
): Promise<{ status: 'published' | 'failed'; result?: { videoId: string; url: string; platform: string } }> {
  const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;
  const retryDelayMs = opts.retryDelayMs ?? RETRY_DELAY_MS;
  const taskLog = createTaskLogger({ job_id: task.jobId, execution_id: `publish-${task.scheduledPublishId}` });

  try {
    const result = await executePublish(adapter, task);
    await writePublishSuccess(task.scheduledPublishId, task.jobId, result);
    return { status: 'published', result };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const current = await getAttempts(task.scheduledPublishId);
    const next = current + 1;
    if (shouldRetry(error, next, maxAttempts)) {
      await prisma.scheduledPublish.update({
        where: { id: task.scheduledPublishId },
        data: { attempts: next },
      });
      await publishQueue.add('publish', task, {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 1,
        backoff: { type: 'exponential', delay: retryDelayMs },
        delay: retryDelayMs,
      });
      taskLog.warn(
        { error_message: error.message, attempt: next, max_attempts: maxAttempts },
        'Publish failed; scheduling retry with backoff',
      );
      return { status: 'failed' };
    }
    await writePublishFailure(task.scheduledPublishId, error);
    taskLog.error(
      { error_message: error.message, attempt: next, retryable: (error as Partial<PlatformPublishError>).retryable ?? true },
      'Publish failed permanently',
    );
    return { status: 'failed' };
  }
}

/** Read the current attempts count for a scheduled publish. */
export async function getAttempts(scheduledPublishId: string): Promise<number> {
  const row = await prisma.scheduledPublish.findUnique({ where: { id: scheduledPublishId } });
  return row?.attempts ?? 0;
}
