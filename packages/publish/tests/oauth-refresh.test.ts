// Unit tests for OAuth token refresh logic (workstream B — auto-refresh).
// Verifies isTokenExpired and getValidAccessToken refresh+persist behavior.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@fyi/database', () => ({
  prisma: {
    socialAccount: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@fyi/platform', () => ({
  encryptSecret: vi.fn((s: string) => `enc:${Buffer.from(s).toString('base64url')}`),
  decryptSecret: vi.fn((blob: string) => {
    const b64 = blob.replace(/^enc:/, '');
    return Buffer.from(b64, 'base64url').toString('utf8');
  }),
}));

import { prisma } from '@fyi/database';
import { decryptSecret } from '@fyi/platform';
import { getValidAccessToken, isTokenExpired, encryptTokenBundle } from '../src/oauth/store.js';

const makeBundle = (overrides: Record<string, unknown> = {}) => ({
  access_token: 'at-1',
  refresh_token: 'rt-1',
  expires_in: 3600,
  token_type: 'Bearer',
  issued_at: Date.now(),
  ...overrides,
});

describe('OAuth token refresh (workstream B)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('isTokenExpired: not expired within window', () => {
    expect(isTokenExpired(makeBundle())).toBe(false);
  });

  it('isTokenExpired: expired when past issued_at + expires_in - 60s', () => {
    expect(isTokenExpired(makeBundle({ issued_at: Date.now() - 4000 * 1000 }))).toBe(true);
  });

  it('isTokenExpired: true when issued_at missing', () => {
    expect(isTokenExpired(makeBundle({ issued_at: undefined }))).toBe(true);
  });

  it('getValidAccessToken returns token without refresh when not expired', async () => {
    const bundle = makeBundle();
    vi.mocked(prisma.socialAccount.findUnique).mockResolvedValue({ token_ref: encryptTokenBundle(bundle) } as never);
    const refresh = vi.fn();
    const token = await getValidAccessToken('acc-1', refresh);
    expect(token).toBe('at-1');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('getValidAccessToken refreshes + persists when expired', async () => {
    const expired = makeBundle({ issued_at: Date.now() - 4000 * 1000 });
    vi.mocked(prisma.socialAccount.findUnique).mockResolvedValue({ token_ref: encryptTokenBundle(expired) } as never);
    vi.mocked(prisma.socialAccount.update).mockResolvedValue({} as never);
    const refresh = vi.fn().mockResolvedValue({ access_token: 'at-new', refresh_token: 'rt-new', expires_in: 3600, token_type: 'Bearer' });

    const token = await getValidAccessToken('acc-1', refresh);

    expect(token).toBe('at-new');
    expect(refresh).toHaveBeenCalledWith(expired);
    // Persist writes an encrypted bundle containing the new access token.
    const callArgs = vi.mocked(prisma.socialAccount.update).mock.calls[0] as unknown as [{ data: { token_ref: string } }];
    const data = callArgs[0].data;
    const stored = decryptSecret(data.token_ref);
    expect(JSON.parse(stored!).access_token).toBe('at-new');
    expect(JSON.parse(stored!).refresh_token).toBe('rt-new');
  });

  it('getValidAccessToken returns undefined when no refresh token', async () => {
    const expired = makeBundle({ issued_at: Date.now() - 4000 * 1000, refresh_token: undefined });
    vi.mocked(prisma.socialAccount.findUnique).mockResolvedValue({ token_ref: encryptTokenBundle(expired) } as never);
    const token = await getValidAccessToken('acc-1', vi.fn());
    expect(token).toBeUndefined();
  });
});
