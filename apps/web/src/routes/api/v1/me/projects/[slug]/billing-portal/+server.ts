import { createStripeClient, validateIdempotencyKey } from '@oss-tips/payments';
import type { RequestHandler } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json, problem, publicBaseUrl, requireSession } from '../../../../../api-utils';
import { hasRecentAuthentication, recentAuthenticationRedirectPath } from '$lib/server/session';

const PROJECT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const session = requireSession(event);
  if (session instanceof Response) return session;
  const db = getDb();
  if (!(await hasRecentAuthentication(db, event.locals.session))) {
    return problem(
      403,
      'Recent authentication required',
      `Sign in again at ${recentAuthenticationRedirectPath(event)}`,
      { headers: { 'cache-control': 'no-store' } },
    );
  }
  if (!PROJECT_SLUG_PATTERN.test(event.params.slug)) return problem(400, 'Invalid project slug');

  const binding = await db
    .selectFrom('stripe_customer_binding')
    .innerJoin('project', 'project.id', 'stripe_customer_binding.project_id')
    .select([
      'stripe_customer_binding.stripe_customer_id',
      'stripe_customer_binding.stripe_account_id',
    ])
    .where('project.slug', '=', event.params.slug)
    .where('stripe_customer_binding.user_id', '=', session.userId)
    .executeTakeFirst();
  if (!binding) return problem(404, 'Billing profile not found');

  let idempotencyKey: string | undefined;
  const rawIdempotencyKey = event.request.headers.get('idempotency-key')?.trim();
  if (rawIdempotencyKey) {
    try {
      idempotencyKey = validateIdempotencyKey(rawIdempotencyKey);
    } catch {
      return problem(400, 'Invalid idempotency key');
    }
  }

  const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY);
  if (!stripe.createCustomerPortalSession) {
    return problem(503, 'Billing portal unavailable', 'Stripe customer portal is not configured');
  }
  try {
    const portal = await stripe.createCustomerPortalSession({
      stripeAccountId: binding.stripe_account_id,
      customerId: binding.stripe_customer_id,
      returnUrl: `${publicBaseUrl(event.url)}/me/memberships`,
      idempotencyKey,
    });
    return json({ id: portal.id, url: portal.url }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return problem(502, 'Billing portal unavailable', 'Unable to create a Stripe billing session');
  }
};
