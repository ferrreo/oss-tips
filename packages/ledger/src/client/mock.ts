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
  | { ok: true; transferIds: LedgerId[] }
  | { ok: false; error: string };

export interface LedgerClient {
  createAccounts(accounts: CreateAccountsInput): Promise<void>;
  createTransfers(transfers: LedgerTransfer[]): Promise<CreateTransfersResult>;
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
      if (!this.accounts.has(a.id)) {
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
    const accountIds = new Set<LedgerId>();
    for (const t of transfers) {
      accountIds.add(t.debitAccountId);
      accountIds.add(t.creditAccountId);
    }

    for (const id of accountIds) {
      if (!this.accounts.has(id)) {
        return { ok: false, error: `account ${id.toString()} not found` };
      }
    }

    const existingIds = new Set(this.transfers.map((t) => t.id.toString()));
    for (const t of transfers) {
      if (existingIds.has(t.id.toString())) {
        return { ok: true, transferIds: transfers.map((x) => x.id) };
      }
    }

    const ts = Date.now();
    for (const t of transfers) {
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

  listTransfers(): readonly PostedTransfer[] {
    return this.transfers;
  }
}
