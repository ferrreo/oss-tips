import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import {
  hasPlatformRole,
  hasProjectMembership,
  isProjectCapability,
  parsePlatformRole,
  parseProjectRole,
  signInRedirectPath,
  type Actor,
  type PlatformRole,
  type ProjectRole,
  type ProjectCapability,
} from '@oss-tips/auth';
import type { Db } from '@oss-tips/db';

/** Financial mutations accept only a recently created Better Auth session. */
export const RECENT_AUTH_MAX_AGE_MS = 15 * 60 * 1_000;

export type AuthSession = {
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
};

/** Explicit local demo identity; never use this path in production. */
export function createAuthDevSession(): AuthSession {
  const now = new Date();
  return {
    session: {
      id: 'demo-session',
      userId: 'demo-user',
      token: 'demo-session-token',
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    },
    user: {
      id: 'demo-user',
      name: 'Demo maintainer',
      email: 'demo@oss.tips',
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
    },
  };
}

/** Local demo has access to fixture project routes and platform workspace. */
export function createAuthDevActor(): Actor {
  return {
    kind: 'user',
    userId: 'demo-user',
    projectRoles: new Map([['*', 'owner']]),
    platformRoles: ['owner'],
  };
}

export async function buildActor(db: Db, userId: string): Promise<Actor> {
  const [projectRows, platformRows] = await Promise.all([
    db
      .selectFrom('project_member')
      .innerJoin('project', 'project.id', 'project_member.project_id')
      .select([
        'project_member.project_id',
        'project.slug as project_slug',
        'project_member.role',
        'project_member.capabilities',
      ])
      .where('project_member.user_id', '=', userId)
      .execute(),
    db.selectFrom('platform_member').select(['role']).where('user_id', '=', userId).execute(),
  ]);

  const projectRoles = new Map<string, ProjectRole>();
  const projectCapabilities = new Map<string, ReadonlySet<ProjectCapability>>();
  for (const row of projectRows) {
    const role = parseProjectRole(row.role);
    if (!role) continue;
    projectRoles.set(row.project_id, role);
    projectRoles.set(row.project_slug, role);
    const capabilities = new Set(row.capabilities.filter(isProjectCapability));
    projectCapabilities.set(row.project_id, capabilities);
    projectCapabilities.set(row.project_slug, capabilities);
  }

  const platformRoles: PlatformRole[] = [];
  for (const row of platformRows) {
    const role = parsePlatformRole(row.role);
    if (role && !platformRoles.includes(role)) platformRoles.push(role);
  }

  return { kind: 'user', userId, projectRoles, projectCapabilities, platformRoles };
}

type ProtectedEvent = Pick<RequestEvent, 'locals' | 'url'>;

function recentAuthTimestamp(value: unknown, now: Date): boolean {
  if (!(value instanceof Date)) return false;
  const timestamp = value.getTime();
  const current = now.getTime();
  if (!Number.isFinite(timestamp) || !Number.isFinite(current)) return false;
  const age = current - timestamp;
  return age >= 0 && age < RECENT_AUTH_MAX_AGE_MS;
}

/** Better Auth sign-in creates a new durable session row; its creation time is the marker. */
export function isRecentAuthentication(
  session: AuthSession | null | undefined,
  now = new Date(),
): boolean {
  return recentAuthTimestamp(session?.session?.createdAt, now);
}

/** Re-read current session row so cookie-cached sessions cannot authorize stale money actions. */
export async function hasRecentAuthentication(
  db: Pick<Db, 'selectFrom'>,
  session: AuthSession | null | undefined,
  now = new Date(),
): Promise<boolean> {
  if (!isRecentAuthentication(session, now)) return false;
  const current = session?.session;
  if (!current || !current.id || !current.token || !current.userId) return false;
  if (current.userId !== session?.user.id) return false;
  try {
    const row = await db
      .selectFrom('session')
      .select(['id', 'created_at', 'expires_at'])
      .where('id', '=', current.id)
      .where('user_id', '=', current.userId)
      .where('token', '=', current.token)
      .executeTakeFirst();
    return Boolean(row && row.expires_at > now && recentAuthTimestamp(row.created_at, now));
  } catch {
    return false;
  }
}

/** Safe same-origin reauthentication target for both form actions and API clients. */
export function recentAuthenticationRedirectPath(event: Pick<RequestEvent, 'url'>): string {
  return signInRedirectPath(`${event.url.pathname}${event.url.search}`);
}

export function requireAuthenticated(event: ProtectedEvent): AuthSession {
  if (!event.locals.session) {
    throw redirect(303, signInRedirectPath(`${event.url.pathname}${event.url.search}`));
  }
  return event.locals.session;
}

export function requireProjectMembership(event: ProtectedEvent, projectId: string): Actor {
  requireAuthenticated(event);
  const actor = event.locals.actor;
  if (!actor || !hasProjectMembership(actor, projectId)) {
    throw error(403, 'You do not have access to this project.');
  }
  return actor;
}

export function requirePlatformMembership(event: ProtectedEvent): Actor {
  requireAuthenticated(event);
  const actor = event.locals.actor;
  if (!actor || !hasPlatformRole(actor)) {
    throw error(403, 'You do not have access to the platform workspace.');
  }
  return actor;
}
