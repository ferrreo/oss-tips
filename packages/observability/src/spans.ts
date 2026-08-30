export const SPAN_NAMES = {
  paymentCheckoutIntent: 'payments.checkout_intent.create',
  paymentRefund: 'payments.refund.orchestrate',
  stripeWebhookReceive: 'stripe.webhook.receive',
  stripeWebhookProcess: 'stripe.webhook.process',
  outgoingWebhookDeliver: 'webhook.outgoing.deliver',
  outgoingWebhookVerify: 'webhook.outgoing.verify',
} as const;

export type SpanName = (typeof SPAN_NAMES)[keyof typeof SPAN_NAMES];

export function paymentSpan(operation: 'checkout' | 'refund' | 'invoice_fee'): SpanName {
  switch (operation) {
    case 'checkout':
      return SPAN_NAMES.paymentCheckoutIntent;
    case 'refund':
      return SPAN_NAMES.paymentRefund;
    default:
      return SPAN_NAMES.stripeWebhookProcess;
  }
}

export function webhookSpan(
  direction: 'incoming_stripe' | 'incoming_verify' | 'outgoing_deliver',
): SpanName {
  switch (direction) {
    case 'incoming_stripe':
      return SPAN_NAMES.stripeWebhookReceive;
    case 'incoming_verify':
      return SPAN_NAMES.outgoingWebhookVerify;
    default:
      return SPAN_NAMES.outgoingWebhookDeliver;
  }
}
