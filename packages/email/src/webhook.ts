import { Resend, type WebhookEventPayload } from 'resend';

export type ResendWebhookHeaders = {
  id: string;
  timestamp: string;
  signature: string;
};

// Webhook verification is local. Resend requires a non-empty constructor key,
// but this path never makes an API request.
const verifier = new Resend('re_local_verifier');

/** Verify a Resend webhook against its raw body using the provider SDK. */
export function verifyResendWebhook(input: {
  payload: string | Buffer;
  headers: ResendWebhookHeaders;
  webhookSecret: string;
}): WebhookEventPayload {
  return verifier.webhooks.verify({
    ...input,
    payload: typeof input.payload === 'string' ? input.payload : input.payload.toString('utf8'),
  });
}
