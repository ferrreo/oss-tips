import { describe, expect, it, vi } from 'vitest';
import { createProjectCheckout } from './checkout';

const input: Parameters<typeof createProjectCheckout>[1] = {
  projectAmountMinor: 2500,
  projectCurrency: 'GBP',
  platformTipMinor: 100,
  cadence: 'one_off',
  publicOptions: { showName: false, showAmount: false, showMessage: false },
};

function checkoutResponse(checkoutUrl: string | null): Response {
  return new Response(
    JSON.stringify({
      id: 'payment_123',
      client_secret: null,
      checkout_url: checkoutUrl,
      expires_at: new Date().toISOString(),
      application_fee: { amount: '200', currency: 'gbp' },
      customer_charge: { amount: '2600', currency: 'gbp' },
      mode: 'payment',
    }),
    { status: 201 },
  );
}

describe('createProjectCheckout', () => {
  it('normalizes currency and returns only a Stripe Checkout URL', async () => {
    const fetcher = vi.fn(async () =>
      checkoutResponse('https://checkout.stripe.com/c/pay/cs_test'),
    );

    await expect(createProjectCheckout('grove', input, fetcher)).resolves.toBe(
      'https://checkout.stripe.com/c/pay/cs_test',
    );
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/projects/grove/checkout-intents',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'idempotency-key': expect.any(String) }),
        body: expect.stringContaining('"projectCurrency":"gbp"'),
      }),
    );
  });

  it('rejects missing or off-site checkout URLs', async () => {
    await expect(
      createProjectCheckout('grove', input, async () => checkoutResponse(null)),
    ).rejects.toThrow('valid Stripe URL');
    await expect(
      createProjectCheckout('grove', input, async () =>
        checkoutResponse('https://example.com/pay'),
      ),
    ).rejects.toThrow('invalid Stripe URL');
  });

  it('does not expose API error details', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ detail: 'database credentials leaked' }), { status: 503 }),
    );

    await expect(createProjectCheckout('grove', input, fetcher)).rejects.toThrow(
      'Checkout is unavailable right now.',
    );
    await expect(createProjectCheckout('grove', input, fetcher)).rejects.not.toThrow(
      'database credentials leaked',
    );
  });
});
