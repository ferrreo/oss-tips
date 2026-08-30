import { assertEmailMessage, type EmailMessage, type EmailSender } from '../types.js';

export class MockEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<{ id: string }> {
    assertEmailMessage(message);
    this.sent.push(message);
    return { id: `mock_${this.sent.length}` };
  }
}
