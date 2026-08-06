// YouTube adapter — real upload path via the YouTube Data API v3 videos.insert
// (resumable upload of a file pointer, ADR-0003). This implementation is the
// STRUCTURE for a real upload; it is gated behind an env flag (YOUTUBE_REAL_ENABLED)
// and a resolved OAuth token so tests/E2E always use the mock adapter and never
// consume real quota (1,600 units/upload, ADR-0009).
//
// A real OAuth token is NOT available in the local Codespace, so when the real
// adapter is selected without a token it throws a non-retryable error rather
// than guessing or fabricating an upload.

import { existsSync } from 'node:fs';
import type { PlatformAdapter, PublishRequest, PublishResult } from './types.js';
import { PlatformPublishError } from './types.js';
import { youTubeWatchUrl } from './youtube.mock.js';

const REAL_ENABLED = process.env.YOUTUBE_REAL_ENABLED === 'true';
// OAuth token material is resolved via the token_ref by the secret store at
// publish time. For the real path this is supplied as an env override in the
// local MVP (production: secret manager, ADR-0006/0007).
const TOKEN_OVERRIDE = process.env.YOUTUBE_ACCESS_TOKEN;

export interface YouTubeSnippet {
  title: string;
  description: string;
}

export interface YouTubeUploadOptions {
  accessToken: string;
  videoPath: string;
  snippet: YouTubeSnippet;
  privacyStatus: 'private' | 'public' | 'unlisted';
}

/**
 * Performs the actual videos.insert resumable upload. Kept as a thin seam so
 * the network call can be replaced/augmented with a real HTTP client without
 * changing the adapter. Throws if the file does not exist (retryable) or the
 * access token is missing (non-retryable).
 */
export async function uploadVideo(opts: YouTubeUploadOptions): Promise<{ videoId: string }> {
  if (!opts.accessToken) {
    throw new PlatformPublishError('YOUTUBE_NO_TOKEN', 'No YouTube access token available', false);
  }
  if (!existsSync(opts.videoPath)) {
    throw new PlatformPublishError('YOUTUBE_FILE_MISSING', `Video file not found: ${opts.videoPath}`, true);
  }
  // Real implementation: POST to https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable
  // with Authorization: Bearer <accessToken>, then a second resumable session upload
  // streaming the file pointer. Quota cost: 1,600 units (ADR-0009). This is the
  // integration seam to be wired when a live OAuth credential is provisioned.
  throw new PlatformPublishError(
    'YOUTUBE_NOT_CONFIGURED',
    'Real YouTube upload is not configured (no live OAuth token in this environment). Use the mock adapter.',
    false,
  );
}

export const youtubeAdapter: PlatformAdapter = {
  platform: 'youtube',
  async publish(req: PublishRequest): Promise<PublishResult> {
    // Real path only when explicitly enabled AND a token override is present.
    const accessToken = TOKEN_OVERRIDE ?? '';
    if (!REAL_ENABLED || !accessToken) {
      throw new PlatformPublishError(
        'YOUTUBE_UPLOAD_DISABLED',
        'Real YouTube adapter is disabled. Set YOUTUBE_REAL_ENABLED=true and a token to enable.',
        false,
      );
    }
    void req;
    const res = await uploadVideo({
      accessToken,
      videoPath: req.videoPath,
      snippet: { title: req.title, description: req.description },
      privacyStatus: 'private', // private first; the Founder makes it public
    });
    return {
      videoId: res.videoId,
      url: youTubeWatchUrl(res.videoId),
      platform: 'youtube',
    };
  },
};

/** Whether the real adapter is considered "live" in this process. */
export function isYouTubeRealEnabled(): boolean {
  return REAL_ENABLED && Boolean(TOKEN_OVERRIDE);
}
