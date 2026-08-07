// Unit tests for the YouTube client credential resolution (workstream 2).
// Verifies that ingestion can resolve a real OAuth access token from a
// connected social account (via @fyi/publish readOAuthToken), falling back to
// env / mock when none is present.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@fyi/publish', () => ({
  readOAuthToken: vi.fn(),
  getValidAccessToken: vi.fn(),
  loadOAuthConfig: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

import { readOAuthToken, getValidAccessToken, loadOAuthConfig } from '@fyi/publish';
import { resolveYoutubeAccessToken, hasYoutubeCredential } from '../src/utils/youtube.js';

describe('resolveYoutubeAccessToken (workstream 2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.YOUTUBE_ACCESS_TOKEN;
    // By default no OAuth config -> resolveYoutubeAccessToken falls back to raw bundle read.
    vi.mocked(loadOAuthConfig).mockReturnValue(null);
  });

  it('returns the access token from a connected social account', async () => {
    vi.mocked(readOAuthToken).mockResolvedValue({
      access_token: 'oauth-at-123',
      refresh_token: 'rt',
      expires_in: 3600,
      token_type: 'Bearer',
    });
    const token = await resolveYoutubeAccessToken('account-1');
    expect(token).toBe('oauth-at-123');
    expect(readOAuthToken).toHaveBeenCalledWith('account-1');
  });

  it('uses getValidAccessToken (auto-refresh) when OAuth config is present', async () => {
    vi.mocked(loadOAuthConfig).mockReturnValue({ clientId: 'cid', clientSecret: 'sec', redirectUri: 'http://x/cb' });
    vi.mocked(getValidAccessToken).mockResolvedValue('refreshed-at-456');
    const token = await resolveYoutubeAccessToken('account-1');
    expect(token).toBe('refreshed-at-456');
    expect(getValidAccessToken).toHaveBeenCalledWith('account-1', expect.any(Function));
  });

  it('returns undefined when no account id and no env token', async () => {
    const token = await resolveYoutubeAccessToken(undefined);
    expect(token).toBeUndefined();
  });

  it('falls back to env override when no account token', async () => {
    process.env.YOUTUBE_ACCESS_TOKEN = 'env-token';
    const token = await resolveYoutubeAccessToken(undefined);
    expect(token).toBe('env-token');
  });

  it('hasYoutubeCredential reflects env presence', () => {
    expect(hasYoutubeCredential()).toBe(false);
    process.env.YOUTUBE_ACCESS_TOKEN = 'x';
    expect(hasYoutubeCredential()).toBe(true);
  });
});
