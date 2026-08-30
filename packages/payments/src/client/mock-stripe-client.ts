import { randomBytes } from 'node:crypto';
import type {
  CreateApplicationFeeRefundParams,
  CheckoutSession,
  ConnectedAccount,
  ConnectedAccountLink,
  ConnectedAccountSession,
  CustomerPortalSession,
  CreateCheckoutSessionParams,
  CreateConnectedAccountLinkParams,
  CreateConnectedAccountParams,
  CreateConnectedAccountSessionParams,
  CreateCustomerPortalSessionParams,
  CreateRefundParams,
  FinalizeInvoiceParams,
  ListBalanceTransactionsParams,
  ListPlatformBalanceTransactionsParams,
  ListStripeEventsParams,
  StripeClient,
  StripeBalanceTransaction,
  StripeRefund,
  StripeApplicationFeeRefund,
  StripeInvoice,
  StripeProviderEvent,
  StripeSubscriptionTipUpdate,
  UpdateSubscriptionTipParams,
  UpdateInvoiceApplicationFeeParams,
} from './types.js';
import { validateConnectedAccountInput, validateConnectedAccountLinkInput } from '../connect.js';
import {
  minorUnits,
  normalizeCurrency,
  validateIdempotencyKey,
  validateIdentifier,
  validateUrl,
} from '../validation.js';

function fakeId(prefix: string): string {
  return `${prefix}_mock_${randomBytes(12).toString('hex')}`;
}

/** Local/dev Stripe client when STRIPE_SECRET_KEY is unset. Sessions always succeed. */
export class MockStripeClient implements StripeClient {
  readonly sessions: CreateCheckoutSessionParams[] = [];
  readonly refunds: CreateRefundParams[] = [];
  readonly invoiceUpdates: UpdateInvoiceApplicationFeeParams[] = [];
  readonly finalizedInvoices: FinalizeInvoiceParams[] = [];
  readonly applicationFeeRefunds: CreateApplicationFeeRefundParams[] = [];
  readonly connectedAccounts: CreateConnectedAccountParams[] = [];
  readonly connectedAccountLinks: CreateConnectedAccountLinkParams[] = [];
  readonly customerPortalSessions: CreateCustomerPortalSessionParams[] = [];
  readonly subscriptionTipUpdates: UpdateSubscriptionTipParams[] = [];
  readonly balanceTransactions: StripeBalanceTransaction[] = [];
  readonly platformBalanceTransactions: StripeBalanceTransaction[] = [];
  readonly events: StripeProviderEvent[] = [];
  balanceTransactionError: Error | null = null;
  platformBalanceTransactionError: Error | null = null;
  eventListError: Error | null = null;
  private readonly sessionResults = new Map<string, CheckoutSession>();
  private readonly refundResults = new Map<string, StripeRefund>();
  private readonly invoiceResults = new Map<string, StripeInvoice>();
  private readonly invoiceFees = new Map<string, number>();
  private readonly finalizedResults = new Map<string, StripeInvoice>();
  private readonly applicationFeeRefundResults = new Map<string, StripeApplicationFeeRefund>();
  private readonly connectedAccountResults = new Map<string, ConnectedAccount>();
  private readonly connectedAccountLinkResults = new Map<string, ConnectedAccountLink>();
  private readonly connectedAccountSessionResults = new Map<string, ConnectedAccountSession>();
  private readonly customerPortalSessionResults = new Map<string, CustomerPortalSession>();
  private readonly subscriptionTipUpdateResults = new Map<string, StripeSubscriptionTipUpdate>();

  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSession> {
    const existing = params.idempotencyKey
      ? this.sessionResults.get(params.idempotencyKey)
      : undefined;
    if (existing) return existing;
    this.sessions.push(params);
    const id = fakeId('cs');
    const result: CheckoutSession = {
      id,
      clientSecret: `${id}_secret_mock`,
      url: `https://checkout.stripe.mock/session/${id}`,
    };
    if (params.idempotencyKey) this.sessionResults.set(params.idempotencyKey, result);
    return result;
  }

  async createRefund(params: CreateRefundParams): Promise<StripeRefund> {
    const existing = params.idempotencyKey
      ? this.refundResults.get(params.idempotencyKey)
      : undefined;
    if (existing) return existing;
    this.refunds.push(params);
    const result: StripeRefund = {
      id: fakeId('re'),
      status: 'succeeded',
      amountMinor: params.amountMinor,
    };
    if (params.idempotencyKey) this.refundResults.set(params.idempotencyKey, result);
    return result;
  }

  async listBalanceTransactions(
    params: ListBalanceTransactionsParams,
  ): Promise<StripeBalanceTransaction[]> {
    if (this.balanceTransactionError) throw this.balanceTransactionError;
    return this.balanceTransactions
      .filter(
        (transaction) =>
          transaction.stripeAccountId === params.stripeAccountId &&
          transaction.currency.toLowerCase() === params.currency.toLowerCase() &&
          transaction.createdAt >= params.periodStart &&
          transaction.createdAt < params.periodEnd,
      )
      .map((transaction) => ({ ...transaction }));
  }

  async listPlatformBalanceTransactions(
    params: ListPlatformBalanceTransactionsParams,
  ): Promise<StripeBalanceTransaction[]> {
    if (this.platformBalanceTransactionError) throw this.platformBalanceTransactionError;
    const transactions = [
      ...this.platformBalanceTransactions,
      ...this.balanceTransactions.filter(
        (transaction) => transaction.stripeAccountId === 'platform',
      ),
    ];
    return transactions
      .filter(
        (transaction) =>
          transaction.currency.toLowerCase() === params.currency.toLowerCase() &&
          transaction.createdAt >= params.periodStart &&
          transaction.createdAt < params.periodEnd,
      )
      .filter(
        (transaction, index, rows) => rows.findIndex((row) => row.id === transaction.id) === index,
      )
      .map((transaction) => ({ ...transaction, stripeAccountId: 'platform' }));
  }

  async listEvents(params: ListStripeEventsParams): Promise<StripeProviderEvent[]> {
    if (this.eventListError) throw this.eventListError;
    return this.events
      .filter(
        (event) =>
          event.stripeAccountId === params.stripeAccountId &&
          event.createdAt >= params.periodStart &&
          event.createdAt < params.periodEnd,
      )
      .map((event) => ({ ...event }));
  }

  async updateInvoiceApplicationFee(
    params: UpdateInvoiceApplicationFeeParams,
  ): Promise<StripeInvoice> {
    const key = params.idempotencyKey ?? `${params.stripeAccountId}:${params.invoiceId}`;
    const existing = this.invoiceResults.get(key);
    if (existing) return existing;
    this.invoiceUpdates.push(params);
    this.invoiceFees.set(
      `${params.stripeAccountId}:${params.invoiceId}`,
      params.applicationFeeMinor,
    );
    const result = {
      id: params.invoiceId,
      applicationFeeMinor: params.applicationFeeMinor,
      status: 'draft',
    };
    this.invoiceResults.set(key, result);
    return result;
  }

  async finalizeInvoice(params: FinalizeInvoiceParams): Promise<StripeInvoice> {
    const key = params.idempotencyKey ?? `${params.stripeAccountId}:${params.invoiceId}`;
    const existing = this.finalizedResults.get(key);
    if (existing) return existing;
    this.finalizedInvoices.push(params);
    const result = {
      id: params.invoiceId,
      applicationFeeMinor:
        this.invoiceFees.get(`${params.stripeAccountId}:${params.invoiceId}`) ?? null,
      status: 'open',
    };
    this.finalizedResults.set(key, result);
    return result;
  }

  async createApplicationFeeRefund(
    params: CreateApplicationFeeRefundParams,
  ): Promise<StripeApplicationFeeRefund> {
    const existing = params.idempotencyKey
      ? this.applicationFeeRefundResults.get(params.idempotencyKey)
      : undefined;
    if (existing) return existing;
    this.applicationFeeRefunds.push(params);
    const result = { id: fakeId('fr'), amountMinor: params.amountMinor };
    if (params.idempotencyKey) this.applicationFeeRefundResults.set(params.idempotencyKey, result);
    return result;
  }

  async createConnectedAccount(params: CreateConnectedAccountParams): Promise<ConnectedAccount> {
    validateConnectedAccountInput(params);
    const key = params.idempotencyKey;
    if (key) {
      const existing = this.connectedAccountResults.get(key);
      if (existing) return existing;
    }
    this.connectedAccounts.push(params);
    const result = { stripeAccountId: `acct_mock_${randomBytes(8).toString('hex')}` };
    if (key) this.connectedAccountResults.set(key, result);
    return result;
  }

  async createConnectedAccountLink(
    params: CreateConnectedAccountLinkParams,
  ): Promise<ConnectedAccountLink> {
    validateConnectedAccountLinkInput(params);
    const key = params.idempotencyKey;
    if (key) {
      const existing = this.connectedAccountLinkResults.get(key);
      if (existing) return existing;
    }
    this.connectedAccountLinks.push(params);
    const result = {
      stripeAccountId: params.stripeAccountId,
      url: `https://connect.stripe.mock/onboarding/${params.stripeAccountId}`,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    };
    if (key) this.connectedAccountLinkResults.set(key, result);
    return result;
  }

  async createConnectedAccountSession(
    params: CreateConnectedAccountSessionParams,
  ): Promise<ConnectedAccountSession> {
    validateIdentifier(params.stripeAccountId, 'Stripe account id', 'acct_');
    if (params.idempotencyKey !== undefined) validateIdempotencyKey(params.idempotencyKey);
    const key = params.idempotencyKey;
    if (key) {
      const existing = this.connectedAccountSessionResults.get(key);
      if (existing) return existing;
    }
    const result = {
      stripeAccountId: params.stripeAccountId,
      clientSecret: `${fakeId('acs')}_secret_mock`,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
    if (key) this.connectedAccountSessionResults.set(key, result);
    return result;
  }

  async createCustomerPortalSession(
    params: CreateCustomerPortalSessionParams,
  ): Promise<CustomerPortalSession> {
    validateIdentifier(params.stripeAccountId, 'Stripe account id', 'acct_');
    validateIdentifier(params.customerId, 'Stripe customer id', 'cus_');
    validateUrl(params.returnUrl, 'Customer portal return URL');
    if (params.idempotencyKey !== undefined) validateIdempotencyKey(params.idempotencyKey);
    const key = params.idempotencyKey;
    if (key) {
      const existing = this.customerPortalSessionResults.get(key);
      if (existing) return existing;
    }
    this.customerPortalSessions.push(params);
    const result = {
      id: fakeId('bps'),
      url: `https://billing.stripe.mock/session/${params.customerId}`,
    };
    if (key) this.customerPortalSessionResults.set(key, result);
    return result;
  }

  async updateSubscriptionTip(
    params: UpdateSubscriptionTipParams,
  ): Promise<StripeSubscriptionTipUpdate> {
    validateIdentifier(params.stripeAccountId, 'Stripe account id', 'acct_');
    validateIdentifier(params.subscriptionId, 'Stripe subscription id', 'sub_');
    normalizeCurrency(params.currency);
    if (params.cadence !== 'monthly' && params.cadence !== 'annual') {
      throw new Error('Subscription cadence is invalid');
    }
    const currentTipMinor = minorUnits(params.currentTipMinor, 'Current recurring tip');
    const platformTipMinor = minorUnits(params.platformTipMinor, 'Recurring tip');
    if (platformTipMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('Recurring tip exceeds supported minor-unit range');
    }
    if (params.idempotencyKey !== undefined) validateIdempotencyKey(params.idempotencyKey);
    const key = params.idempotencyKey;
    if (key) {
      const existing = this.subscriptionTipUpdateResults.get(key);
      if (existing) return existing;
    }
    if (currentTipMinor === platformTipMinor) {
      return { subscriptionId: params.subscriptionId, platformTipMinor: Number(platformTipMinor) };
    }
    this.subscriptionTipUpdates.push(params);
    const result = {
      subscriptionId: params.subscriptionId,
      platformTipMinor: Number(platformTipMinor),
    };
    if (key) this.subscriptionTipUpdateResults.set(key, result);
    return result;
  }
}
