// Media helpers — map artifact reference URIs (file:///tmp/fyi-studio/<exec>/<file>)
// to dashboard /media/ routes served by @fastify/static. See dashboard-architecture.md §9.
import { basename } from 'node:path';

export const MEDIA_ROOT = process.env.FYI_MEDIA_ROOT ?? '/tmp/fyi-studio';

/**
 * Extract the execution directory segment from an artifact reference URI.
 * "file:///tmp/fyi-studio/abc-123/video.mp4" -> "abc-123"
 * "/tmp/fyi-studio/abc-123/video.mp4"       -> "abc-123"
 */
export function extractExecutionId(ref: string): string {
  const m = ref.match(/\/fyi-studio\/([^/]+)\//);
  return m?.[1] ?? 'unknown';
}

/**
 * Convert an absolute path or file:// reference to a /media/<exec>/<file> URL.
 * Returns null when the ref does not point into the media root.
 */
export function artifactToMediaUrl(ref: string): string | null {
  const normalized = ref.replace(/^file:\/\//, '');
  if (!normalized.includes('/fyi-studio/')) return null;
  const execId = extractExecutionId(normalized);
  const file = basename(normalized);
  if (!file) return null;
  return `/media/${execId}/${file}`;
}

/** List of /media URLs for every file reference inside a job's artifacts `_references`. */
export function referenceUrls(references: Record<string, string>): Array<{ key: string; url: string | null }> {
  return Object.entries(references).map(([key, ref]) => ({ key, url: artifactToMediaUrl(ref) }));
}
