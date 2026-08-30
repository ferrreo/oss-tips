import { afterEach, describe, expect, it, vi } from 'vitest';
import { auditRecord, hashAuditIp } from './api-utils.js';
import type { ApiEvent } from './api-utils.js';

function event(): ApiEvent {
  return {
    request: new Request('https://oss.tips/api/v1/project/settings', {
      headers: {
        'cf-connecting-ip': '203.0.113.7',
        'x-correlation-id': 'request-42',
      },
    }),
    url: new URL('https://oss.tips/api/v1/project/settings'),
    locals: {
      session: {
        session: { id: 'session-1' },
        user: { id: 'user-1' },
      },
    },
  } as ApiEvent;
}

describe('audit recorder', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('hashes request IP and stores only allowlisted metadata', () => {
    vi.stubEnv('AUDIT_HASH_SECRET', 'audit-test-secret');
    const record = auditRecord(
      event(),
      { type: 'user', userId: 'user-1' },
      {
        action: 'project.settings.update',
        resourceType: 'project',
        reason: 'Updated project settings',
        metadata: {
          token: 'secret-token',
          amount_minor: 500,
          scopes: ['projects:read'],
          nested: { email: 'person@example.test' },
        },
      },
    );

    expect(record).toMatchObject({
      actor_id: 'user-1',
      session_id: 'session-1',
      reason: 'Updated project settings',
      correlation_id: 'request-42',
      ip_hash: hashAuditIp('203.0.113.7'),
      metadata_redacted: { amount_minor: 500, scopes: ['projects:read'] },
    });
    expect(record).not.toHaveProperty('ip_address');
    expect(record.metadata_redacted).not.toHaveProperty('token');
    expect(record.metadata_redacted).not.toHaveProperty('nested');
  });

  it('fails closed when production has no dedicated audit hash secret', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUDIT_HASH_SECRET', '');
    expect(() => hashAuditIp('203.0.113.7')).toThrow('AUDIT_HASH_SECRET is required in production');
  });
});
