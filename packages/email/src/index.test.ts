import { describe, expect, it } from 'vitest';
import { renderOtpEmail, createEmailSender, MockEmailSender } from './index.js';

describe('OTP template', () => {
  it('returns subject, html, and text', () => {
    const email = renderOtpEmail({ code: '123456', expiresMinutes: 5 });
    expect(email.subject).toContain('sign-in');
    expect(email.text).toContain('123456');
    expect(email.html).toContain('123456');
    expect(email.html).toContain('<!DOCTYPE html>');
  });
});

describe('email sender', () => {
  it('uses mock when RESEND_API_KEY unset', async () => {
    const sender = createEmailSender();
    expect(sender).toBeInstanceOf(MockEmailSender);
    const result = await sender.send({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>hi</p>',
      text: 'hi',
    });
    expect(result.id).toMatch(/^mock_/);
  });
});
