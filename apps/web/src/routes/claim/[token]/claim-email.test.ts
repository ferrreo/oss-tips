import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));

vi.mock('$lib/server/guest-access', () => ({
  claimGuestPayment: vi.fn(),
}));

vi.mock('@oss-tips/db', async () => {
  const actual = await vi.importActual<typeof import('@oss-tips/db')>('@oss-tips/db');
  return { ...actual, createGuestAccessRepository: vi.fn() };
});

import { createGuestAccessRepository, hashGuestEmail } from '@oss-tips/db';
import { hasDatabaseUrl } from '$lib/server/db';
import { claimGuestPayment } from '$lib/server/guest-access';
import { POST } from './+server';

const CLAIM_TOKEN = `gat_${'a'.repeat(43)}`;

function event(emailVerified: boolean) {
  const url = new URL(`https://oss.tips/claim/${CLAIM_TOKEN}`);
  return {
    request: new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'claim' }),
    }),
    url,
    params: { token: CLAIM_TOKEN },
    locals: {
      session: {
        user: { id: 'user-1', email: 'supporter@example.com', emailVerified },
      },
    },
  } as Parameters<typeof POST>[0];
}

describe('guest claim email verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasDatabaseUrl).mockReturnValue(true);
    vi.mocked(createGuestAccessRepository).mockReturnValue({
      find: vi.fn().mockResolvedValue({
        id: 'token-1',
        kind: 'claim',
        email_hash: hashGuestEmail('supporter@example.com'),
        expires_at: new Date('2026-09-01T00:00:00.000Z'),
        used_at: null,
        attempt_count: 0,
      }),
      recordFailedAttempt: vi.fn(),
    } as never);
  });

  it('rejects an unverified OAuth session before claiming a matching payment', async () => {
    const response = await POST(event(false));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ title: 'Verified email required' });
    expect(claimGuestPayment).not.toHaveBeenCalled();
  });
});
