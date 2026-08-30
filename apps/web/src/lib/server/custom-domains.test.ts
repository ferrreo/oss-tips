import { describe, expect, it } from 'vitest';
import {
  canonicalActionUrl,
  canonicalProjectUrl,
  customDomainRoute,
  domainStatusFromProvider,
  graceExpiry,
  normalizeCustomHostname,
} from './custom-domains';
import { validationFields } from './domain-runtime';

describe('custom-domain policy', () => {
  it('normalizes public hostnames and blocks internal or oss.tips names', () => {
    expect(normalizeCustomHostname(' Grove.DEV.')).toEqual({ ok: true, hostname: 'grove.dev' });
    expect(normalizeCustomHostname('oss.tips')).toMatchObject({ ok: false });
    expect(normalizeCustomHostname('admin.oss.tips')).toMatchObject({ ok: false });
    expect(normalizeCustomHostname('localhost')).toMatchObject({ ok: false });
    expect(normalizeCustomHostname('127.0.0.1')).toMatchObject({ ok: false });
    expect(normalizeCustomHostname('bad host.example')).toMatchObject({ ok: false });
  });

  it('maps provider states to visible lifecycle states', () => {
    expect(domainStatusFromProvider('pending_validation', 'pending_validation')).toBe(
      'awaiting_dns',
    );
    expect(domainStatusFromProvider('active', 'pending_deployment')).toBe('validating');
    expect(domainStatusFromProvider('active', 'active')).toBe('active');
    expect(domainStatusFromProvider('validation_timed_out', 'active')).toBe('failed');
    expect(domainStatusFromProvider('deleted', 'active')).toBe('removed');
  });

  it('keeps public reads on custom hosts and sends actions to oss.tips', () => {
    expect(customDomainRoute('/_app/immutable/entry/start.js', 'grove')).toEqual({
      kind: 'rewrite',
      pathname: '/_app/immutable/entry/start.js',
    });
    expect(customDomainRoute('/og-default.png', 'grove')).toEqual({
      kind: 'rewrite',
      pathname: '/og-default.png',
    });
    expect(customDomainRoute('/', 'grove')).toEqual({ kind: 'rewrite', pathname: '/grove' });
    expect(customDomainRoute('/posts/release', 'grove')).toEqual({
      kind: 'rewrite',
      pathname: '/grove/posts/release',
    });
    expect(customDomainRoute('/support', 'grove')).toEqual({
      kind: 'redirect',
      pathname: '/grove/support',
    });
    expect(customDomainRoute('/dashboard/grove', 'grove')).toEqual({
      kind: 'redirect',
      pathname: '/dashboard/grove',
    });
    expect(canonicalProjectUrl('https://oss.tips', 'grove', '/support', '?from=domain')).toBe(
      'https://oss.tips/grove/support?from=domain',
    );
    expect(canonicalActionUrl('https://oss.tips', '/dashboard/grove', '?from=domain')).toBe(
      'https://oss.tips/dashboard/grove?from=domain',
    );
  });

  it('sets a finite grace window', () => {
    const now = new Date('2026-08-29T00:00:00Z');
    expect(graceExpiry(now).toISOString()).toBe('2026-09-28T00:00:00.000Z');
  });

  it('keeps TXT proof and CNAME target when provider returns separate records', () => {
    expect(
      validationFields({
        id: 'cf_123',
        hostname: 'grove.dev',
        status: 'pending_validation',
        sslStatus: 'pending_validation',
        validationRecords: [
          {
            txtName: '_oss-tips.grove.dev',
            txtRecord: 'oss-tips-verify=cf_123',
            cname: null,
            cnameTarget: null,
          },
          { txtName: null, txtRecord: null, cname: 'grove.dev', cnameTarget: 'domains.oss.tips' },
        ],
      }),
    ).toEqual({
      validationName: '_oss-tips.grove.dev',
      validationValue: 'oss-tips-verify=cf_123',
      cnameTarget: 'domains.oss.tips',
    });
  });
});
