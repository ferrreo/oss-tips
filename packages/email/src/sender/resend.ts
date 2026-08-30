import { Resend } from 'resend';
import { assertEmailMessage, type EmailMessage, type EmailSender } from '../types.js';

export class ResendEmailSender implements EmailSender {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(apiKey: string, from = 'oss.tips <noreply@oss.tips>') {
    if (!apiKey.trim()) throw new Error('RESEND_API_KEY is required');
    if (!from.trim() || /[\r\n]/.test(from)) throw new Error('Email sender address is invalid');
    this.resend = new Resend(apiKey);
    this.from = from;
  }

  async send(message: EmailMessage): Promise<{ id: string }> {
    assertEmailMessage(message);
    const result = await this.resend.emails.send(
      {
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      },
      message.idempotencyKey ? { idempotencyKey: message.idempotencyKey } : undefined,
    );
    if (result.error) {
      throw new Error(result.error.message);
    }
    const id = result.data?.id;
    if (!id) throw new Error('Resend did not return a message id');
    return { id };
  }
}
