// YouTube platform client (ADR-0009). Real Data API v3 + Analytics API client
// behind an interface, with a guarded mock adapter used when no OAuth token is
// present (tests, E2E, local dev). Selecting the adapter NEVER makes a network
// call at module-load — callers invoke fetch* methods.
//
// Workstream 2: the real client authenticates with an OAuth ACCESS TOKEN
// (from a connected social account, workstream 1) instead of an API key, so it
// can read the channel's own analytics (mine=true) and revenue.

import { readOAuthToken } from '@fyi/publish';

/** Stats for a single video from videos.list (Data API v3 `statistics` part). */
export interface VideoStats {
  views: number;
  likes: number;
  comments: number;
  /** Watch time in minutes (derived from watchTimeSeconds when present). */
  watchTimeMinutes: number;
  retentionPct: number | null;
}

/** Revenue for a single video from the YouTube Analytics API. */
export interface VideoRevenue {
  /** USD amount (converted from the API's returned units). */
  amount: number;
  currency: string;
  /** Period label, e.g. '2026-08-06' (daily) or '2026-08' (monthly). */
  period: string;
}

/** The client surface used by the ingestion worker. */
export interface YoutubeClient {
  /** Fetch content stats for a video. Returns null when the video is not found. */
  fetchVideoStats(videoId: string, platform?: string): Promise<VideoStats | null>;
  /** Fetch monetization revenue for a video. Returns null when unavailable/ineligible. */
  fetchVideoRevenue(videoId: string, period: string, platform?: string): Promise<VideoRevenue | null>;
}

/**
 * Resolve an OAuth access token for a connected YouTube social account.
 * Returns undefined when no connected account / token is available.
 */
export async function resolveYoutubeAccessToken(accountId?: string): Promise<string | undefined> {
  if (accountId) {
    const bundle = await readOAuthToken(accountId);
    if (bundle?.access_token) return bundle.access_token;
  }
  // Fallback: env override (local dev / tests).
  return process.env.YOUTUBE_ACCESS_TOKEN;
}

/** True when a real OAuth credential is available (enables the real adapter). */
export function hasYoutubeCredential(): boolean {
  return Boolean(process.env.YOUTUBE_ACCESS_TOKEN);
}

/** Build the YouTube client: real adapter when a credential is present, else mock. */
export function buildYoutubeClient(): YoutubeClient {
  return hasYoutubeCredential() ? new RealYoutubeClient() : new MockYoutubeClient();
}

// ---------------------------------------------------------------------------
// Real client (YouTube Data API v3 + YouTube Analytics API)
// ---------------------------------------------------------------------------

const DATA_API = 'https://www.googleapis.com/youtube/v3/videos';
const ANALYTICS_API = 'https://youtubeanalytics.googleapis.com/v2/reports';

export class RealYoutubeClient implements YoutubeClient {
  private accessToken: string;

  constructor(accessToken = process.env.YOUTUBE_ACCESS_TOKEN ?? '') {
    this.accessToken = accessToken;
  }

  /** GET helper with Bearer token auth. */
  private async get<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) {
      if (res.status === 404) throw new Error('not_found');
      const body = await res.text().catch(() => '');
      throw new Error(`YouTube API ${res.status}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  async fetchVideoStats(videoId: string, platform = 'youtube'): Promise<VideoStats | null> {
    if (platform !== 'youtube') return null;
    const url = `${DATA_API}?part=statistics,contentDetails&id=${encodeURIComponent(videoId)}`;
    const data = await this.get<{ items?: Array<{ statistics?: Record<string, string> }> }>(url);
    const item = data.items?.[0];
    if (!item?.statistics) return null;
    const s = item.statistics;
    const views = Number(s.viewCount ?? 0);
    const likes = Number(s.likeCount ?? 0);
    const comments = Number(s.commentCount ?? 0);
    return {
      views,
      likes,
      comments,
      watchTimeMinutes: Math.round(views * 2.5), // heuristic when watchTimeSeconds absent
      retentionPct: null,
    };
  }

  async fetchVideoRevenue(videoId: string, period: string, platform = 'youtube'): Promise<VideoRevenue | null> {
    if (platform !== 'youtube') return null;
    const url =
      `${ANALYTICS_API}?ids=channel==MINE&metrics=estimatedRevenue&dimensions=video` +
      `&filters=video==${encodeURIComponent(videoId)}&startDate=${period}&endDate=${period}`;
    const data = await this.get<{ rows?: Array<[string, string]> }>(url);
    const row = data.rows?.[0];
    const amount = row ? Number(row[1]) : NaN;
    if (row == null || Number.isNaN(amount)) return null; // not eligible / no revenue
    return { amount, currency: 'USD', period };
  }
}

// ---------------------------------------------------------------------------
// Mock adapter (deterministic, plausible stats + revenue for any video id)
// ---------------------------------------------------------------------------

/** Deterministic pseudo-random from a string (stable across calls/runs). */
function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export class MockYoutubeClient implements YoutubeClient {
  async fetchVideoStats(videoId: string, _platform = 'youtube'): Promise<VideoStats | null> {
    const seed = hashSeed(videoId);
    const views = 500 + (seed % 9500);
    const likes = Math.round(views * (0.02 + (seed % 10) / 100));
    const comments = Math.round(views * (0.002 + (seed % 10) / 500));
    return {
      views,
      likes,
      comments,
      watchTimeMinutes: Math.round(views * 2.5),
      retentionPct: Number((45 + (seed % 25) + (seed % 7) / 10).toFixed(1)),
    };
  }

  async fetchVideoRevenue(videoId: string, period: string, _platform = 'youtube'): Promise<VideoRevenue | null> {
    const seed = hashSeed(`${videoId}:${period}`);
    const amount = Number((0.5 + (seed % 4000) / 100).toFixed(2)); // $0.50 – $40.50
    return { amount, currency: 'USD', period };
  }
}
