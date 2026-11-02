import { Module } from '@nestjs/common';
import { MAIL_PORT } from './mail.port';
import { NodemailerMailer } from './nodemailer-mailer';

@Module({
  providers: [
    NodemailerMailer,
    { provide: MAIL_PORT, useExisting: NodemailerMailer },
  ],
  exports: [MAIL_PORT, NodemailerMailer],
})
export class MailModule {}
