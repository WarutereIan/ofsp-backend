import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';

export interface EmailNotificationPayload {
  subject: string;
  /** Plain text body */
  text?: string;
  /** HTML body (optional; if not set, text is used) */
  html?: string;
  /** Optional CTA link shown in email */
  actionUrl?: string;
  /** Optional CTA label */
  actionLabel?: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private fromEmail: string = '';

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const from = this.configService.get<string>('RESEND_FROM_EMAIL');

    if (!apiKey || !from) {
      this.logger.warn(
        'Resend not configured. Email notifications will not be sent. ' +
          'Set RESEND_API_KEY and RESEND_FROM_EMAIL (e.g. notifications@yourdomain.com) in .env',
      );
      return;
    }

    this.resend = new Resend(apiKey);
    this.fromEmail = from;
    this.logger.log('Resend email service initialized');
  }

  /**
   * Send a notification email to a user by ID.
   * Resolves user email from DB; skips if user has no email or Resend is not configured.
   */
  async sendNotificationToUser(
    userId: string,
    payload: EmailNotificationPayload,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.resend) {
      this.logger.debug('Email channel skipped: Resend not configured');
      return { success: false, error: 'Resend not configured' };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user?.email?.trim()) {
      this.logger.debug(`Email channel skipped for user ${userId}: no email on file`);
      return { success: false, error: 'User has no email' };
    }

    const html =
      payload.html ??
      this.buildSimpleHtml(
        payload.subject,
        payload.text ?? '',
        payload.actionUrl,
        payload.actionLabel,
      );
    const text = payload.text ?? payload.subject;

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: user.email,
        subject: payload.subject,
        text,
        html,
      });

      if (error) {
        this.logger.warn(`Resend send failed for user ${userId}: ${error.message}`);
        return { success: false, error: error.message };
      }

      this.logger.debug(`Email sent to user ${userId}, id: ${data?.id}`);
      return { success: true };
    } catch (err: any) {
      this.logger.error(`Failed to send email to user ${userId}:`, err?.message ?? err);
      return {
        success: false,
        error: err?.message ?? 'Unknown error',
      };
    }
  }

  private buildSimpleHtml(
    subject: string,
    body: string,
    actionUrl?: string,
    actionLabel?: string,
  ): string {
    const escapedSubject = this.escapeHtml(subject);
    const escapedBody = this.escapeHtml(body).replace(/\n/g, '<br>');
    const cta =
      actionUrl && actionLabel
        ? `<p><a href="${this.escapeHtml(actionUrl)}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">${this.escapeHtml(actionLabel)}</a></p>`
        : '';
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapedSubject}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:20px;">
  <h2 style="margin-top:0;">${escapedSubject}</h2>
  <p style="color:#374151;line-height:1.5;">${escapedBody}</p>
  ${cta}
  <p style="color:#9ca3af;font-size:12px;margin-top:24px;">This is an automated message from the platform.</p>
</body>
</html>`;
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
