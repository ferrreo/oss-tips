import { describe, expect, it } from 'vitest';
import {
  ownedSessionToken,
  sanitizeAccount,
  sanitizePasskey,
  sanitizeSession,
} from './account-security';

describe('account security projections', () => {
  it('omits session tokens while retaining current-session state', () => {
    const value = sanitizeSession(
      {
        id: 'session-1',
        userId: 'user-1',
        token: 'never-send-this-to-browser',
        createdAt: '2026-08-29T09:00:00.000Z',
        updatedAt: '2026-08-29T09:30:00.000Z',
        expiresAt: '2026-09-29T09:00:00.000Z',
        ipAddress: '192.0.2.8',
        userAgent: 'Browser/1.0',
      },
      'session-1',
    );

    expect(value).toEqual({
      id: 'session-1',
      createdAt: '2026-08-29T09:00:00.000Z',
      updatedAt: '2026-08-29T09:30:00.000Z',
      expiresAt: '2026-09-29T09:00:00.000Z',
      ipAddress: '192.0.2.8',
      userAgent: 'Browser/1.0',
      current: true,
    });
    expect(JSON.stringify(value)).not.toContain('never-send-this-to-browser');
  });

  it('omits passkey public material and supplies a usable fallback name', () => {
    const value = sanitizePasskey({
      id: 'passkey-1',
      publicKey: 'secret-public-key',
      deviceType: 'singleDevice',
      backedUp: true,
      createdAt: '2026-08-29T09:00:00.000Z',
      name: '  ',
      lastUsedAt: '2026-08-29T09:30:00.000Z',
    });

    expect(value).toEqual({
      id: 'passkey-1',
      name: 'Unnamed passkey',
      deviceType: 'singleDevice',
      backedUp: true,
      createdAt: '2026-08-29T09:00:00.000Z',
      lastUsedAt: '2026-08-29T09:30:00.000Z',
    });
    expect(JSON.stringify(value)).not.toContain('secret-public-key');
  });

  it('requires matching user ownership before resolving revoke token', () => {
    const records = [
      {
        id: 'session-1',
        userId: 'user-1',
        token: 'token-1',
        createdAt: 0,
        updatedAt: 0,
        expiresAt: 1,
      },
    ];

    expect(ownedSessionToken(records, 'user-1', 'session-1')).toBe('token-1');
    expect(ownedSessionToken(records, 'user-2', 'session-1')).toBeNull();
    expect(ownedSessionToken(records, 'user-1', 'session-2')).toBeNull();
  });

  it('projects only account identity needed by settings UI', () => {
    expect(sanitizeAccount({ id: 'account-1', providerId: 'github', createdAt: 0 })).toEqual({
      id: 'account-1',
      providerId: 'github',
      createdAt: '1970-01-01T00:00:00.000Z',
    });
  });
});
