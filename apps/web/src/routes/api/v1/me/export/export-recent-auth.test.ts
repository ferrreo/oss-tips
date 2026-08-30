import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));

vi.mock('$lib/server/session', () => ({
  hasRecentAuthentication: vi.fn(),
  recentAuthenticationRedirectPath: vi.fn(() => '/sign-in?returnTo=%2Fapi%2Fv1%2Fme%2Fexport'),
}));

import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { hasRecentAuthentication } from '$lib/server/session';
import { GET } from './+server';

function event() {
  const url = new URL('https://oss.tips/api/v1/me/export');
  return {
    request: new Request(url),
    url,
    locals: {
      session: {
        session: { id: 'session-1' },
        user: { id: 'user-1' },
      },
    },
  } as Parameters<typeof GET>[0];
}

describe('account export recent authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasDatabaseUrl).mockReturnValue(true);
    vi.mocked(hasRecentAuthentication).mockResolvedValue(false);
  });

  it('rejects a stale session before loading personal export data', async () => {
    const db = {
      selectFrom: vi.fn(() => {
        throw new Error('must not query export data');
      }),
    };
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await GET(event());

    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ title: 'Recent authentication required' });
    expect(db.selectFrom).not.toHaveBeenCalled();
  });
});
