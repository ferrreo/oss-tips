import type { EmailMessage, EmailSender } from '../types.js';

export class MockEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<{ id: string }> {
    this.sent.push(message);
    console.info(`[email:mock] to=${message.to} subject=${message.subject}`);
    return { id: `mock_${this.sent.length}` };
  }
}
