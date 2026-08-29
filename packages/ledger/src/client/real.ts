import type { LedgerTransfer } from '../intents.js';
import type { LedgerId } from '../ids.js';
import type {
  CreateAccountsInput,
  CreateTransfersResult,
  LedgerClient,
  PostedTransfer,
} from './mock.js';

/**
 * Thin wrapper around the TigerBeetle Node client.
 * When addresses are configured, this is where the real driver connects.
 */
export class TigerBeetleLedgerClient implements LedgerClient {
  private readonly addresses: string[];
  private connected = false;

  constructor(addresses: string | string[]) {
    this.addresses = Array.isArray(addresses) ? addresses : [addresses];
  }

  private ensureConnect(): void {
    if (this.connected) return;
    // Real integration: import tigerbeetle-node and createClient({ cluster_id, replica_addresses })
    this.connected = true;
  }

  async createAccounts(_accounts: CreateAccountsInput): Promise<void> {
    this.ensureConnect();
    throw new Error(
      `TigerBeetle createAccounts not implemented in stub (addresses: ${this.addresses.join(',')})`,
    );
  }

  async createTransfers(_transfers: LedgerTransfer[]): Promise<CreateTransfersResult> {
    this.ensureConnect();
    throw new Error(
      `TigerBeetle createTransfers not implemented in stub (addresses: ${this.addresses.join(',')})`,
    );
  }

  async getAccountBalance(_accountId: LedgerId): Promise<bigint> {
    this.ensureConnect();
    throw new Error('TigerBeetle getAccountBalance not implemented in stub');
  }

  listTransfers(): readonly PostedTransfer[] {
    return [];
  }

  reset(): void {
    this.connected = false;
  }
}

export function parseTigerBeetleAddresses(envValue: string | undefined): string[] {
  if (!envValue?.trim()) return [];
  return envValue
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
