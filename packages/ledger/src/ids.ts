import { createHash } from 'node:crypto';

const MAX_U128 = (1n << 128n) - 1n;

export type LedgerId = bigint;

/**
 * Derive a deterministic unsigned 128-bit ID from a namespaced input tuple.
 * Uses SHA-256 and takes the first 128 bits, mapping forbidden zero/max values.
 */
export function deriveLedgerId(namespace: string, ...parts: readonly string[]): LedgerId {
  const input = [namespace, ...parts].join('/');
  const digest = createHash('sha256').update(input, 'utf8').digest();
  let id = 0n;
  for (let i = 0; i < 16; i++) {
    id = (id << 8n) | BigInt(digest[i]!);
  }
  if (id === 0n) return 1n;
  if (id === MAX_U128) return MAX_U128 - 1n;
  return id;
}

export function transferId(
  stripeAccountId: string,
  stripeEventId: string,
  postingKind: string,
  postingVersion: number,
  transferIndex = 0,
): LedgerId {
  return deriveLedgerId(
    'oss.tips/v1/transfer',
    stripeAccountId,
    stripeEventId,
    postingKind,
    String(postingVersion),
    String(transferIndex),
  );
}

export function accountId(
  accountCode: number,
  scopeKind: string,
  scopeId: string,
  currency: string,
): LedgerId {
  return deriveLedgerId(
    'oss.tips/v1/account',
    String(accountCode),
    scopeKind,
    scopeId,
    currency.toLowerCase(),
  );
}

export function ledgerIdToString(id: LedgerId): string {
  return id.toString();
}

export function ledgerIdFromString(value: string): LedgerId {
  return BigInt(value);
}
