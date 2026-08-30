export type AccountDeletionBlockers = {
  activeMembership: boolean;
  ownedProject: boolean;
  authoredContent: boolean;
  platformRole: boolean;
};

export function accountDeletionBlocker(blockers: AccountDeletionBlockers): string | null {
  if (blockers.activeMembership) return 'Cancel active memberships before deleting your account.';
  if (blockers.ownedProject) return 'Transfer project ownership before deleting your account.';
  if (blockers.authoredContent)
    return 'Remove authored project content before deleting your account.';
  if (blockers.platformRole) return 'Remove your platform role before deleting your account.';
  return null;
}
