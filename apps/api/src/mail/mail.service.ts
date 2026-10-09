import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../config/env.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Envoi d'e-mails via SMTP (Mailpit en développement : http://localhost:8026). */
@Injectable()
export class MailService {
  private static readonly FROM = 'Deskflow <no-reply@deskflow.test>';
  private readonly transporter: Transporter;

  constructor(config: ConfigService<Env, true>) {
    this.transporter = createTransport(config.get('SMTP_URL', { infer: true }));
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: MailService.FROM, ...message });
  }
}
