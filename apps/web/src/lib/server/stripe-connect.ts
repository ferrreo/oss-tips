import { deriveIdempotencyKey, type StripeClient } from '@oss-tips/payments';
import { uuidv7 } from '@oss-tips/domain';
import type { Db } from '@oss-tips/db';

export type ConnectProject = {
  id: string;
  name: string;
  slug: string;
  default_currency: string;
};

export async function ensureConnectedAccount(
  db: Db,
  project: ConnectProject,
  stripe: StripeClient,
  idempotencyKey: string,
  contactEmail?: string,
) {
  const existing = await db
    .selectFrom('stripe_connected_account')
    .selectAll()
    .where('project_id', '=', project.id)
    .executeTakeFirst();
  if (existing) return existing;
  if (!stripe.createConnectedAccount) {
    throw new Error('Stripe Connect account creation is unavailable');
  }

  const account = await stripe.createConnectedAccount({
    displayName: project.name,
    ...(contactEmail ? { contactEmail } : {}),
    defaultCurrency: project.default_currency,
    idempotencyKey: deriveIdempotencyKey(idempotencyKey, 'connect-account'),
    metadata: { project_id: project.id },
  });

  try {
    return await db
      .insertInto('stripe_connected_account')
      .values({
        id: uuidv7(),
        project_id: project.id,
        stripe_account_id: account.stripeAccountId,
        charges_enabled: false,
        payouts_enabled: false,
        capabilities: {},
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  } catch {
    const raced = await db
      .selectFrom('stripe_connected_account')
      .selectAll()
      .where('project_id', '=', project.id)
      .executeTakeFirst();
    if (raced) return raced;
    throw new Error('Unable to save Stripe Connect account');
  }
}
