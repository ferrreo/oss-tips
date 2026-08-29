import { CheckoutIntentRequestSchema, CheckoutIntentResponseSchema } from '@oss-tips/api-contracts';
import {
  createPaymentsRepository,
  createProjectsRepository,
  type Db,
} from '@oss-tips/db';
import { uuidv7, type FeatureMode } from '@oss-tips/domain';
import { createCheckoutIntent, createStripeClient } from '@oss-tips/payments';
import type { RequestHandler } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json, problem } from '$lib/server/http';

async function loadCheckoutContext(db: Db, slug: string) {
  const projects = createProjectsRepository(db);
  const project = await projects.findBySlug(slug);
  if (!project) return null;

  const connected = await db
    .selectFrom('stripe_connected_account')
    .selectAll()
    .where('project_id', '=', project.id)
    .executeTakeFirst();

  const feature = await db
    .selectFrom('project_feature_mode')
    .selectAll()
    .where('project_id', '=', project.id)
    .executeTakeFirst();

  return { project, connected, feature };
}

function toFeatureMode(raw: string | undefined): FeatureMode {
  if (raw === 'contributes_5_percent') return 'contributes_5_percent';
  return 'standard';
}

export const POST: RequestHandler = async ({ params, request, url }) => {
  if (!hasDatabaseUrl()) {
    return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  }

  const slug = params.slug;
  if (!slug) {
    return problem(400, 'Missing project slug');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problem(400, 'Invalid JSON body');
  }

  const parsed = CheckoutIntentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return problem(400, 'Invalid checkout request', parsed.error.message);
  }

  const db = getDb();
  const ctx = await loadCheckoutContext(db, slug);
  if (!ctx) {
    return problem(404, 'Project not found');
  }

  if (!ctx.connected?.charges_enabled) {
    return problem(409, 'Payments not ready', 'Connected account cannot accept charges yet');
  }

  const paymentId = uuidv7();
  const appUrl = process.env.PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`;
  const featureMode = toFeatureMode(ctx.feature?.mode);
  const caps = (ctx.connected.capabilities ?? {}) as {
    card_payments?: string;
    crypto_payments?: string;
  };

  const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY);
  const intent = await createCheckoutIntent(stripe, {
    project: slug,
    tierId: parsed.data.tierId,
    projectAmountMinor: parsed.data.projectAmountMinor,
    projectCurrency: parsed.data.projectCurrency,
    platformTipMinor: parsed.data.platformTipMinor,
    cadence: parsed.data.cadence,
    publicOptions: parsed.data.publicOptions,
  }, {
    projectId: ctx.project.id,
    paymentId,
    stripeAccountId: ctx.connected.stripe_account_id,
    featureMode,
    capabilities: {
      cardPayments: caps.card_payments === 'active' || ctx.connected.charges_enabled,
      cryptoPayments: caps.crypto_payments === 'active',
    },
    successUrl: `${appUrl.replace(/\/$/, '')}/checkout/success?payment_id=${paymentId}`,
    cancelUrl: `${appUrl.replace(/\/$/, '')}/${slug}/support`,
  });

  const allocationProject = BigInt(parsed.data.projectAmountMinor);
  const allocationTip = BigInt(parsed.data.platformTipMinor);
  const customerCharge = BigInt(intent.customerChargeMinor);
  const applicationFee = BigInt(intent.applicationFeeMinor);
  const ossFee = applicationFee - allocationTip;

  await createPaymentsRepository(db).create({
    id: paymentId,
    project_id: ctx.project.id,
    user_id: null,
    stripe_account_id: ctx.connected.stripe_account_id,
    stripe_payment_intent_id: null,
    stripe_charge_id: null,
    currency: parsed.data.projectCurrency.toLowerCase(),
    exponent: 2,
    customer_charge_minor: customerCharge,
    project_amount_minor: allocationProject,
    platform_tip_minor: allocationTip,
    oss_project_fee_minor: ossFee < 0n ? 0n : ossFee,
    stripe_application_fee_minor: applicationFee,
    status: 'pending',
    cadence: parsed.data.cadence,
    feature_mode: featureMode,
    settled_at: null,
  });

  const response = CheckoutIntentResponseSchema.parse({
    id: intent.intentId,
    client_secret: intent.clientSecret,
    checkout_url: intent.checkoutUrl,
    expires_at: intent.expiresAt,
    application_fee: {
      amount: intent.applicationFeeMinor,
      currency: intent.currency.toLowerCase(),
    },
    customer_charge: {
      amount: intent.customerChargeMinor,
      currency: intent.currency.toLowerCase(),
    },
    mode: intent.mode,
  });

  return json(response, { status: 201 });
};
