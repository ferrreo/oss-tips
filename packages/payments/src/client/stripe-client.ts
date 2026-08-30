import Stripe from 'stripe';
import type {
  CheckoutSession,
  ConnectedAccount,
  ConnectedAccountLink,
  ConnectedAccountSession,
  CustomerPortalSession,
  CreateApplicationFeeRefundParams,
  CreateConnectedAccountLinkParams,
  CreateConnectedAccountParams,
  CreateConnectedAccountSessionParams,
  CreateCustomerPortalSessionParams,
  CreateCheckoutSessionParams,
  CreateRefundParams,
  FinalizeInvoiceParams,
  ListBalanceTransactionsParams,
  ListPlatformBalanceTransactionsParams,
  ListStripeEventsParams,
  StripeClient,
  StripeBalanceTransaction,
  StripeApplicationFeeRefund,
  StripeInvoice,
  StripeProviderEvent,
  StripeRefund,
  StripeSubscriptionTipUpdate,
  UpdateInvoiceApplicationFeeParams,
  UpdateSubscriptionTipParams,
} from './types.js';
import {
  deriveIdempotencyKey,
  minorUnits,
  normalizeCurrency,
  validateIdentifier,
  validateIdempotencyKey,
  validateStripeSecretKey,
  validateUrl,
} from '../validation.js';
import { validateConnectedAccountInput, validateConnectedAccountLinkInput } from '../connect.js';

const MAX_STRIPE_MINOR = BigInt(Number.MAX_SAFE_INTEGER);
const PLATFORM_TIP_COMPONENT = 'platform_tip';
const PLATFORM_TIP_PRODUCT_NAME = 'oss.tips tip';

function stripeMinor(value: unknown, name: string, allowZero = true): number {
  const minor = minorUnits(value, name, allowZero);
  if (minor > MAX_STRIPE_MINOR) throw new Error(`${name} exceeds supported minor-unit range`);
  return Number(minor);
}

function stripeSignedMinor(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(`${name} must be a safe integer in minor units`);
  }
  if (Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    throw new Error(`${name} exceeds supported minor-unit range`);
  }
  return value;
}

function stripeProductId(product: unknown): string | null {
  if (typeof product === 'string') return product;
  if (product && typeof product === 'object' && 'id' in product && typeof product.id === 'string') {
    return product.id;
  }
  return null;
}

function isPlatformTipItem(item: Stripe.SubscriptionItem): boolean {
  const itemMetadata = item.metadata as Record<string, string> | undefined;
  if (itemMetadata?.oss_tips_component === PLATFORM_TIP_COMPONENT) return true;
  const price = item.price;
  if (!price || typeof price === 'string') return false;
  const product = price.product;
  if (!product || typeof product === 'string') return false;
  const metadata =
    'metadata' in product ? (product.metadata as Record<string, string> | undefined) : undefined;
  return (
    metadata?.oss_tips_component === PLATFORM_TIP_COMPONENT ||
    ('name' in product && product.name === PLATFORM_TIP_PRODUCT_NAME)
  );
}

function platformTipItemAmount(item: Stripe.SubscriptionItem): number {
  const price = item.price;
  if (!price || typeof price === 'string') throw new Error('Stripe tip price is unavailable');
  if (item.quantity !== undefined && item.quantity !== 1) {
    throw new Error('Stripe tip quantity is invalid');
  }
  return stripeMinor(price.unit_amount, 'Stripe recurring tip');
}

export class RealStripeClient implements StripeClient {
  private readonly stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(validateStripeSecretKey(secretKey), {
      apiVersion: '2026-08-26.dahlia',
    });
  }

  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSession> {
    if (params.mode !== 'payment' && params.mode !== 'subscription') {
      throw new Error('Checkout mode is invalid');
    }
    if (params.uiMode !== undefined && params.uiMode !== 'hosted' && params.uiMode !== 'embedded') {
      throw new Error('Checkout UI mode is invalid');
    }
    if (typeof params.enableCrypto !== 'boolean') {
      throw new Error('Crypto capability flag is invalid');
    }
    validateIdentifier(params.stripeAccountId, 'Stripe account id', 'acct_');
    const currency = normalizeCurrency(params.currency);
    const amountMinor = stripeMinor(params.amountMinor, 'Checkout amount', false);
    const applicationFeeMinor = stripeMinor(params.applicationFeeMinor, 'Application fee');
    if (applicationFeeMinor > amountMinor) {
      throw new Error('Application fee exceeds checkout amount');
    }
    if (params.idempotencyKey !== undefined) validateIdempotencyKey(params.idempotencyKey);
    if (params.adaptivePricing !== undefined && typeof params.adaptivePricing !== 'boolean') {
      throw new Error('Adaptive pricing option is invalid');
    }
    if (
      params.cadence !== undefined &&
      !['one_off', 'monthly', 'annual'].includes(params.cadence)
    ) {
      throw new Error('Cadence is invalid');
    }
    if (
      (params.mode === 'payment' && params.cadence !== undefined && params.cadence !== 'one_off') ||
      (params.mode === 'subscription' && params.cadence === 'one_off')
    ) {
      throw new Error('Checkout mode and cadence do not match');
    }
    let recurringTipMinor: number | undefined;
    if (params.recurringTipMinor !== undefined) {
      recurringTipMinor = stripeMinor(params.recurringTipMinor, 'Recurring tip');
    }
    if (params.recurringTipPriceId !== undefined) {
      validateIdentifier(params.recurringTipPriceId, 'Recurring tip price id', 'price_');
    }
    if (params.mode === 'subscription') {
      validateIdentifier(params.stripePriceId, 'Stripe price id', 'price_');
    }
    const base: Stripe.Checkout.SessionCreateParams = {
      mode: params.mode,
      metadata: params.metadata,
      ...(params.adaptivePricing === false ? {} : { adaptive_pricing: { enabled: true } }),
      ...(params.enableCrypto ? {} : { excluded_payment_method_types: ['crypto'] }),
    };

    // Omit payment_method_types so Stripe can select methods dynamically from account,
    // currency, amount and capability. `enableCrypto` is capability-gated by the caller.
    if (params.uiMode === 'embedded') {
      const returnUrl = validateUrl(params.returnUrl, 'Return URL');
      base.ui_mode = 'embedded';
      base.return_url = returnUrl;
    } else {
      base.success_url = validateUrl(params.successUrl, 'Success URL');
      base.cancel_url = validateUrl(params.cancelUrl, 'Cancel URL');
    }

    if (params.mode === 'payment') {
      base.payment_intent_data = {
        ...(applicationFeeMinor > 0 ? { application_fee_amount: applicationFeeMinor } : {}),
        metadata: params.metadata,
      };
    } else {
      base.subscription_data = {
        metadata: params.metadata,
      };
    }

    if (params.customerEmail) {
      base.customer_email = params.customerEmail;
    }

    if (params.mode === 'payment') {
      base.line_items = [
        {
          price_data: {
            currency,
            unit_amount: amountMinor,
            product_data: { name: 'Support' },
          },
          quantity: 1,
        },
      ];
    } else if (params.stripePriceId) {
      base.line_items = [{ price: params.stripePriceId, quantity: 1 }];
      if (recurringTipMinor && recurringTipMinor > 0) {
        const interval = params.cadence === 'annual' ? 'year' : 'month';
        base.line_items.push({
          ...(params.recurringTipPriceId
            ? { price: params.recurringTipPriceId }
            : {
                price_data: {
                  currency,
                  unit_amount: recurringTipMinor,
                  recurring: { interval },
                  product_data: {
                    name: PLATFORM_TIP_PRODUCT_NAME,
                    metadata: { oss_tips_component: PLATFORM_TIP_COMPONENT },
                  },
                },
              }),
          quantity: 1,
        });
      }
    } else {
      throw new Error('stripePriceId required for subscription checkout');
    }

    const session = await this.stripe.checkout.sessions.create(base, {
      stripeAccount: params.stripeAccountId,
      ...(params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : {}),
    });

    return {
      id: session.id,
      clientSecret: session.client_secret ?? null,
      url: session.url ?? null,
    };
  }

  async updateSubscriptionTip(
    params: UpdateSubscriptionTipParams,
  ): Promise<StripeSubscriptionTipUpdate> {
    validateIdentifier(params.stripeAccountId, 'Stripe account id', 'acct_');
    validateIdentifier(params.subscriptionId, 'Stripe subscription id', 'sub_');
    const currency = normalizeCurrency(params.currency);
    const currentTipMinor = stripeMinor(params.currentTipMinor, 'Current recurring tip');
    const platformTipMinor = stripeMinor(params.platformTipMinor, 'Recurring tip');
    if (params.cadence !== 'monthly' && params.cadence !== 'annual') {
      throw new Error('Subscription cadence is invalid');
    }
    if (params.idempotencyKey !== undefined) validateIdempotencyKey(params.idempotencyKey);
    if (currentTipMinor === platformTipMinor) {
      return { subscriptionId: params.subscriptionId, platformTipMinor };
    }

    const accountOptions = { stripeAccount: params.stripeAccountId };
    const subscription = await this.stripe.subscriptions.retrieve(
      params.subscriptionId,
      { expand: ['items.data.price.product'] },
      accountOptions,
    );
    const tipItems = subscription.items.data.filter(isPlatformTipItem);
    if (tipItems.length > 1) throw new Error('Stripe subscription has multiple tip items');
    const tipItem = tipItems[0];
    if (tipItem) {
      const price = tipItem.price;
      if (!price || typeof price === 'string') {
        throw new Error('Stripe tip price is unavailable');
      }
      if (price.currency.toLowerCase() !== currency) {
        throw new Error('Stripe tip currency does not match membership');
      }
      const interval = params.cadence === 'annual' ? 'year' : 'month';
      if (price.recurring?.interval !== interval) {
        throw new Error('Stripe tip cadence does not match membership');
      }
      const providerTipMinor = platformTipItemAmount(tipItem);
      if (providerTipMinor !== currentTipMinor && providerTipMinor !== platformTipMinor) {
        throw new Error('Stripe subscription tip does not match stored membership');
      }
      if (
        providerTipMinor === platformTipMinor &&
        subscription.metadata?.platform_tip_minor === String(platformTipMinor)
      ) {
        return { subscriptionId: params.subscriptionId, platformTipMinor };
      }
    } else {
      if (
        platformTipMinor === 0 &&
        subscription.metadata?.platform_tip_minor === String(platformTipMinor)
      ) {
        return { subscriptionId: params.subscriptionId, platformTipMinor };
      }
      if (currentTipMinor !== 0) {
        throw new Error('Stripe subscription tip does not match stored membership');
      }
    }

    let productId = tipItem ? stripeProductId(tipItem.price.product) : null;
    if (platformTipMinor > 0 && !productId) {
      const product = await this.stripe.products.create(
        {
          name: PLATFORM_TIP_PRODUCT_NAME,
          metadata: { oss_tips_component: PLATFORM_TIP_COMPONENT },
        },
        {
          ...accountOptions,
          ...(params.idempotencyKey
            ? { idempotencyKey: deriveIdempotencyKey(params.idempotencyKey, 'tip-product') }
            : {}),
        },
      );
      productId = product.id;
    }

    const items: Stripe.SubscriptionUpdateParams.Item[] =
      platformTipMinor === 0
        ? tipItem
          ? [{ id: tipItem.id, deleted: true }]
          : []
        : [
            {
              ...(tipItem ? { id: tipItem.id } : {}),
              metadata: { oss_tips_component: PLATFORM_TIP_COMPONENT },
              price_data: {
                currency,
                product: productId as string,
                recurring: { interval: params.cadence === 'annual' ? 'year' : 'month' },
                unit_amount: platformTipMinor,
              },
              quantity: 1,
            },
          ];
    await this.stripe.subscriptions.update(
      params.subscriptionId,
      {
        ...(items.length ? { items, proration_behavior: 'none' as const } : {}),
        metadata: { platform_tip_minor: String(platformTipMinor) },
      },
      {
        ...accountOptions,
        ...(params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : {}),
      },
    );
    return { subscriptionId: params.subscriptionId, platformTipMinor };
  }

  async createRefund(params: CreateRefundParams): Promise<StripeRefund> {
    validateIdentifier(params.stripeAccountId, 'Stripe account id', 'acct_');
    validateIdentifier(params.chargeId, 'Charge id', 'ch_');
    const amountMinor = stripeMinor(params.amountMinor, 'Refund amount', false);
    const refundApplicationFeeMinor = stripeMinor(
      params.refundApplicationFeeMinor,
      'Application fee refund',
    );
    if (
      typeof params.reason !== 'string' ||
      params.reason.trim().length === 0 ||
      params.reason.length > 500 ||
      /[\r\n]/.test(params.reason)
    ) {
      throw new Error('Refund reason is invalid');
    }
    if (
      params.refundApplicationFee !== undefined &&
      typeof params.refundApplicationFee !== 'boolean'
    ) {
      throw new Error('Application fee refund option is invalid');
    }
    if (params.idempotencyKey !== undefined) validateIdempotencyKey(params.idempotencyKey);
    if (
      params.providerReason !== undefined &&
      !['duplicate', 'fraudulent', 'requested_by_customer'].includes(params.providerReason)
    ) {
      throw new Error('Provider refund reason is invalid');
    }
    const refund = await this.stripe.refunds.create(
      {
        charge: params.chargeId,
        amount: amountMinor,
        refund_application_fee: params.refundApplicationFee ?? refundApplicationFeeMinor > 0,
        reason: params.providerReason ?? 'requested_by_customer',
        metadata: { reason: params.reason },
      },
      {
        stripeAccount: params.stripeAccountId,
        ...(params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : {}),
      },
    );

    const status =
      refund.status === 'succeeded'
        ? 'succeeded'
        : refund.status === 'failed' || refund.status === 'canceled'
          ? 'failed'
          : 'pending';

    return {
      id: refund.id,
      status,
      amountMinor: refund.amount ?? amountMinor,
    };
  }

  async listBalanceTransactions(
    params: ListBalanceTransactionsParams,
  ): Promise<StripeBalanceTransaction[]> {
    validateIdentifier(params.stripeAccountId, 'Stripe account id', 'acct_');
    const currency = normalizeCurrency(params.currency);
    const start = params.periodStart.getTime();
    const end = params.periodEnd.getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
      throw new Error('Balance transaction period is invalid');
    }

    const rows = await this.stripe.balanceTransactions
      .list(
        {
          created: { gte: Math.floor(start / 1_000), lt: Math.floor(end / 1_000) },
          currency,
          limit: 100,
        },
        { stripeAccount: params.stripeAccountId },
      )
      .autoPagingToArray({ limit: 100_000 });

    return rows.map((row) => {
      const source = row.source;
      const sourceId =
        typeof source === 'string'
          ? source
          : source && typeof source === 'object' && 'id' in source && typeof source.id === 'string'
            ? source.id
            : null;
      return {
        id: row.id,
        stripeAccountId: params.stripeAccountId,
        currency: row.currency.toLowerCase(),
        amountMinor: stripeSignedMinor(row.amount, 'Balance transaction amount'),
        feeMinor: stripeMinor(row.fee, 'Balance transaction fee'),
        netMinor: stripeSignedMinor(row.net, 'Balance transaction net'),
        type: row.type,
        sourceId,
        createdAt: new Date(row.created * 1_000),
        availableOn: row.available_on ? new Date(row.available_on * 1_000) : null,
      };
    });
  }

  async listPlatformBalanceTransactions(
    params: ListPlatformBalanceTransactionsParams,
  ): Promise<StripeBalanceTransaction[]> {
    const currency = normalizeCurrency(params.currency);
    const start = params.periodStart.getTime();
    const end = params.periodEnd.getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
      throw new Error('Balance transaction period is invalid');
    }

    const rows = await this.stripe.balanceTransactions
      .list({
        created: { gte: Math.floor(start / 1_000), lt: Math.floor(end / 1_000) },
        currency,
        limit: 100,
      })
      .autoPagingToArray({ limit: 100_000 });

    return rows.map((row) => {
      const source = row.source;
      const sourceId =
        typeof source === 'string'
          ? source
          : source && typeof source === 'object' && 'id' in source && typeof source.id === 'string'
            ? source.id
            : null;
      return {
        id: row.id,
        stripeAccountId: 'platform',
        currency: row.currency.toLowerCase(),
        amountMinor: stripeSignedMinor(row.amount, 'Balance transaction amount'),
        feeMinor: stripeMinor(row.fee, 'Balance transaction fee'),
        netMinor: stripeSignedMinor(row.net, 'Balance transaction net'),
        type: row.type,
        sourceId,
        createdAt: new Date(row.created * 1_000),
        availableOn: row.available_on ? new Date(row.available_on * 1_000) : null,
      };
    });
  }

  async listEvents(params: ListStripeEventsParams): Promise<StripeProviderEvent[]> {
    if (params.stripeAccountId !== null) {
      validateIdentifier(params.stripeAccountId, 'Stripe account id', 'acct_');
    }
    const start = params.periodStart.getTime();
    const end = params.periodEnd.getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
      throw new Error('Stripe event period is invalid');
    }

    const rows = await this.stripe.events
      .list(
        {
          created: { gte: Math.floor(start / 1_000), lt: Math.floor(end / 1_000) },
          limit: 100,
        },
        params.stripeAccountId ? { stripeAccount: params.stripeAccountId } : undefined,
      )
      .autoPagingToArray({ limit: 100_000 });

    return rows.map((event) => {
      const object = event.data.object;
      const objectId =
        object && typeof object === 'object' && 'id' in object && typeof object.id === 'string'
          ? object.id
          : null;
      const eventAccount = typeof event.account === 'string' ? event.account : null;
      return {
        id: event.id,
        stripeAccountId: eventAccount ?? params.stripeAccountId,
        type: event.type,
        apiVersion: event.api_version ?? null,
        createdAt: new Date(event.created * 1_000),
        objectId,
        payload: event as unknown as Record<string, unknown>,
      };
    });
  }

  async updateInvoiceApplicationFee(
    params: UpdateInvoiceApplicationFeeParams,
  ): Promise<StripeInvoice> {
    validateIdentifier(params.stripeAccountId, 'Stripe account id', 'acct_');
    validateIdentifier(params.invoiceId, 'Invoice id', 'in_');
    const applicationFeeMinor = stripeMinor(params.applicationFeeMinor, 'Application fee');
    if (params.idempotencyKey !== undefined) validateIdempotencyKey(params.idempotencyKey);
    const invoice = await this.stripe.invoices.update(
      params.invoiceId,
      { application_fee_amount: applicationFeeMinor },
      {
        stripeAccount: params.stripeAccountId,
        ...(params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : {}),
      },
    );
    const invoiceData = invoice as unknown as {
      application_fee_amount?: number | null;
    };
    return {
      id: invoice.id,
      applicationFeeMinor: invoiceData.application_fee_amount ?? null,
      status: invoice.status,
    };
  }

  async finalizeInvoice(params: FinalizeInvoiceParams): Promise<StripeInvoice> {
    validateIdentifier(params.stripeAccountId, 'Stripe account id', 'acct_');
    validateIdentifier(params.invoiceId, 'Invoice id', 'in_');
    if (params.idempotencyKey !== undefined) validateIdempotencyKey(params.idempotencyKey);
    const invoice = await this.stripe.invoices.finalizeInvoice(
      params.invoiceId,
      {},
      {
        stripeAccount: params.stripeAccountId,
        ...(params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : {}),
      },
    );
    const invoiceData = invoice as unknown as {
      application_fee_amount?: number | null;
    };
    return {
      id: invoice.id,
      applicationFeeMinor: invoiceData.application_fee_amount ?? null,
      status: invoice.status,
    };
  }

  async createApplicationFeeRefund(
    params: CreateApplicationFeeRefundParams,
  ): Promise<StripeApplicationFeeRefund> {
    validateIdentifier(params.applicationFeeId, 'Application fee id', 'fee_');
    const amountMinor = stripeMinor(params.amountMinor, 'Application fee refund', false);
    if (params.idempotencyKey !== undefined) validateIdempotencyKey(params.idempotencyKey);
    const refund = await this.stripe.applicationFees.createRefund(
      params.applicationFeeId,
      {
        amount: amountMinor,
        ...(params.metadata ? { metadata: params.metadata } : {}),
      },
      params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined,
    );
    return { id: refund.id, amountMinor: refund.amount };
  }

  async createConnectedAccount(params: CreateConnectedAccountParams): Promise<ConnectedAccount> {
    validateConnectedAccountInput(params);
    const defaults = {
      ...(params.defaultCurrency ? { currency: params.defaultCurrency.toLowerCase() } : {}),
      responsibilities: { fees_collector: 'stripe' as const, losses_collector: 'stripe' as const },
    };
    const account = await this.stripe.v2.core.accounts.create(
      {
        dashboard: 'full',
        ...(params.displayName ? { display_name: params.displayName } : {}),
        ...(params.contactEmail ? { contact_email: params.contactEmail } : {}),
        defaults,
        ...(params.country ? { identity: { country: params.country.toUpperCase() } } : {}),
        configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
        ...(params.metadata ? { metadata: params.metadata } : {}),
      },
      params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined,
    );
    return { stripeAccountId: account.id };
  }

  async createConnectedAccountLink(
    params: CreateConnectedAccountLinkParams,
  ): Promise<ConnectedAccountLink> {
    validateConnectedAccountLinkInput(params);
    const link = await this.stripe.v2.core.accountLinks.create(
      {
        account: params.stripeAccountId,
        use_case: {
          type: 'account_onboarding',
          account_onboarding: {
            configurations: ['merchant'],
            refresh_url: params.refreshUrl,
            ...(params.returnUrl ? { return_url: params.returnUrl } : {}),
          },
        },
      },
      params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined,
    );
    return {
      stripeAccountId: params.stripeAccountId,
      url: link.url,
      expiresAt: link.expires_at,
    };
  }

  async createConnectedAccountSession(
    params: CreateConnectedAccountSessionParams,
  ): Promise<ConnectedAccountSession> {
    validateIdentifier(params.stripeAccountId, 'Stripe account id', 'acct_');
    if (params.idempotencyKey !== undefined) validateIdempotencyKey(params.idempotencyKey);
    const session = await this.stripe.accountSessions.create(
      {
        account: params.stripeAccountId,
        components: {
          account_onboarding: { enabled: true },
          account_management: { enabled: true },
        },
      },
      params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined,
    );
    return {
      stripeAccountId: params.stripeAccountId,
      clientSecret: session.client_secret,
      expiresAt: session.expires_at,
    };
  }

  async createCustomerPortalSession(
    params: CreateCustomerPortalSessionParams,
  ): Promise<CustomerPortalSession> {
    validateIdentifier(params.stripeAccountId, 'Stripe account id', 'acct_');
    validateIdentifier(params.customerId, 'Stripe customer id', 'cus_');
    const returnUrl = validateUrl(params.returnUrl, 'Customer portal return URL');
    if (params.idempotencyKey !== undefined) validateIdempotencyKey(params.idempotencyKey);
    const session = await this.stripe.billingPortal.sessions.create(
      { customer: params.customerId, return_url: returnUrl },
      {
        stripeAccount: params.stripeAccountId,
        ...(params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : {}),
      },
    );
    return { id: session.id, url: session.url };
  }
}
