export type AccountSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  current: boolean;
};

export type AccountPasskey = {
  id: string;
  name: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

export type AccountConnection = {
  id: string;
  providerId: string;
  createdAt: string;
};

export type SessionRecord = {
  id: string;
  userId: string;
  token: string;
  createdAt: Date | string | number;
  updatedAt: Date | string | number;
  expiresAt: Date | string | number;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type PasskeyRecord = {
  id: string;
  name?: string;
  publicKey: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: Date | string | number;
  lastUsedAt?: Date | string | number | null;
};

export type AccountRecord = {
  id: string;
  providerId: string;
  createdAt: Date | string | number;
};

function iso(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function sanitizeSession(record: SessionRecord, currentSessionId: string): AccountSession {
  return {
    id: record.id,
    createdAt: iso(record.createdAt),
    updatedAt: iso(record.updatedAt),
    expiresAt: iso(record.expiresAt),
    ipAddress: record.ipAddress ?? null,
    userAgent: record.userAgent ?? null,
    current: record.id === currentSessionId,
  };
}

export function sanitizePasskey(record: PasskeyRecord): AccountPasskey {
  return {
    id: record.id,
    name: record.name?.trim() || 'Unnamed passkey',
    deviceType: record.deviceType,
    backedUp: record.backedUp,
    createdAt: iso(record.createdAt),
    lastUsedAt: record.lastUsedAt == null ? null : iso(record.lastUsedAt),
  };
}

export function sanitizeAccount(record: AccountRecord): AccountConnection {
  return {
    id: record.id,
    providerId: record.providerId,
    createdAt: iso(record.createdAt),
  };
}

/** Resolve token only after checking both identity and session id server-side. */
export function ownedSessionToken(
  records: readonly SessionRecord[],
  userId: string,
  sessionId: string,
): string | null {
  const record = records.find(
    (candidate) => candidate.id === sessionId && candidate.userId === userId,
  );
  return record?.token || null;
}
