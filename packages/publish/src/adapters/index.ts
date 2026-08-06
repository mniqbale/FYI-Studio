// Adapter factory — selects a PlatformAdapter by platform kind.
// YouTube-first (ADR-0008): the mock adapter is the default (used by tests/E2E
// so no real quota is consumed); the real adapter is only enabled explicitly
// when a live OAuth credential is present (see youtube.ts).
// Facebook/Instagram/TikTok are not yet implemented — requesting them throws a
// non-retryable error.

import type { PlatformAdapter, PlatformKind } from './types.js';
import { PlatformPublishError } from './types.js';
import { youtubeMockAdapter } from './youtube.mock.js';
import { youtubeAdapter } from './youtube.js';

/** Default adapter registry. The mock is the safe default for every platform. */
const ADAPTERS: Record<string, PlatformAdapter> = {
  youtube: youtubeMockAdapter,
};

/**
 * Resolve the adapter to use for a platform. When `preferReal` is true and a
 * real adapter exists for the platform, the real (live) adapter is returned
 * instead of the mock. Returns null for unknown/deferred platforms.
 */
export function getAdapter(platform: string, preferReal = false): PlatformAdapter | null {
  if (preferReal && platform === 'youtube') {
    return youtubeAdapter;
  }
  return ADAPTERS[platform] ?? null;
}

/**
 * Resolve an adapter or throw a non-retryable error for a platform that has no
 * adapter (deferred: facebook/instagram/tiktok).
 */
export function requireAdapter(platform: string, preferReal = false): PlatformAdapter {
  const adapter = getAdapter(platform, preferReal);
  if (!adapter) {
    throw new PlatformPublishError(
      'NO_PLATFORM_ADAPTER',
      `No platform adapter registered for platform '${platform}' (only youtube is implemented).`,
      false,
    );
  }
  return adapter;
}

/** Whether an adapter exists for the given platform kind. */
export function hasAdapter(platform: PlatformKind | string): boolean {
  return platform in ADAPTERS;
}
