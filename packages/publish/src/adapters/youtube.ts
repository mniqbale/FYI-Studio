// YouTube adapter — real upload path via the YouTube Data API v3 videos.insert
// (resumable upload of a file pointer, ADR-0003). This implementation performs
// a real two-step resumable upload against the Google upload endpoint. It is
// gated behind an env flag (YOUTUBE_REAL_ENABLED) and a resolved OAuth token so
// tests/E2E always use the mock adapter and never consume real quota
// (1,600 units/upload, ADR-0009).
//
// Real upload flow (https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol):
//   1. POST <base>?uploadType=resumable with `Authorization: Bearer <token>`
//      and a JSON body describing snippet/status. A 200 response carries the
//      resumable session URI in the `Location` header.
//   2. PUT the video file bytes to that `Location` with `Content-Type: video/*`.
// A live OAuth token is NOT available in the local Codespace, so when the real
// adapter is selected without a token it throws a non-retryable error rather
// than guessing or fabricating an upload.

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { PlatformAdapter, PublishRequest, PublishResult } from './types.js';
import { PlatformPublishError } from './types.js';
import { youTubeWatchUrl } from './youtube.mock.js';
import { resolveSecret } from '@fyi/platform';

const REAL_ENABLED = process.env.YOUTUBE_REAL_ENABLED === 'true';
// OAuth token material is resolved via the token_ref by the secret store at
// publish time. For the real path this is supplied as an env override in the
// local MVP (production: secret manager, ADR-0006/0007).
const TOKEN_OVERRIDE = process.env.YOUTUBE_ACCESS_TOKEN;

// Resumable upload endpoint (Data API v3 videos.insert).
const UPLOAD_BASE_URL = 'https://www.googleapis.com/upload/youtube/v3/videos';

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
 * Resolve the live OAuth access token for a YouTube social account.
 *
 * Order:
 *   1. The account's `token_ref` (from provider_connections / social account),
 *      resolved via @fyi/platform `resolveSecret` (env var or decrypted at-rest
 *      key_ref, ADR-0007).
 *   2. The YOUTUBE_ACCESS_TOKEN env override (local MVP / tests).
 * Returns undefined when no token material is resolvable. The token material is
 * never logged or persisted.
 */
export function resolveYouTubeToken(tokenRef?: string): string | undefined {
  // 1. token_ref via the platform secret resolver. For YouTube we look up the
  //    conventional env var name first when a bare ref names it, then the env
  //    override as the fallback.
  const fromRef = tokenRef && tokenRef.length > 0 ? resolveSecret('youtube', tokenRef) : undefined;
  if (fromRef) return fromRef;
  // 2. env override (explicit local token, e.g. from a CI/manual run).
  if (TOKEN_OVERRIDE) return TOKEN_OVERRIDE;
  return undefined;
}

/**
 * Map an HTTP status from the YouTube resumable upload protocol to a
 * PlatformPublishError code (ADR-0009 quota/retry rules).
 * - 401/403: auth/permission failure -> YOUTUBE_AUTH_FAILED (non-retryable)
 * - 400/404/5xx: transient/upstream upload failure -> YOUTUBE_UPLOAD_FAILED (retryable)
 * Anything else is treated as a retryable upload failure.
 */
function mapUploadStatus(status: number, phase: string): PlatformPublishError {
  if (status === 401 || status === 403) {
    return new PlatformPublishError(
      'YOUTUBE_AUTH_FAILED',
      `YouTube rejected the OAuth token during ${phase} (HTTP ${status}).`,
      false,
    );
  }
  if (status === 400 || status === 404 || status >= 500) {
    return new PlatformPublishError(
      'YOUTUBE_UPLOAD_FAILED',
      `YouTube upload failed during ${phase} (HTTP ${status}).`,
      true,
    );
  }
  return new PlatformPublishError(
    'YOUTUBE_UPLOAD_FAILED',
    `YouTube upload failed during ${phase} (unexpected HTTP ${status}).`,
    true,
  );
}

/**
 * Performs the actual videos.insert resumable upload. Two steps:
 *   1. POST metadata to the upload base URL to obtain the resumable session URI.
 *   2. PUT the video file bytes to that URI with `Content-Type: video/*`.
 * Throws a mapped PlatformPublishError on HTTP failures (per ADR-0009).
 */
export async function uploadVideo(opts: YouTubeUploadOptions): Promise<{ videoId: string }> {
  if (!opts.accessToken) {
    throw new PlatformPublishError('YOUTUBE_NO_TOKEN', 'No YouTube access token available', false);
  }
  if (!existsSync(opts.videoPath)) {
    throw new PlatformPublishError('YOUTUBE_FILE_MISSING', `Video file not found: ${opts.videoPath}`, true);
  }

  const metadata = {
    snippet: { title: opts.snippet.title, description: opts.snippet.description },
    status: { privacyStatus: opts.privacyStatus },
  };

  // Step 1: initiate the resumable upload session.
  const initUrl = `${UPLOAD_BASE_URL}?uploadType=resumable&part=snippet,status`;
  const initRes = await fetch(initUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/*',
      'Content-Length': String(Buffer.byteLength(JSON.stringify(metadata))),
    },
    body: JSON.stringify(metadata),
  });
  if (initRes.status !== 200) {
    throw mapUploadStatus(initRes.status, 'resumable-session-initiation');
  }
  const sessionUri = initRes.headers.get('location');
  if (!sessionUri) {
    throw new PlatformPublishError(
      'YOUTUBE_UPLOAD_FAILED',
      'YouTube resumable upload initiation returned 200 without a Location (session) header.',
      true,
    );
  }

  // Step 2: stream the file bytes to the resumable session URI.
  const fileBuf = await readFile(opts.videoPath);
  const uploadRes = await fetch(sessionUri, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      'Content-Type': 'video/*',
      'Content-Length': String(fileBuf.byteLength),
    },
    body: new Uint8Array(fileBuf),
  });
  if (uploadRes.status !== 200 && uploadRes.status !== 201) {
    throw mapUploadStatus(uploadRes.status, 'resumable-upload');
  }

  // A successful upload returns the created video resource as JSON.
  const resource = (await uploadRes.json()) as { id?: string };
  if (!resource.id) {
    throw new PlatformPublishError(
      'YOUTUBE_UPLOAD_FAILED',
      'YouTube upload completed but the response contained no video id.',
      true,
    );
  }
  return { videoId: resource.id };
}

export const youtubeAdapter: PlatformAdapter = {
  platform: 'youtube',
  async publish(req: PublishRequest): Promise<PublishResult> {
    // Real path only when explicitly enabled AND a token is resolvable (from the
    // account token_ref via resolveSecret, or the env override).
    const accessToken = resolveYouTubeToken(req.tokenRef) ?? '';
    if (!REAL_ENABLED || !accessToken) {
      throw new PlatformPublishError(
        'YOUTUBE_UPLOAD_DISABLED',
        'Real YouTube adapter is disabled. Set YOUTUBE_REAL_ENABLED=true and a token to enable.',
        false,
      );
    }
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
  return REAL_ENABLED && Boolean(resolveYouTubeToken(undefined));
}
