import { describe, expect, it } from 'vitest';
import {
  EMAIL_LOCALES,
  createEmailSender,
  formatEmailDate,
  MockEmailSender,
  renderApiKeyChangeEmail,
  renderDomainFailureEmail,
  renderMembershipEmail,
  renderOtpEmail,
  renderPostPublishedEmail,
  renderProjectReviewEmail,
  renderReceiptEmail,
  renderRefundEmail,
  renderDisputeEmail,
  renderSecurityChangeEmail,
  renderSecurityEventEmail,
  renderStripeRestrictionEmail,
  renderTeamInviteEmail,
  renderThankYouReplyEmail,
  renderWebhookChangeEmail,
} from './index.js';

describe('OTP template', () => {
  it('returns subject, html, and text', () => {
    const email = renderOtpEmail({ code: '123456', expiresMinutes: 5 });
    expect(email.subject).toContain('sign-in');
    expect(email.text).toContain('123456');
    expect(email.html).toContain('123456');
    expect(email.html).toContain('<!DOCTYPE html>');
  });

  it.each(EMAIL_LOCALES)('renders support-email purpose in %s', (locale) => {
    const email = renderOtpEmail({
      code: '123456',
      expiresMinutes: 10,
      purpose: 'support-email',
      locale,
    });
    expect(email.subject).not.toBe(
      renderOtpEmail({ code: '123456', expiresMinutes: 10, locale }).subject,
    );
    expect(email.text).toContain('123456');
  });

  it('rejects malformed codes', () => {
    expect(() => renderOtpEmail({ code: '12345', expiresMinutes: 5 })).toThrow('six digits');
  });
});

describe('email sender', () => {
  it('requires an explicit provider in place of a silent mock fallback', () => {
    expect(() => createEmailSender()).toThrow('RESEND_API_KEY is required');
  });

  it('uses mock only when explicitly enabled', async () => {
    const sender = createEmailSender({ allowMock: true, nodeEnv: 'test' });
    expect(sender).toBeInstanceOf(MockEmailSender);
    const result = await sender.send({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>hi</p>',
      text: 'hi',
    });
    expect(result.id).toMatch(/^mock_/);
  });

  it('rejects mock mode in production', () => {
    expect(() => createEmailSender({ allowMock: true, nodeEnv: 'production' })).toThrow(
      'only allowed in local development or tests',
    );
  });

  it('rejects header injection', async () => {
    const sender = new MockEmailSender();
    await expect(
      sender.send({
        to: 'test@example.com',
        subject: 'Test\nBcc: attacker@example.com',
        html: '<p>hi</p>',
        text: 'hi',
      }),
    ).rejects.toThrow('line breaks');
  });
});

describe('template safety and financial clarity', () => {
  it('escapes project-authored values and allows only HTTP(S) links', () => {
    const receipt = renderReceiptEmail({
      projectName: '<Grove>',
      projectAmount: '£10.00',
      currency: 'gbp',
      platformFees: '£0.20',
      receiptUrl: 'https://oss.tips/receipt/abc',
    });
    expect(receipt.html).toContain('&lt;Grove&gt;');
    expect(receipt.html).not.toContain('<Grove>');
    expect(() =>
      renderThankYouReplyEmail({
        projectName: 'Grove',
        messagePreview: 'Thanks',
        threadUrl: 'javascript:alert(1)',
      }),
    ).toThrow('HTTP(S)');
  });

  it('names project amount and platform fees in membership mail', () => {
    const email = renderMembershipEmail({
      event: 'renewed',
      projectName: 'Grove',
      projectAmount: '£5.00',
      currency: 'gbp',
      platformFees: '£0.10',
    });
    expect(email.text).toContain('Project amount: £5.00 GBP');
    expect(email.text).toContain('oss.tips project fee: £0.10 GBP');
  });

  it('keeps dispute amounts and fees distinct when fee data is available', () => {
    const email = renderDisputeEmail({
      projectName: 'Grove',
      disputeStatus: 'needs response',
      amount: '£5.00',
      currency: 'gbp',
      platformFees: '£0.10',
    });
    expect(email.text).toContain('Amount: £5.00 GBP');
    expect(email.text).toContain('oss.tips project fee: £0.10 GBP');
  });
});

describe('localized operational templates', () => {
  const renderAll = (locale: string) => [
    renderOtpEmail({ code: '123456', expiresMinutes: 5, locale }),
    renderSecurityEventEmail({ event: 'passkey', ip: '203.0.113.4', userAgent: 'Browser', locale }),
    renderTeamInviteEmail({
      projectName: 'Grove',
      role: 'editor',
      inviteUrl: 'https://oss.tips/invite/abc',
      expiresAt: '2026-08-30T12:00:00.000Z',
      locale,
    }),
    renderMembershipEmail({
      event: 'renewed',
      projectName: 'Grove',
      projectAmount: '£5.00',
      currency: 'gbp',
      platformFees: '£0.10',
      locale,
    }),
    renderReceiptEmail({
      projectName: 'Grove',
      projectAmount: '£5.00',
      currency: 'gbp',
      platformFees: '£0.10',
      receiptUrl: 'https://oss.tips/receipt/abc',
      locale,
    }),
    renderRefundEmail({
      projectName: 'Grove',
      refundAmount: '£5.00',
      currency: 'gbp',
      platformFeesRefunded: '£0.10',
      reason: 'Duplicate payment',
      locale,
    }),
    renderDisputeEmail({
      projectName: 'Grove',
      disputeStatus: 'needs response',
      amount: '£5.00',
      currency: 'gbp',
      platformFees: '£0.10',
      locale,
    }),
    renderPostPublishedEmail({
      projectName: 'Grove',
      title: 'Release notes',
      postUrl: 'https://oss.tips/grove/posts/release-notes',
      locale,
    }),
    renderThankYouReplyEmail({
      projectName: 'Grove',
      messagePreview: 'Thanks for the note.',
      threadUrl: 'https://oss.tips/reply/abc',
      locale,
    }),
  ];

  it.each(EMAIL_LOCALES.slice(1))('localizes every renderer in %s', (locale) => {
    const english = renderAll('en-GB').map(
      (email) => `${email.subject}\n${email.html}\n${email.text}`,
    );
    const translated = renderAll(locale).map(
      (email) => `${email.subject}\n${email.html}\n${email.text}`,
    );
    expect(translated).not.toEqual(english);
  });

  it.each(EMAIL_LOCALES)('renders required notices in %s', (locale) => {
    const review = renderProjectReviewEmail({
      projectName: 'Grove',
      status: 'action_required',
      locale,
    });
    const stripe = renderStripeRestrictionEmail({
      projectName: 'Grove',
      restriction: 'Verify the account',
      locale,
    });
    const apiKey = renderApiKeyChangeEmail({
      projectName: 'Grove',
      action: 'revoked',
      keyName: 'Deploy key',
      locale,
    });
    const webhook = renderWebhookChangeEmail({
      projectName: 'Grove',
      change: 'secret_rotated',
      endpoint: 'hooks.grove.dev',
      locale,
    });
    const security = renderSecurityChangeEmail({
      projectName: 'Grove',
      change: 'Passkey added',
      locale,
    });
    const domain = renderDomainFailureEmail({
      projectName: 'Grove',
      domain: 'grove.dev',
      failure: 'Certificate renewal failed',
      locale,
    });

    for (const email of [review, stripe, apiKey, webhook, security, domain]) {
      expect(`${email.subject} ${email.text}`).toContain('Grove');
      expect(email.html).toContain('<!DOCTYPE html>');
      expect(email.html).not.toMatch(/[—–]/);
      expect(email.text).not.toMatch(/[—–]/);
      expect(email.text).not.toMatch(/\{(?:projectName|action|status|change|domain|failure)\}/);
    }
  });

  it('localizes known team invite roles', () => {
    const email = renderTeamInviteEmail({
      projectName: 'Grove',
      role: 'finance',
      inviteUrl: 'https://oss.tips/invite/abc',
      expiresAt: '2026-08-30T12:00:00.000Z',
      locale: 'de',
    });
    expect(email.text).toContain('Finanzmitglied');
    expect(email.text).not.toContain('finance');
  });

  it('keeps post bodies out of published notifications', () => {
    const email = renderPostPublishedEmail({
      projectName: 'Grove',
      title: 'Release notes',
      postUrl: 'https://oss.tips/grove/posts/release-notes',
    });
    expect(email.text).toBe(
      'Grove published a new post: Release notes\n\nRead post: https://oss.tips/grove/posts/release-notes',
    );
    expect(email.html).toContain('Read post');
    expect(email.html).not.toContain('<p>A short update.</p>');
  });

  it.each(EMAIL_LOCALES)('renders every project review state in %s', (locale) => {
    for (const status of ['approved', 'rejected', 'action_required'] as const) {
      const email = renderProjectReviewEmail({ projectName: 'Grove', status, locale });
      expect(`${email.subject} ${email.text}`).toContain('Grove');
      expect(email.text).not.toMatch(/\{(?:projectName|status)\}/);
    }
  });

  it.each(EMAIL_LOCALES)('renders every operational key change in %s', (locale) => {
    for (const action of ['created', 'revoked'] as const) {
      expect(renderApiKeyChangeEmail({ projectName: 'Grove', action, locale }).text).toContain(
        'Grove',
      );
    }
    for (const change of [
      'created',
      'updated',
      'removed',
      'secret_rotated',
      'enabled',
      'disabled',
      'status_updated',
    ] as const) {
      expect(renderWebhookChangeEmail({ projectName: 'Grove', change, locale }).text).toContain(
        'Grove',
      );
    }
  });

  it('resolves language tags and formats dates for the email locale', () => {
    expect(formatEmailDate('2026-08-30T12:00:00.000Z', 'de-DE')).toBe('30.08.2026');
    expect(formatEmailDate('not a date', 'fr')).toBe('not a date');
  });
});
