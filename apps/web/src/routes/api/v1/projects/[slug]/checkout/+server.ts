import { createHash } from 'node:crypto';
import { CheckoutIntentRequestSchema, CheckoutIntentResponseSchema } from '@oss-tips/api-contracts';
import { createProjectsRepository, type Db } from '@oss-tips/db';
import {
  MIN_ONE_OFF_GBP_MINOR,
  MAX_ORDINARY_GBP_MINOR,
  currencyExponent,
  paymentReadiness,
  paymentsEnabled,
  type FeatureMode,
  uuidv7,
} from '@oss-tips/domain';
import {
  createCheckoutIntent,
  createStripeClient,
  paymentIdForIdempotencyKey,
} from '@oss-tips/payments';
import type { RequestHandler } from './$types';
import { auditRecord, readJsonValue } from '../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json, problem } from '$lib/server/http';
import {
  CheckoutIdempotencyConflictError,
  TierMemberCapReachedError,
  withTierCapacity,
  type TierCheckoutReservation,
} from './checkout-capacity';

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

function projectIdempotencyKey(projectId: string, key: string): string {
  const scoped = `${projectId}:${key}`;
  return scoped.length <= 255
    ? scoped
    : `${projectId}:${createHash('sha256').update(key).digest('hex')}`;
}

type CheckoutIntent = Awaited<ReturnType<typeof createCheckoutIntent>>;

class ProjectNotAcceptingCheckoutError extends Error {}

export const POST: RequestHandler = async ({ locals, params, request, url }) => {
  if (!hasDatabaseUrl()) {
    return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  }

  const slug = params.slug;
  if (!slug) {
    return problem(400, 'Missing project slug');
  }

  const body = await readJsonValue(request);
  if (body instanceof Response) return body;

  const parsed = CheckoutIntentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return problem(400, 'Invalid checkout request', parsed.error.message);
  }
  if (parsed.data.cadence !== 'one_off') {
    if (!locals.session) {
      return problem(401, 'Authentication required', 'Sign in before starting recurring support');
    }
    if (!locals.session.user.emailVerified) {
      return problem(
        403,
        'Verified account required',
        'Verify your sign-in email before starting recurring support',
      );
    }
  }

  const db = getDb();
  const ctx = await loadCheckoutContext(db, slug);
  if (!ctx) {
    return problem(404, 'Project not found');
  }

  const connected = ctx.connected;
  const readiness = paymentReadiness({
    connectedAccountId: connected?.stripe_account_id,
    chargesEnabled: connected?.charges_enabled,
    payoutsEnabled: connected?.payouts_enabled,
    capabilities: connected?.capabilities,
  });
  if (!connected || !paymentsEnabled(readiness)) {
    return problem(409, 'Payments not ready', 'Connected account cannot accept charges yet');
  }
  if (ctx.project.status !== 'published') {
    return problem(
      409,
      'Project not accepting support',
      'Project must be published before checkout',
    );
  }

  const idempotencyKey = request.headers.get('idempotency-key')?.trim();
  if (!idempotencyKey || idempotencyKey.length > 255 || /[\r\n]/.test(idempotencyKey)) {
    return problem(
      400,
      'Idempotency key required',
      'Checkout requests must include a valid Idempotency-Key',
    );
  }
  const scopedIdempotencyKey = projectIdempotencyKey(ctx.project.id, idempotencyKey);

  const currency = parsed.data.projectCurrency.toLowerCase();
  if (currency !== ctx.project.default_currency.toLowerCase()) {
    return problem(
      400,
      'Unsupported checkout currency',
      `Use ${ctx.project.default_currency.toLowerCase()} for this project`,
    );
  }

  let stripePriceId: string | undefined;
  let authoritativePrice:
    { amountMinor: number | bigint; currency: string; cadence: 'monthly' | 'annual' } | undefined;
  if (parsed.data.tierId) {
    const tierPrice = await db
      .selectFrom('tier_price')
      .innerJoin('tier', 'tier.id', 'tier_price.tier_id')
      .leftJoin('stripe_price_binding', 'stripe_price_binding.tier_price_id', 'tier_price.id')
      .select([
        'tier_price.amount_minor',
        'tier_price.currency',
        'tier_price.cadence',
        'tier_price.is_active',
        'stripe_price_binding.stripe_price_id',
      ])
      .where('tier_price.tier_id', '=', parsed.data.tierId)
      .where('tier.project_id', '=', ctx.project.id)
      .where('tier.is_active', '=', true)
      .where('tier_price.cadence', '=', parsed.data.cadence)
      .where('tier_price.currency', '=', currency)
      .where('tier_price.is_active', '=', true)
      .executeTakeFirst();
    if (!tierPrice || String(tierPrice.amount_minor) !== String(parsed.data.projectAmountMinor)) {
      return problem(400, 'Invalid tier amount', 'Amount must match the selected project tier');
    }
    stripePriceId = tierPrice.stripe_price_id ?? undefined;
    if (parsed.data.cadence !== 'one_off' && !stripePriceId) {
      return problem(409, 'Tier unavailable', 'Selected recurring tier is not connected to Stripe');
    }
    if (parsed.data.cadence !== 'one_off') {
      authoritativePrice = {
        amountMinor: BigInt(String(tierPrice.amount_minor)),
        currency: tierPrice.currency,
        cadence: parsed.data.cadence,
      };
    }
  } else if (
    currency === 'gbp' &&
    (BigInt(parsed.data.projectAmountMinor) < MIN_ONE_OFF_GBP_MINOR ||
      BigInt(parsed.data.projectAmountMinor) > MAX_ORDINARY_GBP_MINOR)
  ) {
    return problem(400, 'Invalid support amount', 'One-off support must be between £2 and £5,000');
  }

  const paymentId = paymentIdForIdempotencyKey(scopedIdempotencyKey);
  const existingPayment = await db
    .selectFrom('payment')
    .select([
      'project_id',
      'user_id',
      'currency',
      'project_amount_minor',
      'platform_tip_minor',
      'cadence',
      'public_show_name',
      'public_show_amount',
      'public_show_message',
      'public_display_name',
      'public_message',
      'receipt_email',
    ])
    .where('id', '=', paymentId)
    .executeTakeFirst();
  const existingIntent = await db
    .selectFrom('checkout_intent')
    .select([
      'project_id',
      'user_id',
      'currency',
      'project_amount_minor',
      'platform_tip_minor',
      'tier_id',
      'cadence',
      'public_show_name',
      'public_show_amount',
      'public_show_message',
    ])
    .where('id', '=', paymentId)
    .executeTakeFirst();
  if (
    (existingPayment &&
      (existingPayment.project_id !== ctx.project.id ||
        (parsed.data.cadence !== 'one_off' &&
          existingPayment.user_id !== (locals.session?.user.id ?? null)) ||
        existingPayment.currency.toLowerCase() !== currency ||
        String(existingPayment.project_amount_minor) !== String(parsed.data.projectAmountMinor) ||
        String(existingPayment.platform_tip_minor) !== String(parsed.data.platformTipMinor) ||
        existingPayment.cadence !== parsed.data.cadence ||
        existingPayment.public_show_name !== parsed.data.publicOptions.showName ||
        existingPayment.public_show_amount !== parsed.data.publicOptions.showAmount ||
        existingPayment.public_show_message !== parsed.data.publicOptions.showMessage ||
        existingPayment.public_display_name !==
          (parsed.data.publicOptions.displayName?.trim() ?? null) ||
        existingPayment.public_message !== (parsed.data.publicOptions.message?.trim() ?? null) ||
        existingPayment.receipt_email !==
          (parsed.data.receiptEmail?.trim().toLowerCase() ?? null))) ||
    (existingIntent &&
      (existingIntent.project_id !== ctx.project.id ||
        (parsed.data.cadence !== 'one_off' &&
          existingIntent.user_id !== (locals.session?.user.id ?? null)) ||
        existingIntent.currency.toLowerCase() !== currency ||
        String(existingIntent.project_amount_minor) !== String(parsed.data.projectAmountMinor) ||
        String(existingIntent.platform_tip_minor) !== String(parsed.data.platformTipMinor) ||
        existingIntent.tier_id !== (parsed.data.tierId ?? null) ||
        existingIntent.cadence !== parsed.data.cadence ||
        existingIntent.public_show_name !== parsed.data.publicOptions.showName ||
        existingIntent.public_show_amount !== parsed.data.publicOptions.showAmount ||
        existingIntent.public_show_message !== parsed.data.publicOptions.showMessage))
  ) {
    return problem(409, 'Idempotency key already used', 'Retry with the original checkout values');
  }
  const appUrl = process.env.PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`;
  const featureMode = toFeatureMode(ctx.feature?.mode);
  const capacityTierId = existingPayment || existingIntent ? undefined : parsed.data.tierId;
  const reservation =
    capacityTierId && parsed.data.cadence !== 'one_off'
      ? {
          id: paymentId,
          projectId: ctx.project.id,
          userId: locals.session?.user.id ?? null,
          currency,
          projectAmountMinor: BigInt(parsed.data.projectAmountMinor),
          platformTipMinor: BigInt(parsed.data.platformTipMinor),
          tierId: capacityTierId,
          cadence: parsed.data.cadence,
          publicShowName: parsed.data.publicOptions.showName,
          publicShowAmount: parsed.data.publicOptions.showAmount,
          publicShowMessage: parsed.data.publicOptions.showMessage,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        }
      : undefined;

  const persistCheckout = async (trx: Db, checkoutIntent: CheckoutIntent) => {
    const project = await trx
      .selectFrom('project')
      .select('status')
      .where('id', '=', ctx.project.id)
      .forUpdate()
      .executeTakeFirst();
    if (!project || project.status !== 'published') {
      throw new ProjectNotAcceptingCheckoutError();
    }

    if (reservation) {
      const existingCheckout = await trx
        .selectFrom('payment')
        .innerJoin('checkout_intent', 'checkout_intent.id', 'payment.id')
        .select('payment.id')
        .where('payment.id', '=', paymentId)
        .executeTakeFirst();
      if (existingCheckout) return;
    }

    const allocationProject = BigInt(parsed.data.projectAmountMinor);
    const allocationTip = BigInt(parsed.data.platformTipMinor);
    const customerCharge = BigInt(checkoutIntent.customerChargeMinor);
    const applicationFee = BigInt(checkoutIntent.applicationFeeMinor);
    const ossFee = applicationFee - allocationTip;

    await trx
      .insertInto('payment')
      .values({
        id: paymentId,
        project_id: ctx.project.id,
        user_id: locals.session?.user.id ?? null,
        stripe_account_id: connected.stripe_account_id,
        stripe_payment_intent_id: null,
        stripe_charge_id: null,
        stripe_application_fee_id: null,
        currency,
        exponent: currencyExponent(currency),
        customer_charge_minor: customerCharge,
        project_amount_minor: allocationProject,
        platform_tip_minor: allocationTip,
        oss_project_fee_minor: ossFee < 0n ? 0n : ossFee,
        stripe_application_fee_minor: applicationFee,
        status: 'pending',
        cadence: parsed.data.cadence,
        feature_mode: featureMode,
        public_show_name: parsed.data.publicOptions.showName,
        public_show_amount: parsed.data.publicOptions.showAmount,
        public_show_message: parsed.data.publicOptions.showMessage,
        public_display_name: parsed.data.publicOptions.displayName?.trim() ?? null,
        public_message: parsed.data.publicOptions.message?.trim() ?? null,
        receipt_email: parsed.data.receiptEmail?.trim().toLowerCase() ?? null,
        settled_at: null,
      })
      .execute();

    await trx
      .insertInto('checkout_intent')
      .values({
        id: paymentId,
        project_id: ctx.project.id,
        user_id: locals.session?.user.id ?? null,
        stripe_checkout_session_id: null,
        currency,
        project_amount_minor: allocationProject,
        platform_tip_minor: allocationTip,
        tier_id: parsed.data.tierId ?? null,
        cadence: parsed.data.cadence,
        public_show_name: parsed.data.publicOptions.showName,
        public_show_amount: parsed.data.publicOptions.showAmount,
        public_show_message: parsed.data.publicOptions.showMessage,
        expires_at: new Date(checkoutIntent.expiresAt),
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          project_id: ctx.project.id,
          user_id: locals.session?.user.id ?? null,
          currency,
          project_amount_minor: allocationProject,
          platform_tip_minor: allocationTip,
          tier_id: parsed.data.tierId ?? null,
          cadence: parsed.data.cadence,
          public_show_name: parsed.data.publicOptions.showName,
          public_show_amount: parsed.data.publicOptions.showAmount,
          public_show_message: parsed.data.publicOptions.showMessage,
          expires_at: new Date(checkoutIntent.expiresAt),
        }),
      )
      .execute();

    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          { request, url, locals },
          locals.session?.user.id
            ? { type: 'user', userId: locals.session.user.id }
            : { type: 'user' },
          {
            action: 'support.checkout_intent_created',
            resourceType: 'payment',
            resourceId: paymentId,
            projectId: ctx.project.id,
            metadata: {
              cadence: parsed.data.cadence,
              currency,
              project_amount_minor: allocationProject.toString(),
              platform_tip_minor: allocationTip.toString(),
            },
          },
        ),
      )
      .execute();
    await trx
      .insertInto('outbox_event')
      .values({
        id: uuidv7(),
        aggregate_type: 'payment',
        aggregate_id: paymentId,
        event_type: 'support.processing',
        payload: { project_id: ctx.project.id, payment_id: paymentId },
        published_at: null,
      })
      .execute();
  };

  const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY);
  let intent: CheckoutIntent;
  try {
    intent = await withTierCapacity(
      db,
      ctx.project.id,
      capacityTierId,
      parsed.data.cadence,
      reservation,
      () =>
        createCheckoutIntent(
          stripe,
          {
            project: slug,
            tierId: parsed.data.tierId,
            projectAmountMinor: parsed.data.projectAmountMinor,
            projectCurrency: currency,
            platformTipMinor: parsed.data.platformTipMinor,
            cadence: parsed.data.cadence,
            publicOptions: parsed.data.publicOptions,
          },
          {
            projectId: ctx.project.id,
            paymentId,
            idempotencyKey: scopedIdempotencyKey,
            stripeAccountId: connected.stripe_account_id,
            featureMode,
            ...(locals.session?.user.id ? { userId: locals.session.user.id } : {}),
            stripePriceId,
            customerEmail: parsed.data.receiptEmail,
            capabilities: {
              cardPayments: readiness.requiredCapabilitiesActive,
              cryptoPayments: readiness.cryptoPaymentsActive,
              chargesEnabled: readiness.chargesEnabled,
              payoutsEnabled: readiness.payoutsEnabled,
            },
            ...(authoritativePrice ? { authoritativePrice } : {}),
            limits: {
              minimumProjectAmountMinor:
                ctx.project.min_support_minor !== null &&
                ctx.project.min_support_minor !== undefined
                  ? BigInt(String(ctx.project.min_support_minor))
                  : currency === 'gbp' && parsed.data.cadence === 'one_off'
                    ? MIN_ONE_OFF_GBP_MINOR
                    : 0,
              maximumProjectAmountMinor:
                ctx.project.max_support_minor !== null &&
                ctx.project.max_support_minor !== undefined
                  ? BigInt(String(ctx.project.max_support_minor))
                  : currency === 'gbp'
                    ? MAX_ORDINARY_GBP_MINOR
                    : undefined,
            },
            successUrl: `${appUrl.replace(/\/$/, '')}/checkout/success?payment_id=${paymentId}`,
            cancelUrl: `${appUrl.replace(/\/$/, '')}/${slug}/support`,
          },
        ),
      reservation ? persistCheckout : undefined,
    );
  } catch (error) {
    if (error instanceof TierMemberCapReachedError) {
      return problem(409, 'Tier unavailable', error.message);
    }
    if (error instanceof CheckoutIdempotencyConflictError) {
      return problem(
        409,
        'Idempotency key already used',
        'Retry with the original checkout values',
      );
    }
    return problem(400, 'Checkout unavailable', 'Unable to create checkout session');
  }

  if (!reservation) {
    try {
      await db.transaction().execute((trx) => persistCheckout(trx, intent));
    } catch (error) {
      if (error instanceof ProjectNotAcceptingCheckoutError) {
        return problem(400, 'Checkout unavailable', 'Unable to create checkout session');
      }
      const [payment, checkoutIntent] = await Promise.all([
        db.selectFrom('payment').select('id').where('id', '=', paymentId).executeTakeFirst(),
        db
          .selectFrom('checkout_intent')
          .select('id')
          .where('id', '=', paymentId)
          .executeTakeFirst(),
      ]);
      if (!payment || !checkoutIntent) throw new Error('Unable to save checkout payment');
    }
  }

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

  return json(response, {
    status: 201,
    headers: { 'cache-control': 'no-store' },
  });
};
