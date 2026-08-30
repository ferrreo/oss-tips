import { uuidv7 } from '@oss-tips/domain';
import type { Db } from '../client.js';
import type {
  NewProviderBalanceTransaction,
  NewReconciliationDifference,
  ReconciliationDifference,
  ReconciliationRun,
} from '../types.js';

export type ReconciliationRunStatus = 'running' | 'matched' | 'difference' | 'failed';
const RECONCILIATION_RUN_LEASE_MS = 15 * 60_000;

export type ReconciliationWindow = {
  stripeAccountId: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
};

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

/** Persistence boundary for provider snapshots and daily reconciliation runs. */
export function createReconciliationRepository(db: Db) {
  const findRun = async (window: ReconciliationWindow): Promise<ReconciliationRun | undefined> =>
    db
      .selectFrom('reconciliation_run')
      .selectAll()
      .where('stripe_account_id', '=', window.stripeAccountId)
      .where('currency', '=', window.currency)
      .where('period_start', '=', window.periodStart)
      .where('period_end', '=', window.periodEnd)
      .executeTakeFirst();

  return {
    findRun,

    async beginRun(
      window: ReconciliationWindow,
      now = new Date(),
      options: { retry?: boolean } = {},
    ): Promise<{ run: ReconciliationRun; shouldRun: boolean }> {
      const existing = await findRun(window);
      if (existing) {
        if (existing.status === 'matched') {
          return { run: existing, shouldRun: false };
        }
        if (existing.status === 'difference') {
          const differences = await db
            .selectFrom('reconciliation_difference')
            .select('classification')
            .where('reconciliation_run_id', '=', existing.id)
            .execute();
          const timingWindowEnd = new Date(`${existing.period_end}T00:00:00.000Z`).getTime();
          const timingOnly =
            differences.length > 0 && differences.every((row) => row.classification === 'timing');
          if (!options.retry && (!timingOnly || now.getTime() < timingWindowEnd + 2 * 86_400_000)) {
            return { run: existing, shouldRun: false };
          }
          const restarted = await db
            .updateTable('reconciliation_run')
            .set({ status: 'running', started_at: now, completed_at: null })
            .where('id', '=', existing.id)
            .returningAll()
            .executeTakeFirstOrThrow();
          await db
            .deleteFrom('reconciliation_difference')
            .where('reconciliation_run_id', '=', restarted.id)
            .execute();
          return { run: restarted, shouldRun: true };
        }
        if (
          existing.status === 'running' &&
          now.getTime() - existing.started_at.getTime() < RECONCILIATION_RUN_LEASE_MS
        ) {
          return { run: existing, shouldRun: false };
        }
        const restarted = await db
          .updateTable('reconciliation_run')
          .set({ status: 'running', started_at: now, completed_at: null })
          .where('id', '=', existing.id)
          .returningAll()
          .executeTakeFirstOrThrow();
        await db
          .deleteFrom('reconciliation_difference')
          .where('reconciliation_run_id', '=', restarted.id)
          .execute();
        return { run: restarted, shouldRun: true };
      }

      const values = {
        id: uuidv7(),
        stripe_account_id: window.stripeAccountId,
        currency: window.currency,
        period_start: window.periodStart,
        period_end: window.periodEnd,
        status: 'running' as const,
        provider_net_minor: 0n,
        ledger_net_minor: 0n,
        started_at: now,
        completed_at: null,
      };
      try {
        const run = await db
          .insertInto('reconciliation_run')
          .values(values)
          .returningAll()
          .executeTakeFirstOrThrow();
        return { run, shouldRun: true };
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const concurrent = await findRun(window);
        if (!concurrent) throw error;
        return { run: concurrent, shouldRun: false };
      }
    },

    async saveProviderTransactions(
      transactions: readonly NewProviderBalanceTransaction[],
    ): Promise<void> {
      if (transactions.length === 0) return;
      for (const transaction of transactions) {
        await db
          .insertInto('provider_balance_transaction')
          .values(transaction)
          .onConflict((oc) =>
            oc.column('stripe_balance_transaction_id').doUpdateSet({
              stripe_account_id: transaction.stripe_account_id,
              currency: transaction.currency,
              amount_minor: transaction.amount_minor,
              fee_minor: transaction.fee_minor,
              net_minor: transaction.net_minor,
              type: transaction.type,
              source_id: transaction.source_id,
              available_on: transaction.available_on,
              raw: transaction.raw,
            }),
          )
          .execute();
      }
    },

    async addDifferences(
      differences: readonly NewReconciliationDifference[],
    ): Promise<ReconciliationDifference[]> {
      if (differences.length === 0) return [];
      return db
        .insertInto('reconciliation_difference')
        .values(differences)
        .returningAll()
        .execute();
    },

    async finishRun(
      id: string,
      status: Exclude<ReconciliationRunStatus, 'running'>,
      completedAt = new Date(),
      providerNetMinor: bigint | number = 0n,
      ledgerNetMinor: bigint | number = 0n,
    ): Promise<ReconciliationRun> {
      return db
        .updateTable('reconciliation_run')
        .set({
          status,
          provider_net_minor: providerNetMinor,
          ledger_net_minor: ledgerNetMinor,
          completed_at: completedAt,
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async listRuns(limit = 100): Promise<ReconciliationRun[]> {
      return db
        .selectFrom('reconciliation_run')
        .selectAll()
        .orderBy('period_start', 'desc')
        .orderBy('created_at', 'desc')
        .limit(limit)
        .execute();
    },

    async listDifferences(runId: string): Promise<ReconciliationDifference[]> {
      return db
        .selectFrom('reconciliation_difference')
        .selectAll()
        .where('reconciliation_run_id', '=', runId)
        .orderBy('created_at', 'asc')
        .execute();
    },
  };
}

export type ReconciliationRepository = ReturnType<typeof createReconciliationRepository>;
