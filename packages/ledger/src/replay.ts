import { AccountCode } from './codes.js';
import type { LedgerClient } from './client/index.js';
import { accountId } from './ids.js';
import type { LedgerAccountDefinition, PostingIntent } from './intents.js';

export type ReplayResult = {
  intentKey: string;
  ok: boolean;
  transferIds: string[];
  error?: string;
};

export type ReplaySummary = {
  total: number;
  succeeded: number;
  failed: number;
  results: ReplayResult[];
};

/**
 * Replay ordered posting intents against a ledger client for recovery.
 * Ensures referenced accounts exist before submitting linked transfers.
 */
export async function replayIntents(
  client: LedgerClient,
  intents: readonly PostingIntent[],
): Promise<ReplaySummary> {
  const results: ReplayResult[] = [];

  for (const intent of intents) {
    const accountDefs = new Map<string, LedgerAccountDefinition>();

    for (const definition of intent.accountDefinitions ?? []) {
      accountDefs.set(definition.id.toString(), definition);
    }

    for (const t of intent.transfers) {
      for (const [id, code] of [
        [t.debitAccountId, inferCode(intent, t.debitAccountId)] as const,
        [t.creditAccountId, inferCode(intent, t.creditAccountId)] as const,
      ]) {
        const key = id.toString();
        if (!accountDefs.has(key)) {
          accountDefs.set(key, { id, ledger: t.ledger, code });
        }
      }
    }

    try {
      await client.createAccounts([...accountDefs.values()]);
      const outcome = await client.createTransfers(intent.transfers);
      if (outcome.ok) {
        results.push({
          intentKey: intent.semanticKey,
          ok: true,
          transferIds: outcome.transferIds.map((id) => id.toString()),
        });
      } else {
        results.push({
          intentKey: intent.semanticKey,
          ok: false,
          transferIds: [],
          error: outcome.error,
        });
      }
    } catch (error) {
      results.push({
        intentKey: intent.semanticKey,
        ok: false,
        transferIds: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  return {
    total: results.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  };
}

function inferCode(intent: PostingIntent, id: bigint): number {
  const { metadata } = intent;
  const currency = intent.currency;
  const matches = (code: number, scopeKind: string, scopeId: string) =>
    accountId(code, scopeKind, scopeId, currency) === id;

  if (matches(AccountCode.StripeExternalClearing, 'stripe_account', metadata.stripeAccountId)) {
    return AccountCode.StripeExternalClearing;
  }
  if (matches(AccountCode.PaymentTransit, 'payment', metadata.paymentId)) {
    return AccountCode.PaymentTransit;
  }
  if (matches(AccountCode.ProjectGrossSupport, 'project', metadata.projectId)) {
    return AccountCode.ProjectGrossSupport;
  }
  if (matches(AccountCode.PlatformProjectFeeRevenue, 'platform', 'oss.tips')) {
    return AccountCode.PlatformProjectFeeRevenue;
  }
  if (matches(AccountCode.PlatformSupporterTipRevenue, 'platform', 'oss.tips')) {
    return AccountCode.PlatformSupporterTipRevenue;
  }
  return AccountCode.UnreconciledSuspense;
}
