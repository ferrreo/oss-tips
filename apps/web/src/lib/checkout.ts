import type { CheckoutIntentRequest } from '@oss-tips/api-contracts';

type ProjectCheckoutInput = Omit<CheckoutIntentRequest, 'projectCurrency'> & {
  projectCurrency: string;
};

export async function createProjectCheckout(
  slug: string,
  input: ProjectCheckoutInput,
  fetcher: typeof fetch = fetch,
  fallback = 'Checkout is unavailable right now.',
): Promise<string> {
  let response: Response;
  try {
    response = await fetcher(`/api/v1/projects/${encodeURIComponent(slug)}/checkout-intents`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': crypto.randomUUID(),
      },
      body: JSON.stringify({ ...input, projectCurrency: input.projectCurrency.toLowerCase() }),
    });
  } catch {
    throw new Error(fallback);
  }
  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new Error(fallback);
  }

  const checkoutUrlValue =
    body &&
    typeof body === 'object' &&
    'checkout_url' in body &&
    typeof body.checkout_url === 'string'
      ? body.checkout_url
      : null;
  if (!checkoutUrlValue) {
    throw new Error('Checkout did not return a valid Stripe URL.');
  }

  const checkoutUrl = new URL(checkoutUrlValue);
  if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'checkout.stripe.com') {
    throw new Error('Checkout returned an invalid Stripe URL.');
  }
  return checkoutUrl.toString();
}
