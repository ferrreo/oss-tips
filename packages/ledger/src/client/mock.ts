import type { LedgerTransfer } from '../intents.js';
import type { LedgerId } from '../ids.js';

export type LedgerAccount = {
  id: LedgerId;
  ledger: number;
  code: number;
  debitsPosted: bigint;
  creditsPosted: bigint;
};

export type PostedTransfer = LedgerTransfer & {
  timestamp: number;
};

export type CreateAccountsInput = Array<{
  id: LedgerId;
  ledger: number;
  code: number;
}>;

export type CreateTransfersResult =
  { ok: true; transferIds: LedgerId[] } | { ok: false; error: string };

export interface LedgerClient {
  createAccounts(accounts: CreateAccountsInput): Promise<void>;
  createTransfers(transfers: LedgerTransfer[]): Promise<CreateTransfersResult>;
  lookupTransfers(ids: readonly LedgerId[]): Promise<readonly PostedTransfer[]>;
  getAccountBalance(accountId: LedgerId): Promise<bigint>;
  listTransfers(): readonly PostedTransfer[];
  reset(): void;
}

export class MockLedgerClient implements LedgerClient {
  private accounts = new Map<LedgerId, LedgerAccount>();
  private transfers: PostedTransfer[] = [];

  reset(): void {
    this.accounts.clear();
    this.transfers = [];
  }

  async createAccounts(accounts: CreateAccountsInput): Promise<void> {
    for (const a of accounts) {
      if (a.id <= 0n || a.ledger <= 0 || a.code <= 0) {
        throw new Error(`invalid account definition ${a.id.toString()}`);
      }
      const existing = this.accounts.get(a.id);
      if (existing && (existing.ledger !== a.ledger || existing.code !== a.code)) {
        throw new Error(`account ${a.id.toString()} exists with different definition`);
      }
      if (!existing) {
        this.accounts.set(a.id, {
          id: a.id,
          ledger: a.ledger,
          code: a.code,
          debitsPosted: 0n,
          creditsPosted: 0n,
        });
      }
    }
  }

  async createTransfers(transfers: LedgerTransfer[]): Promise<CreateTransfersResult> {
    if (transfers.length === 0) return { ok: true, transferIds: [] };
    const accountIds = new Set<LedgerId>();
    const inputIds = new Set<string>();
    for (const t of transfers) {
      if (t.id <= 0n || t.amount <= 0n || t.debitAccountId === t.creditAccountId) {
        return { ok: false, error: `invalid transfer ${t.id.toString()}` };
      }
      if (inputIds.has(t.id.toString())) {
        return { ok: false, error: `duplicate transfer ${t.id.toString()}` };
      }
      inputIds.add(t.id.toString());
      accountIds.add(t.debitAccountId);
      accountIds.add(t.creditAccountId);
    }

    for (const id of accountIds) {
      if (!this.accounts.has(id)) {
        return { ok: false, error: `account ${id.toString()} not found` };
      }
    }
    for (const transfer of transfers) {
      const debit = this.accounts.get(transfer.debitAccountId)!;
      const credit = this.accounts.get(transfer.creditAccountId)!;
      if (debit.ledger !== credit.ledger || debit.ledger !== transfer.ledger) {
        return { ok: false, error: `transfer ${transfer.id.toString()} ledger mismatch` };
      }
    }

    const newTransfers: LedgerTransfer[] = [];
    for (const transfer of transfers) {
      const existing = this.transfers.find((t) => t.id === transfer.id);
      if (existing) {
        if (
          existing.debitAccountId !== transfer.debitAccountId ||
          existing.creditAccountId !== transfer.creditAccountId ||
          existing.amount !== transfer.amount ||
          existing.ledger !== transfer.ledger ||
          existing.code !== transfer.code ||
          existing.linked !== transfer.linked
        ) {
          return {
            ok: false,
            error: `transfer ${transfer.id.toString()} exists with different definition`,
          };
        }
      } else {
        newTransfers.push(transfer);
      }
    }

    if (newTransfers.length === 0) {
      return { ok: true, transferIds: transfers.map((x) => x.id) };
    }

    const ts = Date.now();
    for (const t of newTransfers) {
      const debit = this.accounts.get(t.debitAccountId)!;
      const credit = this.accounts.get(t.creditAccountId)!;
      debit.debitsPosted += t.amount;
      credit.creditsPosted += t.amount;
      this.transfers.push({ ...t, timestamp: ts });
    }

    return { ok: true, transferIds: transfers.map((t) => t.id) };
  }

  async getAccountBalance(accountId: LedgerId): Promise<bigint> {
    const account = this.accounts.get(accountId);
    if (!account) return 0n;
    return account.creditsPosted - account.debitsPosted;
  }

  async lookupTransfers(ids: readonly LedgerId[]): Promise<readonly PostedTransfer[]> {
    const requested = new Set(ids);
    return this.transfers.filter((transfer) => requested.has(transfer.id));
  }

  listTransfers(): readonly PostedTransfer[] {
    return this.transfers;
  }
}
