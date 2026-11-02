import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { AppConfigService } from '../../config/app-config.service';
import type { MailPort, OutboundMail } from './mail.port';

/**
 * SMTP delivery. A crash after the server accepts the message and before
 * `processed_at` can send the same message again. The token row is not
 * created here.
 */
@Injectable()
export class NodemailerMailer implements MailPort {
  private readonly logger = new Logger(NodemailerMailer.name);
  private transport: Transporter | null = null;

  constructor(private readonly config: AppConfigService) {}

  async send(message: OutboundMail): Promise<void> {
    const transport = this.client();
    await transport.sendMail({
      from: this.config.smtpFrom,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    this.logger.log('Transactional email handed to SMTP');
  }

  private client(): Transporter {
    if (this.transport) {
      return this.transport;
    }
    this.transport = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: false,
      auth:
        this.config.smtpUser !== null && this.config.smtpPassword !== null
          ? {
              user: this.config.smtpUser,
              pass: this.config.smtpPassword,
            }
          : undefined,
    });
    return this.transport;
  }
}
