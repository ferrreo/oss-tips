import { MockLedgerClient } from './mock.js';
import {
  TigerBeetleLedgerClient,
  parseTigerBeetleAddresses,
  parseTigerBeetleClusterId,
} from './real.js';
import type { LedgerClient } from './mock.js';

export type { LedgerClient, PostedTransfer } from './mock.js';
export { MockLedgerClient } from './mock.js';
export {
  TigerBeetleLedgerClient,
  parseTigerBeetleAddresses,
  parseTigerBeetleClusterId,
  type TigerBeetleModule,
} from './real.js';

export function createLedgerClient(env: NodeJS.ProcessEnv = process.env): LedgerClient {
  const addresses = parseTigerBeetleAddresses(env.TIGERBEETLE_ADDRESSES);
  const mode = env.LEDGER_MODE?.trim().toLowerCase();
  if (mode === 'mock') {
    if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
      throw new Error('LEDGER_MODE=mock is only allowed in local development or tests');
    }
    if (addresses.length > 0) {
      throw new Error('LEDGER_MODE=mock cannot be combined with TIGERBEETLE_ADDRESSES');
    }
    return new MockLedgerClient();
  }
  if (mode && mode !== 'tigerbeetle') {
    throw new Error(`Unsupported LEDGER_MODE: ${mode}`);
  }
  if (addresses.length === 0) {
    throw new Error(
      'TigerBeetle is required; configure TIGERBEETLE_ADDRESSES or explicitly set LEDGER_MODE=mock for tests',
    );
  }
  return new TigerBeetleLedgerClient(
    addresses,
    parseTigerBeetleClusterId(env.TIGERBEETLE_CLUSTER_ID),
  );
}
