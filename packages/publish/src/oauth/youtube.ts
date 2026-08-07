// YouTube OAuth 2.0 (Google) — production-ready OAuth client (workstream 1).
//
// Implements the OAuth authorization-code flow for connecting a YouTube
// channel: build the consent URL, exchange the authorization code for tokens,
// refresh an expired access token, and fetch the connected channel's identity.
//
// Credentials come from env (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET /
// GOOGLE_REDIRECT_URI) — never hardcoded. Token material is returned to the
// caller, which stores it ENCRYPTED (AES-256-GCM via @fyi/platform) by
// reference; it is never logged or persisted in plaintext.

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_CHANNEL_URL = 'https://www.googleapis.com/youtube/v3/channels';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Load OAuth config from env. Returns null when not configured. */
export function loadOAuthConfig(): OAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

/** Scopes required to read channel identity + analytics + upload. */
export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
].join(' ');

/** Build the Google OAuth consent URL for a given CSRF state. */
export function buildAuthUrl(config: OAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: YOUTUBE_SCOPES,
    access_type: 'offline', // required for a refresh token
    prompt: 'consent', // force refresh token on every connect
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

/** Exchange an authorization code for access + refresh tokens. */
export async function exchangeCode(config: OAuthConfig, code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OAuth token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as TokenResponse;
}

/** Refresh an expired access token using a refresh token. */
export async function refreshAccessToken(config: OAuthConfig, refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OAuth token refresh failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as TokenResponse;
}

export interface ChannelInfo {
  channelId: string;
  title: string;
}

/** Fetch the connected channel's identity (id + title) with an access token. */
export async function fetchChannelInfo(accessToken: string): Promise<ChannelInfo> {
  const url = `${YOUTUBE_CHANNEL_URL}?part=snippet,id&mine=true`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`YouTube channel fetch failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { items?: Array<{ id: string; snippet?: { title?: string } }> };
  const item = data.items?.[0];
  if (!item?.id) throw new Error('No channel found for this account');
  return { channelId: item.id, title: item.snippet?.title ?? 'YouTube Channel' };
}
