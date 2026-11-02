export const MAIL_PORT = Symbol('MAIL_PORT');

export interface OutboundMail {
  to: string;
  subject: string;
  text: string;
}

export interface MailPort {
  send(message: OutboundMail): Promise<void>;
}
