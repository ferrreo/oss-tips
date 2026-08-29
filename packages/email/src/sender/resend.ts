import { Resend } from 'resend';
import type { EmailMessage, EmailSender } from '../types.js';

export class ResendEmailSender implements EmailSender {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(apiKey: string, from = 'oss.tips <noreply@oss.tips>') {
    this.resend = new Resend(apiKey);
    this.from = from;
  }

  async send(message: EmailMessage): Promise<{ id: string }> {
    const result = await this.resend.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (result.error) {
      throw new Error(result.error.message);
    }
    return { id: result.data?.id ?? 'unknown' };
  }
}
