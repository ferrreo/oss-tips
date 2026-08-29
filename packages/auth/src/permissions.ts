import {
  canPlatform,
  canProject,
  assertAllowed,
  type Actor,
  type PlatformCapability,
  type ProjectCapability,
  type Decision,
} from '@oss-tips/domain';

export type { Actor, Decision, ProjectCapability, PlatformCapability };

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
