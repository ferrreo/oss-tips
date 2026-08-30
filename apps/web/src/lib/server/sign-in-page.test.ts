import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getConfiguredOAuthProviders: vi.fn(),
}));

vi.mock('$lib/server/auth', () => mocks);

import { load } from '../../routes/sign-in/+page.server';

describe('sign-in page OAuth providers', () => {
  beforeEach(() => {
    mocks.getConfiguredOAuthProviders.mockReset();
  });

  it('returns no OAuth providers when none are configured', async () => {
    mocks.getConfiguredOAuthProviders.mockReturnValue([]);

    expect(await load({} as never)).toEqual({ oauthProviders: [] });
  });

  it('passes configured Better Auth provider ids through in configured order', async () => {
    mocks.getConfiguredOAuthProviders.mockReturnValue(['gitlab', 'codeberg', 'discord']);

    expect(await load({} as never)).toEqual({
      oauthProviders: [
        { id: 'gitlab', label: '' },
        { id: 'codeberg', label: '' },
        { id: 'discord', label: '' },
      ],
    });
  });
});
