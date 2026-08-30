import {
  canPlatform,
  canProject,
  isProjectCapability,
  projectCapabilitiesForRole,
  PROJECT_CAPABILITIES,
  assertAllowed,
  type Actor,
  type PlatformCapability,
  type PlatformRole,
  type ProjectCapability,
  type ProjectRole,
  type Decision,
} from '@oss-tips/domain';

export type { Actor, Decision, PlatformCapability, PlatformRole, ProjectCapability, ProjectRole };

export { PROJECT_CAPABILITIES, isProjectCapability, projectCapabilitiesForRole };

const PROJECT_ROLES = ['owner', 'admin', 'finance', 'editor', 'community', 'analyst'] as const;
const PLATFORM_ROLES = [
  'owner',
  'operations',
  'finance',
  'moderation',
  'support',
  'auditor',
] as const;

export function parseProjectRole(value: unknown): ProjectRole | null {
  return typeof value === 'string' && PROJECT_ROLES.includes(value as ProjectRole)
    ? (value as ProjectRole)
    : null;
}

export function parsePlatformRole(value: unknown): PlatformRole | null {
  return typeof value === 'string' && PLATFORM_ROLES.includes(value as PlatformRole)
    ? (value as PlatformRole)
    : null;
}

export function hasProjectMembership(actor: Actor, projectId: string): boolean {
  return (
    actor.kind === 'user' && (actor.projectRoles.has(projectId) || actor.projectRoles.has('*'))
  );
}

export function hasPlatformRole(actor: Actor): boolean {
  return actor.kind === 'user' && actor.platformRoles.length > 0;
}

/** Build a safe same-origin sign-in return path. */
export function signInRedirectPath(returnTo: string): string {
  const path = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
  return `/sign-in?returnTo=${encodeURIComponent(path)}`;
}

export function checkProject(
  actor: Actor,
  capability: ProjectCapability,
  projectId: string,
): Decision {
  return canProject(actor, capability, projectId);
}

export function checkPlatform(actor: Actor, capability: PlatformCapability): Decision {
  return canPlatform(actor, capability);
}

export function requireProject(
  actor: Actor,
  capability: ProjectCapability,
  projectId: string,
): void {
  assertAllowed(canProject(actor, capability, projectId));
}

export function requirePlatform(actor: Actor, capability: PlatformCapability): void {
  assertAllowed(canPlatform(actor, capability));
}
