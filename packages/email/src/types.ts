export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<{ id: string }>;
}
