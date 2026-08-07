// Unit tests for the YouTube OAuth client (workstream 1). No real network —
// fetch is mocked. Verifies consent URL building, code exchange, refresh, and
// channel fetch.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadOAuthConfig,
  buildAuthUrl,
  exchangeCode,
  refreshAccessToken,
  fetchChannelInfo,
  YOUTUBE_SCOPES,
} from '../src/oauth/youtube.js';

describe('YouTube OAuth client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
  });

  it('loadOAuthConfig returns null when not configured', () => {
    expect(loadOAuthConfig()).toBeNull();
  });

  it('loadOAuthConfig reads credentials from env', () => {
    process.env.GOOGLE_CLIENT_ID = 'cid';
    process.env.GOOGLE_CLIENT_SECRET = 'csec';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/cb';
    const cfg = loadOAuthConfig();
    expect(cfg).toEqual({ clientId: 'cid', clientSecret: 'csec', redirectUri: 'http://localhost:3001/cb' });
  });

  it('buildAuthUrl includes client_id, redirect_uri, scopes, state, offline access', () => {
    const url = buildAuthUrl({ clientId: 'cid', clientSecret: 's', redirectUri: 'http://x/cb' }, 'state123');
    expect(url).toContain('accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('client_id=cid');
    expect(url).toContain('redirect_uri=' + encodeURIComponent('http://x/cb'));
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
    expect(url).toContain('state=state123');
    // Scopes are percent-encoded in the query; check the key scopes are present.
    expect(url).toContain('scope=');
    expect(url).toContain('youtube.readonly');
    expect(url).toContain('yt-analytics.readonly');
  });

  it('exchangeCode posts to the token endpoint and returns tokens', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, token_type: 'Bearer' }),
    } as Response);
    const tokens = await exchangeCode({ clientId: 'cid', clientSecret: 's', redirectUri: 'http://x/cb' }, 'the-code');
    expect(tokens.access_token).toBe('at');
    expect(tokens.refresh_token).toBe('rt');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('oauth2.googleapis.com/token');
    expect(String(init?.body)).toContain('grant_type=authorization_code');
    expect(String(init?.body)).toContain('code=the-code');
  });

  it('exchangeCode throws on non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 400, text: async () => 'bad' } as Response);
    await expect(exchangeCode({ clientId: 'c', clientSecret: 's', redirectUri: 'r' }, 'code')).rejects.toThrow(/token exchange failed/);
  });

  it('refreshAccessToken posts grant_type=refresh_token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'new-at', expires_in: 3600, token_type: 'Bearer' }),
    } as Response);
    const tokens = await refreshAccessToken({ clientId: 'c', clientSecret: 's', redirectUri: 'r' }, 'rt');
    expect(tokens.access_token).toBe('new-at');
    expect(String(fetchMock.mock.calls[0]![1]?.body)).toContain('grant_type=refresh_token');
  });

  it('fetchChannelInfo returns channel id + title', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [{ id: 'UC123', snippet: { title: 'My Channel' } }] }),
    } as Response);
    const info = await fetchChannelInfo('at');
    expect(info.channelId).toBe('UC123');
    expect(info.title).toBe('My Channel');
  });

  it('fetchChannelInfo throws when no channel found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => ({ items: [] }) } as Response);
    await expect(fetchChannelInfo('at')).rejects.toThrow(/No channel found/);
  });
});
