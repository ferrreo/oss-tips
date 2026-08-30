/** Branded ID helpers and UUID v7 generation. */

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type UserId = Brand<string, 'UserId'>;
export type ProjectId = Brand<string, 'ProjectId'>;
export type OrganisationId = Brand<string, 'OrganisationId'>;
export type TierId = Brand<string, 'TierId'>;
export type PaymentId = Brand<string, 'PaymentId'>;
export type SubscriptionId = Brand<string, 'SubscriptionId'>;
export type EntitlementId = Brand<string, 'EntitlementId'>;
export type PostId = Brand<string, 'PostId'>;
export type GoalId = Brand<string, 'GoalId'>;
export type ThreadId = Brand<string, 'ThreadId'>;
export type ApiKeyId = Brand<string, 'ApiKeyId'>;
export type WebhookEndpointId = Brand<string, 'WebhookEndpointId'>;
export type CheckoutIntentId = Brand<string, 'CheckoutIntentId'>;
export type EventId = Brand<string, 'EventId'>;

export function brandId<B extends string>(value: string): Brand<string, B> {
  return value as Brand<string, B>;
}

/** RFC 9562 UUID v7 (time-ordered). */
export function uuidv7(now = Date.now()): string {
  const ms = BigInt(now);
  const bytes = new Uint8Array(16);
  bytes[0] = Number((ms >> 40n) & 0xffn);
  bytes[1] = Number((ms >> 32n) & 0xffn);
  bytes[2] = Number((ms >> 24n) & 0xffn);
  bytes[3] = Number((ms >> 16n) & 0xffn);
  bytes[4] = Number((ms >> 8n) & 0xffn);
  bytes[5] = Number(ms & 0xffn);
  crypto.getRandomValues(bytes.subarray(6));
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  return [...bytes]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

export function publicId(prefix: string, id = uuidv7()): string {
  const compact = id.replace(/-/g, '').slice(0, 26);
  return `${prefix}_${compact}`;
}
