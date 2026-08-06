// Mock YouTube adapter — used for tests / E2E so we never consume real
// YouTube API quota (1,600 units/upload, ADR-0009). It simulates a successful
// videos.insert without touching the network.

import { randomUUID } from 'node:crypto';
import type { PlatformAdapter, PublishRequest, PublishResult } from './types.js';

export function makeMockVideoId(): string {
  return `mock-${randomUUID()}`;
}

/** Simulate a small upload latency so the pipeline behaves realistically. */
async function simulateUpload(): Promise<void> {
  await new Promise((r) => setTimeout(r, 25));
}

/** Builds a deterministic YouTube URL from a mock video id. */
export function youTubeWatchUrl(videoId: string): string {
  return `https://youtu.be/${videoId}`;
}

export const youtubeMockAdapter: PlatformAdapter = {
  platform: 'youtube',
  async publish(req: PublishRequest): Promise<PublishResult> {
    await simulateUpload();
    // Respect the privacy default from the real adapter: uploads are private.
    void req;
    const videoId = makeMockVideoId();
    return {
      videoId,
      url: youTubeWatchUrl(videoId),
      platform: 'youtube',
    };
  },
};
