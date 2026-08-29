import { MockLedgerClient } from './mock.js';
import { TigerBeetleLedgerClient, parseTigerBeetleAddresses } from './real.js';
import type { LedgerClient } from './mock.js';

export type { LedgerClient, PostedTransfer } from './mock.js';
export { MockLedgerClient } from './mock.js';
export { TigerBeetleLedgerClient, parseTigerBeetleAddresses } from './real.js';

export function createLedgerClient(env: NodeJS.ProcessEnv = process.env): LedgerClient {
  const addresses = parseTigerBeetleAddresses(env.TIGERBEETLE_ADDRESSES);
  if (addresses.length === 0) {
    return new MockLedgerClient();
  }
  return new TigerBeetleLedgerClient(addresses);
}
