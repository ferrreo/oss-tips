import { MockEmailSender } from './mock.js';
import { ResendEmailSender } from './resend.js';
import type { EmailSender } from '../types.js';

export { MockEmailSender } from './mock.js';
export { ResendEmailSender } from './resend.js';

export type EmailSenderOptions = {
  apiKey?: string;
  from?: string;
  allowMock?: boolean;
  nodeEnv?: string;
};

export function createEmailSender(options?: EmailSenderOptions): EmailSender;
export function createEmailSender(apiKey?: string, from?: string): EmailSender;
export function createEmailSender(
  optionsOrApiKey: EmailSenderOptions | string = {},
  legacyFrom?: string,
): EmailSender {
  const options: EmailSenderOptions =
    typeof optionsOrApiKey === 'string'
      ? { apiKey: optionsOrApiKey, ...(legacyFrom ? { from: legacyFrom } : {}) }
      : optionsOrApiKey;
  if (options.apiKey?.trim()) {
    return new ResendEmailSender(options.apiKey, options.from);
  }
  if (options.allowMock === true) {
    if (options.nodeEnv !== 'development' && options.nodeEnv !== 'test') {
      throw new Error('Email mock mode is only allowed in local development or tests');
    }
    return new MockEmailSender();
  }
  throw new Error('RESEND_API_KEY is required; pass allowMock only in tests or local development');
}
