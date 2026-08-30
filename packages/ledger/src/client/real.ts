import {
  CreateAccountStatus,
  CreateTransferStatus,
  TransferFlags,
  createClient,
  type Client,
  type Account,
  type Transfer,
} from 'tigerbeetle-node';
import type { LedgerTransfer } from '../intents.js';
import type { LedgerId } from '../ids.js';
import type {
  CreateAccountsInput,
  CreateTransfersResult,
  LedgerClient,
  PostedTransfer,
} from './mock.js';

const U128_MAX = (1n << 128n) - 1n;
type TigerBeetleClient = Pick<
  Client,
  'createAccounts' | 'createTransfers' | 'lookupAccounts' | 'lookupTransfers' | 'destroy'
>;

type StoredTransfer = Pick<
  Transfer,
  | 'id'
  | 'debit_account_id'
  | 'credit_account_id'
  | 'amount'
  | 'pending_id'
  | 'user_data_128'
  | 'user_data_64'
  | 'user_data_32'
  | 'timeout'
  | 'ledger'
  | 'code'
  | 'flags'
  | 'timestamp'
>;

type StoredAccount = Pick<
  Account,
  | 'id'
  | 'user_data_128'
  | 'user_data_64'
  | 'user_data_32'
  | 'reserved'
  | 'ledger'
  | 'code'
  | 'flags'
>;

export type TigerBeetleModule = {
  createClient(args: {
    cluster_id: bigint;
    replica_addresses: Array<string | number>;
  }): TigerBeetleClient;
};

function validateU128(value: bigint, label: string): void {
  if (value <= 0n || value >= U128_MAX) {
    throw new Error(`${label} must be an unsigned 128-bit value other than zero/max`);
  }
}

function validateClusterId(value: bigint): void {
  if (value < 0n || value > U128_MAX) {
    throw new Error('TIGERBEETLE_CLUSTER_ID must be an unsigned 128-bit integer');
  }
}

function statusError(kind: string, id: bigint, status: number): Error {
  return new Error(`TigerBeetle ${kind} ${id.toString()} failed with status ${status}`);
}

function transferMismatch(expected: LedgerTransfer, actual: StoredTransfer): string | undefined {
  const fields: Array<[string, bigint | number, bigint | number]> = [
    ['debit account', expected.debitAccountId, actual.debit_account_id],
    ['credit account', expected.creditAccountId, actual.credit_account_id],
    ['amount', expected.amount, actual.amount],
    ['ledger', expected.ledger, actual.ledger],
    ['code', expected.code, actual.code],
    ['flags', expected.linked ? TransferFlags.linked : TransferFlags.none, actual.flags],
  ];
  for (const [name, expectedValue, actualValue] of fields) {
    if (expectedValue !== actualValue) return name;
  }
  if (actual.pending_id !== 0n) return 'pending id';
  if (actual.user_data_128 !== 0n) return 'user data';
  if (actual.user_data_64 !== 0n) return 'user data';
  if (actual.user_data_32 !== 0) return 'user data';
  if (actual.timeout !== 0) return 'timeout';
  return undefined;
}

function accountMismatch(
  expected: CreateAccountsInput[number],
  actual: StoredAccount,
): string | undefined {
  if (actual.ledger !== expected.ledger) return 'ledger';
  if (actual.code !== expected.code) return 'code';
  if (actual.flags !== 0) return 'flags';
  if (actual.user_data_128 !== 0n) return 'user data';
  if (actual.user_data_64 !== 0n) return 'user data';
  if (actual.user_data_32 !== 0) return 'user data';
  if (actual.reserved !== 0) return 'reserved';
  return undefined;
}

function inspectExistingAccounts(
  accounts: readonly CreateAccountsInput[number][],
  stored: readonly StoredAccount[],
): { complete: boolean; conflict?: string } {
  const byId = new Map(stored.map((account) => [account.id.toString(), account]));
  for (const account of accounts) {
    const existing = byId.get(account.id.toString());
    if (!existing) continue;
    const mismatch = accountMismatch(account, existing);
    if (mismatch) {
      return {
        complete: false,
        conflict: `TigerBeetle account ${account.id.toString()} exists with different ${mismatch}`,
      };
    }
  }
  return {
    complete: accounts.every((account) => byId.has(account.id.toString())),
  };
}

function inspectExistingTransfers(
  transfers: readonly LedgerTransfer[],
  stored: readonly StoredTransfer[],
): { complete: boolean; conflict?: string } {
  const byId = new Map(stored.map((transfer) => [transfer.id.toString(), transfer]));
  for (const transfer of transfers) {
    const existing = byId.get(transfer.id.toString());
    if (!existing) continue;
    const mismatch = transferMismatch(transfer, existing);
    if (mismatch) {
      return {
        complete: false,
        conflict: `TigerBeetle transfer ${transfer.id.toString()} exists with different ${mismatch}`,
      };
    }
  }
  return {
    complete: transfers.every((transfer) => byId.has(transfer.id.toString())),
  };
}

function postedTransfer(transfer: StoredTransfer): PostedTransfer {
  return {
    id: transfer.id,
    debitAccountId: transfer.debit_account_id,
    creditAccountId: transfer.credit_account_id,
    amount: transfer.amount,
    ledger: transfer.ledger,
    code: transfer.code,
    linked: (transfer.flags & TransferFlags.linked) !== 0,
    timestamp: Number(transfer.timestamp),
  };
}

/** Production adapter for the official tigerbeetle-node client. */
export class TigerBeetleLedgerClient implements LedgerClient {
  private readonly addresses: string[];
  private readonly clusterId: bigint;
  private readonly module: TigerBeetleModule;
  private client: TigerBeetleClient | undefined;
  private transfers: PostedTransfer[] = [];

  constructor(
    addresses: string | string[],
    clusterId: bigint | number | string = 0n,
    module?: TigerBeetleModule,
  ) {
    this.addresses = (Array.isArray(addresses) ? addresses : [addresses])
      .map((address) => address.trim())
      .filter(Boolean);
    if (this.addresses.length === 0)
      throw new Error('TigerBeetle requires at least one replica address');
    this.clusterId = BigInt(clusterId);
    validateClusterId(this.clusterId);
    // Load dependency during construction so a production worker fails at
    // startup instead of accepting events it cannot post.
    this.module = module ?? { createClient };
  }

  private getClient(): TigerBeetleClient {
    if (!this.client) {
      this.client = this.module.createClient({
        cluster_id: this.clusterId,
        replica_addresses: this.addresses,
      });
    }
    return this.client;
  }

  async createAccounts(accounts: CreateAccountsInput): Promise<void> {
    if (accounts.length === 0) return;
    for (const account of accounts) {
      validateU128(account.id, 'account id');
      if (account.ledger <= 0 || account.code <= 0) {
        throw new Error(`invalid TigerBeetle account ${account.id.toString()}`);
      }
    }

    const result = await this.getClient().createAccounts(
      accounts.map((account) => ({
        id: account.id,
        debits_pending: 0n,
        debits_posted: 0n,
        credits_pending: 0n,
        credits_posted: 0n,
        user_data_128: 0n,
        user_data_64: 0n,
        user_data_32: 0,
        reserved: 0,
        ledger: account.ledger,
        code: account.code,
        flags: 0,
        timestamp: 0n,
      })),
    );

    if (result.length !== accounts.length) {
      throw new Error(
        `TigerBeetle returned ${result.length} account results for ${accounts.length} accounts`,
      );
    }
    const existingAccounts = accounts.filter(
      (_, index) => result[index]?.status === CreateAccountStatus.exists,
    );
    if (existingAccounts.length > 0) {
      const stored = await this.getClient().lookupAccounts(
        existingAccounts.map((account) => account.id),
      );
      const existingCheck = inspectExistingAccounts(existingAccounts, stored);
      if (existingCheck.conflict) throw new Error(existingCheck.conflict);
      if (!existingCheck.complete) {
        const found = new Set(stored.map((account) => account.id.toString()));
        const missing = existingAccounts.find((account) => !found.has(account.id.toString()));
        throw new Error(
          `TigerBeetle account ${missing?.id.toString() ?? 0} exists but lookup returned no record`,
        );
      }
    }
    result.forEach((entry, index) => {
      if (
        entry.status !== CreateAccountStatus.created &&
        entry.status !== CreateAccountStatus.exists
      ) {
        throw statusError('account', accounts[index]?.id ?? 0n, entry.status);
      }
    });
  }

  async createTransfers(transfers: LedgerTransfer[]): Promise<CreateTransfersResult> {
    if (transfers.length === 0) return { ok: true, transferIds: [] };
    const seen = new Set<string>();
    for (const transfer of transfers) {
      validateU128(transfer.id, 'transfer id');
      if (transfer.amount <= 0n || transfer.debitAccountId === transfer.creditAccountId) {
        return { ok: false, error: `invalid transfer ${transfer.id.toString()}` };
      }
      if (seen.has(transfer.id.toString())) {
        return { ok: false, error: `duplicate transfer ${transfer.id.toString()}` };
      }
      seen.add(transfer.id.toString());
    }

    const batch = transfers.map((transfer) => ({
      id: transfer.id,
      debit_account_id: transfer.debitAccountId,
      credit_account_id: transfer.creditAccountId,
      amount: transfer.amount,
      pending_id: 0n,
      user_data_128: 0n,
      user_data_64: 0n,
      user_data_32: 0,
      timeout: 0,
      ledger: transfer.ledger,
      code: transfer.code,
      flags: transfer.linked ? TransferFlags.linked : TransferFlags.none,
      timestamp: 0n,
    }));
    const existing = await this.getClient().lookupTransfers(batch.map((transfer) => transfer.id));
    const existingCheck = inspectExistingTransfers(transfers, existing);
    if (existingCheck.conflict) return { ok: false, error: existingCheck.conflict };
    if (existingCheck.complete) {
      this.rememberTransfers(transfers);
      return { ok: true, transferIds: transfers.map((transfer) => transfer.id) };
    }

    const result = await this.getClient().createTransfers(batch);

    if (result.length !== transfers.length) {
      return {
        ok: false,
        error: `TigerBeetle returned ${result.length} transfer results for ${transfers.length} transfers`,
      };
    }
    // A duplicate linked batch may report linked_event_failed even after the
    // original chain committed; only durable field-matched records qualify.
    const committedStatuses = new Set([
      CreateTransferStatus.created,
      CreateTransferStatus.exists,
      CreateTransferStatus.linked_event_failed,
    ]);
    if (result.some((entry) => entry.status !== CreateTransferStatus.created)) {
      const committed = inspectExistingTransfers(
        transfers,
        await this.getClient().lookupTransfers(batch.map((transfer) => transfer.id)),
      );
      if (committed.conflict) return { ok: false, error: committed.conflict };
      if (!committed.complete || result.some((entry) => !committedStatuses.has(entry.status))) {
        const failed = result.findIndex((entry) => !committedStatuses.has(entry.status));
        const reported =
          failed >= 0
            ? failed
            : result.findIndex((entry) => entry.status !== CreateTransferStatus.created);
        return {
          ok: false,
          error: statusError(
            'transfer',
            transfers[reported >= 0 ? reported : 0]?.id ?? 0n,
            result[reported >= 0 ? reported : 0]?.status ?? -1,
          ).message,
        };
      }
    }

    this.rememberTransfers(transfers);
    return { ok: true, transferIds: transfers.map((transfer) => transfer.id) };
  }

  async lookupTransfers(ids: readonly LedgerId[]): Promise<readonly PostedTransfer[]> {
    if (ids.length === 0) return [];
    for (const id of ids) validateU128(id, 'transfer id');
    const transfers = await this.getClient().lookupTransfers([...ids]);
    return transfers.map(postedTransfer);
  }

  private rememberTransfers(transfers: readonly LedgerTransfer[]): void {
    const timestamp = Date.now();
    for (const transfer of transfers) {
      if (!this.transfers.some((posted) => posted.id === transfer.id)) {
        this.transfers.push({ ...transfer, timestamp });
      }
    }
  }

  async getAccountBalance(accountId: LedgerId): Promise<bigint> {
    validateU128(accountId, 'account id');
    const account = (await this.getClient().lookupAccounts([accountId]))[0];
    if (!account) throw new Error(`TigerBeetle account ${accountId.toString()} not found`);
    return account.credits_posted - account.debits_posted;
  }

  listTransfers(): readonly PostedTransfer[] {
    return this.transfers;
  }

  reset(): void {
    this.client?.destroy();
    this.client = undefined;
    this.transfers = [];
  }
}

export function parseTigerBeetleAddresses(envValue: string | undefined): string[] {
  if (!envValue?.trim()) return [];
  return envValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function parseTigerBeetleClusterId(envValue: string | undefined): bigint {
  if (!envValue?.trim() || !/^\d+$/.test(envValue.trim())) {
    throw new Error('TIGERBEETLE_CLUSTER_ID must be configured as an unsigned integer');
  }
  const clusterId = BigInt(envValue.trim());
  validateClusterId(clusterId);
  return clusterId;
}
