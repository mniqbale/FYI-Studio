// @fyi/publish — Social Publish & Scheduling (Milestone 10 / ADR-0008).
// Shared library consumed by services/publish, workers/publish-real, the
// dashboard Settings surface, and tests. Exports the platform adapters, social
// account registry CRUD, scheduled-publish logic, scheduler sweep, and the
// publish/write-back/retry pipeline.

export { PUBLISH_QUEUE_NAME } from './scheduler.js';
export type { PublishTask } from './scheduler.js';
export { sweepDuePublishes } from './scheduler.js';

// Platform adapters
export type { PlatformAdapter, PlatformKind, PublishRequest, PublishResult } from './adapters/types.js';
export { PlatformPublishError } from './adapters/types.js';
export { youtubeAdapter, uploadVideo, isYouTubeRealEnabled } from './adapters/youtube.js';
export { youtubeMockAdapter, makeMockVideoId, youTubeWatchUrl } from './adapters/youtube.mock.js';
export { getAdapter, requireAdapter, hasAdapter } from './adapters/index.js';

// Social account registry
export {
  connectSocialAccount,
  listSocialAccounts,
  getSocialAccount,
  disconnectSocialAccount,
  deleteSocialAccount,
  SUPPORTED_PLATFORMS,
} from './registry.js';
export type { ConnectSocialAccountInput, SocialAccountView } from './registry.js';

// Scheduled publish logic
export {
  schedulePublish,
  listScheduledPublishes,
  getScheduledPublish,
  cancelScheduledPublish,
  findDuePublishes,
  claimPublish,
} from './schedule.js';
export type { SchedulePublishInput, ScheduledPublishView, ScheduledPublishStatus } from './schedule.js';

// Secret store
export { createSecretStore, storeSecret, resolveToken } from './secret.js';
export type { SecretStore } from './secret.js';

// Publish execution + write-back + retry
export {
  executePublish,
  runPublish,
  writePublishSuccess,
  writePublishFailure,
  shouldRetry,
  resolveVideoPath,
  buildUploadMetadata,
  getAttempts,
  MAX_ATTEMPTS,
  RETRY_DELAY_MS,
} from './publish.js';
