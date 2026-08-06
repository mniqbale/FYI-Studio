// Platform adapter contract — a pluggable surface so YouTube is implemented
// first and Facebook/Instagram/TikTok can be added without re-architecting
// (ADR-0008). Adapters receive a file POINTER (never binary — ADR-0003) and
// return a platform result that is written back to scheduled_publishes +
// jobs.artifacts.published.

/** A publish request handed to a platform adapter. */
export interface PublishRequest {
  /** Absolute file pointer (path) to the media to upload (ADR-0003). */
  videoPath: string;
  title: string;
  description: string;
  /** Credential reference (never the token material — ADR-0006/0007). */
  tokenRef: string;
  /** The tenant whose account is being used. */
  tenantId: string;
}

/** A successful publish result, written back to platform_response. */
export interface PublishResult {
  videoId: string;
  url: string;
  platform: string;
}

/** The platform identifier used to select an adapter (e.g. 'youtube'). */
export type PlatformKind = 'youtube' | 'facebook' | 'instagram' | 'tiktok';

/**
 * A retryable upload failure. When `retryable` is true, the caller should
 * schedule a backoff retry (respecting ADR-0004: no infinite self-retry).
 */
export class PlatformPublishError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = true) {
    super(message);
    this.name = 'PlatformPublishError';
    this.code = code;
    this.retryable = retryable;
  }
}

/** The minimal surface every platform adapter must implement. */
export interface PlatformAdapter {
  readonly platform: PlatformKind;
  publish(req: PublishRequest): Promise<PublishResult>;
}
