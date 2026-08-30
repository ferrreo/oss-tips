import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { startTelemetry } from '@oss-tips/observability';
import { getAuth, isAuthDevMode } from '$lib/server/auth';
import { enforceSupporterRateLimit } from './routes/api/api-utils';
import {
  canonicalActionUrl,
  customDomainRoute,
  resolveCustomDomain,
} from '$lib/server/custom-domains';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { validateWebProductionConfig } from '$lib/server/runtime-config';
import { buildActor, createAuthDevActor, createAuthDevSession } from '$lib/server/session';
import {
  rateLimitForRequest,
  rateLimitResponse,
  sameOriginGuard,
  withSecurityHeaders,
} from '$lib/server/security';

startTelemetry('@oss-tips/web');
validateWebProductionConfig();

/** Load Better Auth session once per request and fail closed on auth/DB errors. */
export const handle: Handle = async ({ event, resolve }) => {
  event.locals.session = null;
  event.locals.actor = null;
  event.locals.customDomain = undefined;

  const originFailure = sameOriginGuard(event.request, event.url);
  if (originFailure) return withSecurityHeaders(originFailure, event.url);

  const rateLimit = rateLimitForRequest(event.request, event.url);
  if (rateLimit && !rateLimit.allowed) {
    return withSecurityHeaders(rateLimitResponse(rateLimit), event.url, rateLimit);
  }

  if (hasDatabaseUrl()) {
    const canonicalHost = new URL(process.env.PUBLIC_APP_URL ?? 'https://oss.tips').hostname;
    if (event.url.hostname !== canonicalHost && event.url.hostname !== 'localhost') {
      let customDomain;
      try {
        customDomain = await resolveCustomDomain(getDb(), event.url.hostname);
      } catch {
        return withSecurityHeaders(new Response('Service unavailable', { status: 503 }), event.url);
      }
      if (customDomain) {
        const route = customDomainRoute(event.url.pathname, customDomain.projectSlug);
        if (!route) {
          return withSecurityHeaders(new Response('Not found', { status: 404 }), event.url);
        }
        event.locals.customDomain = customDomain;
        if (route.kind === 'redirect') {
          const target = canonicalActionUrl(
            process.env.PUBLIC_APP_URL ?? 'https://oss.tips',
            route.pathname,
            event.url.search,
          );
          return withSecurityHeaders(redirect(307, target), event.url);
        }
        event.url.pathname = route.pathname;
      }
    }
  }

  if (!hasDatabaseUrl()) {
    // Explicit local-only bypass keeps Storybook/demo routes usable without a DB.
    if (isAuthDevMode()) {
      event.locals.session = createAuthDevSession();
      event.locals.actor = createAuthDevActor();
    }
    return withSecurityHeaders(await resolve(event), event.url, rateLimit);
  }

  try {
    const session = await getAuth().api.getSession({ headers: event.request.headers });
    event.locals.session = session;
    if (session) event.locals.actor = await buildActor(getDb(), session.user.id);
  } catch {
    console.error('[auth] Failed to load request session');
    event.locals.session = null;
    event.locals.actor = null;
  }

  const supporterRateLimit = await enforceSupporterRateLimit(event, getDb());
  if (supporterRateLimit) return withSecurityHeaders(supporterRateLimit, event.url);

  return withSecurityHeaders(await resolve(event), event.url, rateLimit);
};
