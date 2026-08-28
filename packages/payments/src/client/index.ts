import { MockStripeClient } from './mock-stripe-client.js';
import { RealStripeClient } from './stripe-client.js';
import type { StripeClient } from './types.js';

export type { StripeClient, CheckoutSession, CreateCheckoutSessionParams } from './types.js';
export { MockStripeClient } from './mock-stripe-client.js';
export { RealStripeClient } from './stripe-client.js';

export function createStripeClient(secretKey?: string): StripeClient {
  if (secretKey && secretKey.length > 0) {
    return new RealStripeClient(secretKey);
  }
  return new MockStripeClient();
}
