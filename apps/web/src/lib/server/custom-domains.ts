import type { Db } from '@oss-tips/db';
import { isIP } from 'node:net';

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const RESERVED_HOSTNAMES = new Set([
  'localhost',
  'local',
  'internal',
  'intranet',
  'invalid',
  'example',
  'test',
  'home.arpa',
]);

export const DOMAIN_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

export type NormalizedHostname = { ok: true; hostname: string } | { ok: false; reason: string };

/** Normalize and constrain custom hostnames before they reach DNS or Cloudflare. */
export function normalizeCustomHostname(value: unknown): NormalizedHostname {
  if (typeof value !== 'string' || CONTROL_CHARACTERS.test(value)) {
    return { ok: false, reason: 'Hostname is invalid' };
  }
  const hostname = value.trim().toLowerCase().replace(/\.$/, '');
  if (
    !hostname ||
    hostname.length > 253 ||
    !HOSTNAME.test(hostname) ||
    isIP(hostname) !== 0 ||
    hostname === 'oss.tips' ||
    hostname.endsWith('.oss.tips') ||
    RESERVED_HOSTNAMES.has(hostname) ||
    hostname.split('.').some((label) => RESERVED_HOSTNAMES.has(label))
  ) {
    return { ok: false, reason: 'Hostname must be a public domain outside oss.tips' };
  }
  return { ok: true, hostname };
}

export function isFivePercentMode(mode: string | null | undefined): boolean {
  return mode === 'contributes_5_percent';
}

export function graceExpiry(now = new Date()): Date {
  return new Date(now.getTime() + DOMAIN_GRACE_MS);
}

export function domainStatusFromProvider(
  hostnameStatus: string,
  sslStatus: string,
): 'awaiting_dns' | 'validating' | 'active' | 'failed' | 'removed' {
  if (hostnameStatus === 'deleted' || sslStatus === 'deleted') return 'removed';
  if (hostnameStatus === 'active' && sslStatus === 'active') return 'active';
  if (
    hostnameStatus.includes('timed_out') ||
    sslStatus.includes('timed_out') ||
    hostnameStatus === 'expired' ||
    sslStatus === 'expired' ||
    hostnameStatus === 'inactive' ||
    sslStatus === 'inactive'
  ) {
    return 'failed';
  }
  if (hostnameStatus === 'pending_validation' || sslStatus === 'pending_validation') {
    return 'awaiting_dns';
  }
  return 'validating';
}

export function canonicalProjectUrl(
  origin: string,
  slug: string,
  pathname = '/',
  search = '',
): string {
  const base = origin.endsWith('/') ? origin : `${origin}/`;
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return new URL(`/${slug}${normalizedPath}${search}`, base).toString();
}

/** Build an action redirect on the canonical origin without inventing a project path. */
export function canonicalActionUrl(origin: string, pathname: string, search = ''): string {
  const base = origin.endsWith('/') ? origin : `${origin}/`;
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return new URL(`${normalizedPath}${search}`, base).toString();
}

export type CustomDomainRoute =
  { kind: 'rewrite'; pathname: string } | { kind: 'redirect'; pathname: string };

/** Only public project pages are served on a custom host; actions stay canonical. */
export function customDomainRoute(pathname: string, slug: string): CustomDomainRoute | null {
  if (
    pathname.startsWith('/_app/') ||
    pathname === '/favicon.svg' ||
    pathname === '/favicon.ico' ||
    pathname === '/og-default.png' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return { kind: 'rewrite', pathname };
  }
  if (pathname === '/support' || pathname.startsWith('/support/')) {
    return { kind: 'redirect', pathname: `/${slug}/support` };
  }
  if (
    pathname === '/checkout' ||
    pathname.startsWith('/checkout/') ||
    pathname === '/sign-in' ||
    pathname.startsWith('/sign-in/') ||
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/me' ||
    pathname.startsWith('/me/') ||
    pathname === '/api' ||
    pathname.startsWith('/api/')
  ) {
    return { kind: 'redirect', pathname };
  }
  if (pathname === '/') return { kind: 'rewrite', pathname: `/${slug}` };
  if (pathname.startsWith('/posts/') || pathname.startsWith('/goals/')) {
    return { kind: 'rewrite', pathname: `/${slug}${pathname}` };
  }
  return null;
}

export type ResolvedCustomDomain = {
  projectId: string;
  projectSlug: string;
  hostname: string;
  graceUntil: Date | null;
};

/** Resolve only active TLS hostnames, retaining a 30-day grace window after mode changes. */
export async function resolveCustomDomain(
  db: Db,
  value: string,
  now = new Date(),
): Promise<ResolvedCustomDomain | null> {
  const normalized = normalizeCustomHostname(value);
  if (!normalized.ok) return null;
  const row = await db
    .selectFrom('custom_domain')
    .innerJoin('project', 'project.id', 'custom_domain.project_id')
    .leftJoin('project_feature_mode', 'project_feature_mode.project_id', 'project.id')
    .select([
      'custom_domain.project_id',
      'custom_domain.hostname',
      'custom_domain.status',
      'custom_domain.ssl_status',
      'custom_domain.grace_until',
      'custom_domain.canonical_enabled',
      'project.slug as project_slug',
      'project.status as project_status',
      'project_feature_mode.mode as feature_mode',
      'project_feature_mode.effective_at as feature_mode_effective_at',
    ])
    .where('custom_domain.hostname', '=', normalized.hostname)
    .where('project.status', '=', 'published')
    .executeTakeFirst();
  if (!row || !row.canonical_enabled) return null;
  const active = row.status === 'active' && row.ssl_status === 'active';
  const modeGraceUntil =
    active && !isFivePercentMode(row.feature_mode) && row.feature_mode_effective_at !== null
      ? new Date(row.feature_mode_effective_at.getTime() + DOMAIN_GRACE_MS)
      : null;
  const graceUntil = row.grace_until ?? modeGraceUntil;
  const grace =
    (row.status === 'grace_disabled' || active) && graceUntil !== null && graceUntil > now;
  if (!active && !grace) return null;
  return {
    projectId: row.project_id,
    projectSlug: row.project_slug,
    hostname: row.hostname,
    graceUntil,
  };
}
