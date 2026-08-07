// Auth routes — login page, POST /login, POST /logout. Opt-in: no-op when auth is off.
import type { FastifyInstance } from 'fastify';
import {
  isAuthEnabled,
  safeTokenEquals,
  expectedToken,
  signSessionCookie,
} from '../utils/auth.js';
import { renderLoginPage } from '../templates/login.js';

const COOKIE_NAME = 'fyi_auth';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Login page — exempt from the gate.
  app.get('/login', async (_request, reply) => {
    return reply.type('text/html').send(renderLoginPage());
  });

  // Validate the submitted token; on success set a signed httpOnly session cookie.
  app.post('/login', async (request, reply) => {
    if (!isAuthEnabled()) {
      return reply.redirect('/');
    }
    const body = request.body as { token?: string };
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (!token || !safeTokenEquals(token, expectedToken())) {
      return reply.type('text/html').send(renderLoginPage() + '<p class="muted" style="max-width:420px;margin:1rem auto;">Invalid token. Try again.</p>');
    }
    const cookie = `${COOKIE_NAME}=${signSessionCookie(token)}; HttpOnly; SameSite=Lax; Path=/`;
    return reply.header('set-cookie', cookie).redirect('/');
  });

  // Clear the session cookie.
  app.post('/logout', async (_request, reply) => {
    const cookie = `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
    return reply.header('set-cookie', cookie).redirect('/login');
  });
}
