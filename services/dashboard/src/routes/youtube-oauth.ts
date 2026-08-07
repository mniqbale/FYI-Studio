// YouTube OAuth routes (workstream 1) — connect a channel via Google OAuth.
//
// Flow:
//   GET /api/social/youtube/connect  -> build consent URL, redirect to Google
//   GET /api/social/youtube/callback -> exchange code, fetch channel, persist
//                                       encrypted token, redirect to /settings
//
// Credentials come from env (GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI); never
// hardcoded. The CSRF `state` is a random value stored in a short-lived cookie
// to prevent cross-site request forgery.
import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';
import {
  loadOAuthConfig,
  buildAuthUrl,
  exchangeCode,
  fetchChannelInfo,
  persistOAuthAccount,
} from '@fyi/publish';

const STATE_COOKIE = 'fyi_oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function youtubeOAuthRoutes(app: FastifyInstance): Promise<void> {
  // Start OAuth: build consent URL and redirect to Google.
  app.get('/api/social/youtube/connect', async (request, reply) => {
    const config = loadOAuthConfig();
    if (!config) {
      return reply.code(503).send({ ok: false, error: 'YouTube OAuth is not configured (set GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI)' });
    }
    const tenantId = (request.query as { tenant_id?: string }).tenant_id ?? 'default';
    const state = randomBytes(24).toString('hex');
    // Store state + tenant in a short-lived cookie for the callback.
    reply.setCookie(STATE_COOKIE, `${state}.${tenantId}`, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: STATE_TTL_MS / 1000,
    });
    return reply.redirect(buildAuthUrl(config, state));
  });

  // OAuth callback: exchange code, fetch channel, persist encrypted token.
  app.get('/api/social/youtube/callback', async (request, reply) => {
    const config = loadOAuthConfig();
    if (!config) {
      return reply.code(503).send({ ok: false, error: 'YouTube OAuth is not configured' });
    }
    const q = request.query as { code?: string; state?: string; error?: string };
    if (q.error) {
      return reply.redirect(`/settings?oauth=error&reason=${encodeURIComponent(q.error)}`);
    }
    if (!q.code || !q.state) {
      return reply.redirect('/settings?oauth=error&reason=missing_code');
    }

    // Validate CSRF state against the cookie.
    const cookie = request.cookies?.[STATE_COOKIE];
    const [expectedState, tenantId] = cookie ? cookie.split('.') : [undefined, 'default'];
    if (!expectedState || expectedState !== q.state) {
      return reply.redirect('/settings?oauth=error&reason=state_mismatch');
    }

    try {
      const tokens = await exchangeCode(config, q.code);
      const channel = await fetchChannelInfo(tokens.access_token);
      await persistOAuthAccount({
        tenant_id: tenantId ?? 'default',
        platform: 'youtube',
        display_name: channel.title,
        account_ref: channel.channelId,
        tokenBundle: tokens,
      });
      reply.clearCookie(STATE_COOKIE, { path: '/' });
      return reply.redirect('/settings?oauth=success&channel=' + encodeURIComponent(channel.title));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.redirect(`/settings?oauth=error&reason=${encodeURIComponent(msg)}`);
    }
  });
}
