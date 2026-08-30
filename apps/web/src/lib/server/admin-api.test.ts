import { describe, expect, it } from 'vitest';
import { requirePlatformReviewer } from './admin-api';

function event(actor: App.Locals['actor'], session: App.Locals['session']) {
  return { locals: { actor, session } } as Pick<import('@sveltejs/kit').RequestEvent, 'locals'>;
}

describe('admin ownership review boundary', () => {
  it('requires an authenticated platform reviewer', () => {
    expect(requirePlatformReviewer(event(null, null))).toMatchObject({ status: 401 });
    expect(
      requirePlatformReviewer(
        event(
          {
            kind: 'user',
            userId: 'user-1',
            projectRoles: new Map(),
            platformRoles: ['support'],
          },
          { user: { id: 'user-1' } } as App.Locals['session'],
        ),
      ),
    ).toMatchObject({ status: 403 });
  });

  it('allows only platform owner or operations roles to review claims', () => {
    const result = requirePlatformReviewer(
      event(
        {
          kind: 'user',
          userId: 'operator-1',
          projectRoles: new Map(),
          platformRoles: ['operations'],
        },
        { user: { id: 'operator-1' } } as App.Locals['session'],
      ),
    );
    expect(result).toEqual({ userId: 'operator-1' });
  });
});
