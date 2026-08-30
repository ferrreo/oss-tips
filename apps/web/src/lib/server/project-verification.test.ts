import { describe, expect, it, vi } from 'vitest';
import { normalizeRepositoryUrl, verifyRepositoryOAuth } from './project-verification';
import {
  createSupportEmailVerificationValue,
  supportEmailCodeFromVerificationValue,
  supportEmailCodeHash,
  supportEmailCodeMatches,
  supportEmailIdentifier,
} from '@oss-tips/email';

describe('project verification boundaries', () => {
  it('normalizes repository identity without retaining URL credentials or queries', () => {
    expect(normalizeRepositoryUrl('https://github.com/acme/ledger-kit.git')).toEqual({
      url: 'https://github.com/acme/ledger-kit',
      provider: 'github',
      externalId: 'acme/ledger-kit',
    });
    expect(normalizeRepositoryUrl('https://user:secret@github.com/acme/ledger-kit')).toBeNull();
    expect(normalizeRepositoryUrl('https://github.com/acme/ledger-kit?token=secret')).toBeNull();
    expect(normalizeRepositoryUrl('https://github.com/acme/ledger-kit/issues')).toBeNull();
  });

  it('marks provider ownership only when provider grants admin permission', async () => {
    const fetcher = vi.fn(async (input: string | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://api.github.com/repos/acme/ledger-kit');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer provider-token');
      return new Response(JSON.stringify({ permissions: { admin: true } }), { status: 200 });
    });
    await expect(
      verifyRepositoryOAuth(
        {
          provider: 'github',
          url: 'https://github.com/acme/ledger-kit',
          externalId: 'acme/ledger-kit',
          accessToken: 'provider-token',
        },
        fetcher,
      ),
    ).resolves.toEqual({ status: 'verified' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('does not turn a missing provider proof into success', async () => {
    await expect(
      verifyRepositoryOAuth(
        {
          provider: 'github',
          url: 'https://github.com/acme/ledger-kit',
          externalId: 'acme/ledger-kit',
          accessToken: 'provider-token',
        },
        async () =>
          new Response(JSON.stringify({ permissions: { admin: false } }), { status: 200 }),
      ),
    ).resolves.toEqual({
      status: 'rejected',
      reason: 'Provider account does not have repository owner permissions',
    });
    await expect(
      verifyRepositoryOAuth(
        {
          provider: 'generic',
          url: 'https://forge.example/acme/ledger-kit',
          externalId: 'acme/ledger-kit',
          accessToken: 'provider-token',
        },
        async () => new Response('{}', { status: 200 }),
      ),
    ).resolves.toEqual({
      status: 'pending',
      reason: 'This provider requires manual ownership review',
    });
  });
});

describe('support email verification secrets', () => {
  it('keeps queued support codes out of stored values while allowing worker recovery', () => {
    const secret = 'test-secret';
    const identifier = supportEmailIdentifier('project-1', 'maintainer@example.com', secret);
    const verification = createSupportEmailVerificationValue(identifier, secret);

    expect(verification.value).toMatch(/^support-email:v2:[A-Za-z0-9_-]{22}:[a-f0-9]{64}$/);
    expect(verification.value.split(':')).not.toContain(verification.code);
    expect(supportEmailCodeFromVerificationValue(identifier, verification.value, secret)).toBe(
      verification.code,
    );
    expect(supportEmailCodeMatches(identifier, verification.code, verification.value, secret)).toBe(
      true,
    );
  });

  it('stores only keyed hashes and accepts a code once its hash matches', () => {
    const secret = 'test-secret';
    const identifier = supportEmailIdentifier('project-1', 'maintainer@example.com', secret);
    const code = '123456';
    const hash = supportEmailCodeHash(identifier, code, secret);
    expect(code).toMatch(/^\d{6}$/);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(supportEmailCodeMatches(identifier, code, hash, secret)).toBe(true);
    expect(supportEmailCodeMatches(identifier, '000000', hash, secret)).toBe(false);
    expect(identifier).not.toContain('maintainer@example.com');
  });
});
