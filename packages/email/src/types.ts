export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<{ id: string }>;
}

export function assertEmailMessage(message: EmailMessage): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.to) || /[\r\n]/.test(message.to)) {
    throw new Error('Invalid recipient email');
  }
  if (!message.subject.trim() || !message.html.trim() || !message.text.trim()) {
    throw new Error('Email message fields must not be empty');
  }
  if (/[\r\n]/.test(message.subject)) throw new Error('Email subject must not contain line breaks');
}
