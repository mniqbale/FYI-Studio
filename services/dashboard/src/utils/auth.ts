// Opt-in HTTP auth for the dashboard (pre-shared bearer token + signed session cookie).
// Auth is DISABLED unless DASHBOARD_AUTH_TOKEN is set, so local dev / tests are unaffected.
// No heavy deps: HMAC via node:crypto + timing-safe compares.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

const COOKIE_NAME = 'fyi_auth';
const HASH_SECRET = 'fyi-dashboard-auth-v1';

export function isAuthEnabled(): boolean {
  const t = process.env.DASHBOARD_AUTH_TOKEN;
  return typeof t === 'string' && t.length > 0;
}

export function expectedToken(): string {
  return process.env.DASHBOARD_AUTH_TOKEN ?? '';
}

/** Constant-time equality of two utf8 strings (normalized to sha256 so lengths match). */
export function safeTokenEquals(a: string, b: string): boolean {
  const ha = createHmac('sha256', HASH_SECRET).update(a).digest();
  const hb = createHmac('sha256', HASH_SECRET).update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Session cookie secret derived from the shared token itself (HMAC key). */
function cookieKey(): Buffer {
  return createHmac('sha256', 'fyi-dashboard-cookie-secret').update(expectedToken()).digest();
}

export function signSessionCookie(token: string): string {
  const key = cookieKey();
  const sig = createHmac('sha256', key).update('session').digest('hex');
  const hash = createHmac('sha256', HASH_SECRET).update(token).digest('hex');
  return `${hash}.${sig}`;
}

export function validSessionCookie(value: string | undefined): boolean {
  if (!value) return false;
  const idx = value.indexOf('.');
  if (idx === -1) return false;
  const [hash, sig] = [value.slice(0, idx), value.slice(idx + 1)];
  if (!hash || !sig) return false;
  const key = cookieKey();
  const expectedSig = createHmac('sha256', key).update('session').digest('hex');
  const expectedHash = createHmac('sha256', HASH_SECRET).update(expectedToken()).digest('hex');
  return safeTokenEquals(hash, expectedHash) && safeTokenEquals(sig, expectedSig);
}

/** Extract a candidate token from query param or Authorization header. */
export function tokenFromRequest(request: FastifyRequest): string | undefined {
  const q = request.query as { token?: string };
  if (typeof q.token === 'string' && q.token.length > 0) return q.token;
  const auth = request.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const t = auth.slice('Bearer '.length).trim();
    if (t.length > 0) return t;
  }
  return undefined;
}

/** Pull a named cookie value out of the raw Cookie header. */
export function cookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return undefined;
}

function pathOf(url: string): string {
  const i = url.indexOf('?');
  return i === -1 ? url : url.slice(0, i);
}

/** Routes that are always reachable without auth. */
export function isExemptPath(path: string): boolean {
  return path === '/health' || path.startsWith('/assets/') || path === '/login' || path === '/logout';
}

/**
 * Fastify preHandler gate. Applies to every route; exempts health/assets/login/logout.
 * Accepts a valid token via ?token= or Authorization: Bearer, or a signed session cookie.
 */
export async function authPreHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!isAuthEnabled()) return;

  const path = pathOf(request.url);
  if (isExemptPath(path)) return;

  const token = tokenFromRequest(request);
  if (token && safeTokenEquals(token, expectedToken())) return;

  const cookie = cookieValue(request.headers.cookie, COOKIE_NAME);
  if (cookie && validSessionCookie(cookie)) return;

  request.log.warn({ path }, 'auth rejected request');
  if (path.startsWith('/api/')) {
    return reply.code(401).send({ ok: false, error: 'unauthorized' });
  }
  return reply.redirect('/login');
}
