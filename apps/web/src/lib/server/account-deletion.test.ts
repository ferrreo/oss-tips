import { describe, expect, it } from 'vitest';
import { accountDeletionBlocker } from './account-deletion';

describe('accountDeletionBlocker', () => {
  it('reports blockers in safe resolution order', () => {
    expect(
      accountDeletionBlocker({
        activeMembership: true,
        ownedProject: true,
        authoredContent: true,
        platformRole: true,
      }),
    ).toContain('active memberships');
    expect(
      accountDeletionBlocker({
        activeMembership: false,
        ownedProject: true,
        authoredContent: false,
        platformRole: false,
      }),
    ).toContain('project ownership');
  });

  it('allows deletion when no database ownership constraints remain', () => {
    expect(
      accountDeletionBlocker({
        activeMembership: false,
        ownedProject: false,
        authoredContent: false,
        platformRole: false,
      }),
    ).toBeNull();
  });
});
