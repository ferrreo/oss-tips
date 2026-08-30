import { checkProject } from '@oss-tips/auth';
import { createProjectsRepository } from '@oss-tips/db';
import {
  deriveIdempotencyKey,
  createStripeClient,
  validateIdempotencyKey,
} from '@oss-tips/payments';
import type { RequestHandler } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { auditRecord, json, problem } from '../../../../../api-utils';
import { ensureConnectedAccount } from '$lib/server/stripe-connect';
import { hasRecentAuthentication, recentAuthenticationRedirectPath } from '$lib/server/session';

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  if (!event.locals.session || !event.locals.actor) {
    return problem(401, 'Authentication required');
  }
  const sessionUserId = event.locals.session.user.id;

  const project = await createProjectsRepository(getDb()).findBySlug(event.params.slug);
  if (!project) return problem(404, 'Project not found');
  if (project.status === 'closed') {
    return problem(409, 'Project is closed', 'Closed projects do not accept mutations');
  }
  const decision = checkProject(event.locals.actor, 'project.connect_stripe', project.id);
  if (!decision.allowed) return problem(403, 'Project access denied', decision.reason);
  const db = getDb();
  if (!(await hasRecentAuthentication(db, event.locals.session))) {
    return problem(
      403,
      'Recent authentication required',
      `Sign in again at ${recentAuthenticationRedirectPath(event)}`,
      { headers: { 'cache-control': 'no-store' } },
    );
  }

  const rawIdempotencyKey = event.request.headers.get('idempotency-key')?.trim();
  if (!rawIdempotencyKey) {
    return problem(
      400,
      'Idempotency key required',
      'Connect onboarding requests must include a valid Idempotency-Key',
    );
  }
  let idempotencyKey: string;
  try {
    idempotencyKey = validateIdempotencyKey(rawIdempotencyKey);
  } catch {
    return problem(400, 'Invalid idempotency key');
  }

  const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY);
  try {
    const scopedIdempotencyKey = deriveIdempotencyKey(project.id, idempotencyKey);
    const account = await ensureConnectedAccount(
      db,
      project,
      stripe,
      scopedIdempotencyKey,
      event.locals.session.user.email,
    );
    if (!stripe.createConnectedAccountSession) {
      return problem(503, 'Stripe Connect unavailable', 'Account sessions are not configured');
    }
    const session = await stripe.createConnectedAccountSession({
      stripeAccountId: account.stripe_account_id,
      idempotencyKey: deriveIdempotencyKey(scopedIdempotencyKey, 'connect-account-session'),
    });
    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId: sessionUserId },
            {
              action: 'stripe.account_session_created',
              resourceType: 'stripe_connected_account',
              projectId: project.id,
              metadata: { stripe_account_id: account.stripe_account_id },
            },
          ),
        )
        .execute();
    });
    return json(
      {
        connected_account_id: session.stripeAccountId,
        client_secret: session.clientSecret,
        expires_at: session.expiresAt,
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return problem(502, 'Stripe Connect unavailable', 'Unable to create onboarding session');
  }
};
