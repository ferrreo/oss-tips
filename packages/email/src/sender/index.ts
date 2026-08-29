import { MockEmailSender } from './mock.js';
import { ResendEmailSender } from './resend.js';
import type { EmailSender } from '../types.js';

export { MockEmailSender } from './mock.js';
export { ResendEmailSender } from './resend.js';

export function createEmailSender(apiKey?: string, from?: string): EmailSender {
  if (apiKey && apiKey.length > 0) {
    return new ResendEmailSender(apiKey, from);
  }
  return new MockEmailSender();
}
