// Unit tests for @fyi/publish (Milestone 10 / ADR-0008).
// Covers the platform adapter factory, the mock YouTube adapter, video-path
// resolution, upload metadata, the retry policy, and the publish write-back
// flow (with @fyi/database mocked).
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock @fyi/database so no DB is needed ---
const jobFindUnique = vi.fn();
const jobUpdate = vi.fn();
const spUpdate = vi.fn();
const spFindUnique = vi.fn();

vi.mock('@fyi/database', () => ({
  prisma: {
    job: {
      findUnique: (...a: unknown[]) => jobFindUnique(...a),
      update: (...a: unknown[]) => jobUpdate(...a),
    },
    scheduledPublish: {
      findUnique: (...a: unknown[]) => spFindUnique(...a),
      update: (...a: unknown[]) => spUpdate(...a),
    },
    socialAccount: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const {
  getAdapter,
  requireAdapter,
  youtubeMockAdapter,
  makeMockVideoId,
  youTubeWatchUrl,
  resolveVideoPath,
  buildUploadMetadata,
  shouldRetry,
  executePublish,
  writePublishSuccess,
  writePublishFailure,
  runPublish,
  getAttempts,
  MAX_ATTEMPTS,
} = await import('../src/index.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('platform adapter factory', () => {
  it('returns the mock adapter for youtube by default', () => {
    const a = getAdapter('youtube');
    expect(a).not.toBeNull();
    expect(a?.platform).toBe('youtube');
  });

  it('returns the real adapter for youtube when preferReal is true', () => {
    const a = getAdapter('youtube', true);
    expect(a).not.toBeNull();
  });

  it('returns null for deferred platforms (facebook/instagram/tiktok)', () => {
    expect(getAdapter('facebook')).toBeNull();
    expect(getAdapter('instagram')).toBeNull();
    expect(getAdapter('tiktok')).toBeNull();
  });

  it('requireAdapter throws a non-retryable error for an unknown platform', () => {
    expect(() => requireAdapter('facebook')).toThrow();
  });
});

describe('mock YouTube adapter', () => {
  it('publishes and returns a videoId + watch URL', async () => {
    const res = await youtubeMockAdapter.publish({
      videoPath: '/tmp/x.mp4',
      title: 't',
      description: 'd',
      tokenRef: 'ref',
      tenantId: 't1',
    });
    expect(res.platform).toBe('youtube');
    expect(res.videoId).toContain('mock-');
    expect(res.url).toBe(youTubeWatchUrl(res.videoId));
  });

  it('makeMockVideoId produces unique ids', () => {
    expect(makeMockVideoId()).not.toBe(makeMockVideoId());
  });

  it('youTubeWatchUrl builds a deterministic URL', () => {
    expect(youTubeWatchUrl('abc')).toBe('https://youtu.be/abc');
  });
});

describe('resolveVideoPath', () => {
  it('resolves from _references.video (file:// pointer)', () => {
    expect(resolveVideoPath({ _references: { video: 'file:///tmp/fyi-studio/e/video.mp4' } })).toBe(
      'file:///tmp/fyi-studio/e/video.mp4',
    );
  });

  it('resolves from video.video_path (nested)', () => {
    expect(resolveVideoPath({ video: { video_path: '/tmp/v.mp4' } })).toBe('/tmp/v.mp4');
  });

  it('returns undefined when no video artifact exists', () => {
    expect(resolveVideoPath({ research: { summary: 'x' } })).toBeUndefined();
  });
});

describe('buildUploadMetadata', () => {
  it('uses script.title and research.summary', () => {
    const m = buildUploadMetadata({
      script: { title: 'My Video' },
      research: { summary: 'A summary' },
    });
    expect(m.title).toBe('My Video');
    expect(m.description).toBe('A summary');
  });

  it('falls back to a default title', () => {
    expect(buildUploadMetadata({}).title).toBe('FYI Studio Video');
  });
});

describe('retry policy', () => {
  it('allows retry when attempts are under the cap', () => {
    expect(shouldRetry(new Error('boom'), 1, MAX_ATTEMPTS)).toBe(true);
  });

  it('stops retrying at the cap', () => {
    expect(shouldRetry(new Error('boom'), MAX_ATTEMPTS, MAX_ATTEMPTS)).toBe(false);
  });

  it('respects a non-retryable error flag', () => {
    const err = Object.assign(new Error('nope'), { retryable: false });
    expect(shouldRetry(err, 1, MAX_ATTEMPTS)).toBe(false);
  });
});

describe('executePublish (write-back flow, DB mocked)', () => {
  const task = {
    scheduledPublishId: 'sp1',
    jobId: 'job1',
    tenantId: 't1',
    socialAccountId: 'acc1',
    adapter: 'youtube' as const,
    account: { id: 'acc1', platform: 'youtube', display_name: 'd', account_ref: 'r', token_ref: 'token-ref' },
  };

  it('resolves the video path and calls the adapter, returning the result', async () => {
    jobFindUnique.mockResolvedValue({
      id: 'job1',
      artifacts: {
        script: { title: 'T' },
        research: { summary: 'S' },
        _references: { video: 'file:///tmp/fyi-studio/e/video.mp4' },
      },
    });
    const res = await executePublish(youtubeMockAdapter, task);
    expect(res.platform).toBe('youtube');
    expect(res.videoId).toContain('mock-');
    expect(jobFindUnique).toHaveBeenCalledWith({ where: { id: 'job1' } });
  });

  it('throws when the job has no video artifact', async () => {
    jobFindUnique.mockResolvedValue({ id: 'job1', artifacts: { script: {} } });
    await expect(executePublish(youtubeMockAdapter, task)).rejects.toThrow(/no video artifact/);
  });

  it('throws when the job is not found', async () => {
    jobFindUnique.mockResolvedValue(null);
    await expect(executePublish(youtubeMockAdapter, task)).rejects.toThrow(/not found/);
  });
});

describe('writePublishSuccess / writePublishFailure', () => {
  it('writes status + platform_response and merges artifacts.published', async () => {
    jobFindUnique.mockResolvedValue({ id: 'job1', artifacts: { script: {} } });
    await writePublishSuccess('sp1', 'job1', { videoId: 'v1', url: 'https://youtu.be/v1', platform: 'youtube' });
    expect(spUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sp1' },
        data: expect.objectContaining({ status: 'published' }),
      }),
    );
    expect(jobUpdate).toHaveBeenCalledTimes(1);
    const jobArg = jobUpdate.mock.calls[0]![0] as { data: { artifacts: { published: { videoId: string } } } };
    expect(jobArg.data.artifacts.published.videoId).toBe('v1');
  });

  it('writes a failure response', async () => {
    await writePublishFailure('sp1', new Error('quota'));
    expect(spUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sp1' },
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });
});

describe('runPublish (success + retry paths)', () => {
  const task = {
    scheduledPublishId: 'sp1',
    jobId: 'job1',
    tenantId: 't1',
    socialAccountId: 'acc1',
    adapter: 'youtube' as const,
    account: { id: 'acc1', platform: 'youtube', display_name: 'd', account_ref: 'r', token_ref: 'token-ref' },
  };
  const queue = { add: vi.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    queue.add.mockClear();
    spFindUnique.mockResolvedValue({ id: 'sp1', attempts: 0 });
  });

  it('publishes successfully and returns published', async () => {
    jobFindUnique.mockResolvedValue({
      id: 'job1',
      artifacts: { _references: { video: 'file:///tmp/fyi-studio/e/video.mp4' } },
    });
    const out = await runPublish(queue, youtubeMockAdapter, task);
    expect(out.status).toBe('published');
    expect(out.result?.platform).toBe('youtube');
    expect(spUpdate).toHaveBeenCalled();
  });

  it('re-enqueues with backoff on a retryable failure and stays under cap', async () => {
    const failingAdapter = {
      platform: 'youtube' as const,
      publish: async () => {
        throw new Error('temporary 429');
      },
    };
    jobFindUnique.mockResolvedValue({
      id: 'job1',
      artifacts: { _references: { video: 'file:///tmp/fyi-studio/e/video.mp4' } },
    });
    const out = await runPublish(queue, failingAdapter, task, { maxAttempts: 3, retryDelayMs: 10 });
    expect(out.status).toBe('failed');
    expect(queue.add).toHaveBeenCalledTimes(1); // one retry scheduled
    expect(spUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sp1' }, data: expect.objectContaining({ attempts: 1 }) }),
    );
  });

  it('marks terminal failure when attempts exceed the cap', async () => {
    spFindUnique.mockResolvedValue({ id: 'sp1', attempts: MAX_ATTEMPTS });
    const failingAdapter = {
      platform: 'youtube' as const,
      publish: async () => {
        throw new Error('permanent');
      },
    };
    jobFindUnique.mockResolvedValue({
      id: 'job1',
      artifacts: { _references: { video: 'file:///tmp/fyi-studio/e/video.mp4' } },
    });
    const out = await runPublish(queue, failingAdapter, task, { maxAttempts: MAX_ATTEMPTS });
    expect(out.status).toBe('failed');
    expect(queue.add).not.toHaveBeenCalled(); // no more retries
  });
});

describe('getAttempts', () => {
  it('returns the attempts count from the DB', async () => {
    spFindUnique.mockResolvedValue({ id: 'sp1', attempts: 2 });
    expect(await getAttempts('sp1')).toBe(2);
  });

  it('returns 0 when the row is absent', async () => {
    spFindUnique.mockResolvedValue(null);
    expect(await getAttempts('sp1')).toBe(0);
  });
});
