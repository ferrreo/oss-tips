import { MockStripeClient } from './mock-stripe-client.js';
import { RealStripeClient } from './stripe-client.js';
import type { StripeClient } from './types.js';
import { validateStripeSecretKey } from '../validation.js';

export type {
  StripeClient,
  CheckoutSession,
  ConnectedAccount,
  ConnectedAccountLink,
  ConnectedAccountSession,
  CreateCustomerPortalSessionParams,
  CustomerPortalSession,
  StripeSubscriptionTipUpdate,
  CreateConnectedAccountLinkParams,
  CreateConnectedAccountParams,
  CreateConnectedAccountSessionParams,
  CreateCheckoutSessionParams,
  CreateApplicationFeeRefundParams,
  CreateRefundParams,
  FinalizeInvoiceParams,
  ListBalanceTransactionsParams,
  ListPlatformBalanceTransactionsParams,
  ListStripeEventsParams,
  StripeBalanceTransaction,
  StripeApplicationFeeRefund,
  StripeInvoice,
  StripeProviderEvent,
  StripeRefund,
  UpdateInvoiceApplicationFeeParams,
  UpdateSubscriptionTipParams,
} from './types.js';
export { MockStripeClient } from './mock-stripe-client.js';
export { RealStripeClient } from './stripe-client.js';

export function createStripeClient(
  secretKey?: string,
  env: NodeJS.ProcessEnv = process.env,
): StripeClient {
  if (secretKey === undefined || (typeof secretKey === 'string' && secretKey.trim().length === 0)) {
    if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
      throw new Error(
        'STRIPE_SECRET_KEY is required; mock mode is only allowed in local development or tests',
      );
    }
    return new MockStripeClient();
  }
  return new RealStripeClient(validateStripeSecretKey(secretKey));
}
