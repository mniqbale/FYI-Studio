// Discover published videos to ingest analytics for. Sources (ADR-0009):
//   1. `scheduled_publishes` where status='published' with a platform_response.videoId
//      (Milestone 10 uploads), OR
//   2. `jobs.artifacts.published` / `jobs.artifacts.video_id` where the job's step
//      output carries a video id.
import { prisma } from './prisma.js';
import type { YoutubeClient } from './youtube.js';

export interface PublishedVideo {
  tenantId: string;
  videoId: string;
  platform: string;
  /** Source job id when known (for correlation / memory). */
  jobId: string | null;
}

interface PlatformResponse {
  videoId?: string;
  video_id?: string;
  url?: string;
}

/**
 * Collect distinct published videos to ingest. When a real YouTube client is
 * provided, it lists the connected channel's actual uploads (real analytics).
 * Local scheduled publishes are still merged in (so E2E/mock flows work).
 */
export async function listPublishedVideos(client?: YoutubeClient): Promise<PublishedVideo[]> {
  const out = new Map<string, PublishedVideo>();

  // Source 0: real channel uploads (when a real OAuth client is active).
  if (client) {
    let channelVideos: string[] = [];
    try {
      channelVideos = await client.listChannelVideos(50);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('not_found')) {
        // Log but don't fail the whole cycle — fall through to local sources.
        // eslint-disable-next-line no-console
        console.warn(`listChannelVideos failed (will fall back to local sources): ${msg}`);
      }
    }
    for (const videoId of channelVideos) {
      const key = `youtube:${videoId}`;
      if (!out.has(key)) out.set(key, { tenantId: 'default', videoId, platform: 'youtube', jobId: null });
    }
  }

  // Source 1: scheduled publishes with a resolved videoId.
  const publishes = await prisma.scheduledPublish.findMany({
    where: { status: 'published' },
    select: { tenant_id: true, job_id: true, platform_response: true, social_account: { select: { platform: true } } },
  });

  for (const p of publishes) {
    const pr = (p.platform_response ?? {}) as PlatformResponse;
    const videoId = pr.videoId ?? pr.video_id;
    if (!videoId) continue;
    const platform = p.social_account?.platform ?? 'youtube';
    const key = `${platform}:${videoId}`;
    if (!out.has(key)) {
      out.set(key, { tenantId: p.tenant_id, videoId, platform, jobId: p.job_id });
    }
  }

  // Source 2: job artifacts carrying a video id under `published`.
  const jobs = await prisma.job.findMany({
    select: { id: true, tenant_id: true, artifacts: true },
  });

  for (const j of jobs) {
    const artifacts = (j.artifacts ?? {}) as Record<string, unknown>;
    const published = artifacts.published as Record<string, unknown> | undefined;
    const videoId =
      (published?.video_id as string | undefined) ??
      (published?.videoId as string | undefined) ??
      (artifacts.video_id as string | undefined) ??
      (artifacts.videoId as string | undefined);
    if (!videoId) continue;
    const key = `youtube:${videoId}`;
    if (!out.has(key)) {
      out.set(key, { tenantId: j.tenant_id, videoId, platform: 'youtube', jobId: j.id });
    }
  }

  return [...out.values()];
}

/**
 * Seed a published video (test/seed helper). Creates a `scheduled_publishes`
 * row with status='published' and a platform_response.videoId, reusing an
 * existing social account (or creating one) for the tenant.
 */
export async function seedPublishedVideo(opts: {
  tenantId: string;
  videoId: string;
  platform?: string;
  jobId?: string;
}): Promise<string> {
  const platform = opts.platform ?? 'youtube';
  const account =
    (await prisma.socialAccount.findFirst({ where: { tenant_id: opts.tenantId, platform } })) ??
    (await prisma.socialAccount.create({
      data: { tenant_id: opts.tenantId, platform, display_name: `Seed ${platform}`, account_ref: 'seed-channel', token_ref: 'seed' },
    }));

  const publish = await prisma.scheduledPublish.create({
    data: {
      tenant_id: opts.tenantId,
      job_id: opts.jobId ?? '00000000-0000-0000-0000-000000000000',
      social_account_id: account.id,
      scheduled_at: new Date(),
      status: 'published',
      platform_response: { videoId: opts.videoId, url: `https://youtu.be/${opts.videoId}` },
    },
  });
  return publish.id;
}
