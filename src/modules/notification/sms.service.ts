import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/** Africa's Talking Bulk SMS API response (recipient entry) */
export interface AfricaTalkingRecipient {
  statusCode: number;
  number: string;
  status: string;
  cost?: string;
  messageId?: string;
}

export interface AfricaTalkingSmsResponse {
  SMSMessageData?: {
    Message?: string;
    Recipients?: AfricaTalkingRecipient[];
  };
}

export interface SmsNotificationPayload {
  /** SMS body (plain text; keep within 160 chars for single segment where possible) */
  message: string;
}

/**
 * Legacy Send Bulk SMS API (supports sandbox).
 * Live:   https://api.africastalking.com/version1/messaging
 * Sandbox: https://api.sandbox.africastalking.com/version1/messaging
 * POST, Content-Type: application/x-www-form-urlencoded
 * Body: username (required), to (comma-separated), message (required), from (optional), bulkSMSMode (optional, 1 = sender charged)
 */
const AFRICAS_TALKING_BULK_PATH = '/version1/messaging';
const DEFAULT_LIVE_BASE = 'https://api.africastalking.com';
const SANDBOX_BASE = 'https://api.sandbox.africastalking.com';

/**
 * Normalize phone to E.164-like form for Africa's Talking.
 * Assumes Kenyan numbers if 9 digits or 10 digits without country code.
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('7')) {
    return `+254${digits}`;
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    return `+254${digits.slice(1)}`;
  }
  if (digits.length >= 9 && !phone.trim().startsWith('+')) {
    return `+${digits}`;
  }
  return phone.trim();
}

@Injectable()
export class SmsService implements OnModuleInit {
  private readonly logger = new Logger(SmsService.name);
  private apiKey: string | null = null;
  private username: string = 'sandbox';
  private senderId: string = 'OFSP';
  private baseUrl: string = SANDBOX_BASE;
  private enabled = false;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    const apiKey = this.configService.get<string>('AFRICAS_TALKING_API_KEY');
    const username = this.configService.get<string>('AFRICAS_TALKING_USERNAME') ?? 'sandbox';
    const senderId = this.configService.get<string>('AFRICAS_TALKING_SENDER_ID') ?? 'OFSP';
    const useSandbox = this.configService.get<string>('AFRICAS_TALKING_SANDBOX') !== 'false';

    if (!apiKey?.trim()) {
      this.logger.warn(
        "Africa's Talking SMS not configured. SMS notifications will not be sent. " +
          "Set AFRICAS_TALKING_API_KEY (and optionally AFRICAS_TALKING_USERNAME, AFRICAS_TALKING_SENDER_ID) in .env",
      );
      return;
    }

    this.apiKey = apiKey.trim();
    this.username = username.trim();
    this.senderId = senderId.trim();
    this.baseUrl = useSandbox ? SANDBOX_BASE : DEFAULT_LIVE_BASE;
    this.enabled = true;
    this.logger.log(
      `Africa's Talking SMS initialized (${useSandbox ? 'sandbox' : 'live'}, username: ${this.username})`,
    );
  }

  /**
   * Send an SMS to a user by ID.
   * Resolves user phone from DB; skips if no phone or SMS not configured.
   * Returns messageId and phone when successful so callers can register for DLR callbacks.
   */
  async sendNotificationToUser(
    userId: string,
    payload: SmsNotificationPayload,
  ): Promise<{ success: boolean; error?: string; messageId?: string; phone?: string }> {
    if (!this.enabled || !this.apiKey) {
      this.logger.debug('SMS channel skipped: Africa\'s Talking not configured');
      return { success: false, error: 'SMS not configured' };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });

    if (!user?.phone?.trim()) {
      this.logger.debug(`SMS skipped for user ${userId}: no phone on file`);
      return { success: false, error: 'User has no phone number' };
    }

    const to = normalizePhone(user.phone);
    const message = (payload.message || '').trim();
    if (!message) {
      this.logger.debug(`SMS skipped for user ${userId}: empty message`);
      return { success: false, error: 'Empty message' };
    }

    const result = await this.sendBulk([to], message);
    return {
      ...result,
      phone: result.success ? to : undefined,
    };
  }

  /**
   * Send the same SMS to multiple phone numbers (bulk).
   * Use for broadcast notifications.
   */
  async sendBulk(
    phoneNumbers: string[],
    message: string,
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    if (!this.enabled || !this.apiKey) {
      return { success: false, error: 'SMS not configured' };
    }

    const normalized = phoneNumbers
      .map((p) => normalizePhone(p))
      .filter((p) => p.length >= 10);

    if (normalized.length === 0) {
      return { success: false, error: 'No valid phone numbers' };
    }

    const url = `${this.baseUrl}${AFRICAS_TALKING_BULK_PATH}`;
    // Legacy bulk SMS: form-urlencoded (username, to, message, from); bulkSMSMode=1 = sender gets charged
    const form = new URLSearchParams();
    form.set('username', this.username);
    form.set('to', normalized.join(','));
    form.set('message', message.trim());
    form.set('from', this.senderId);
    form.set('bulkSMSMode', '1');

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          apiKey: this.apiKey,
        },
        body: form.toString(),
      });

      const text = await res.text();
      let data: AfricaTalkingSmsResponse & { error?: string } = {};
      try {
        data = JSON.parse(text) as AfricaTalkingSmsResponse & { error?: string };
      } catch {
        this.logger.warn(`Africa's Talking non-JSON response: ${text.slice(0, 200)}`);
      }

      if (!res.ok) {
        const errMsg = data.error || data.SMSMessageData?.Message || text || `HTTP ${res.status}`;
        this.logger.warn(`Africa's Talking SMS failed: ${errMsg}`);
        return { success: false, error: errMsg };
      }

      const recipients = data.SMSMessageData?.Recipients ?? [];
      const failed = recipients.filter((r) => r.statusCode !== 100 && r.statusCode !== 101 && r.statusCode !== 102);
      if (failed.length > 0) {
        const firstFailure = failed[0];
        this.logger.warn(
          `Africa's Talking partial failure: ${firstFailure.status} (${firstFailure.statusCode}) for ${firstFailure.number}`,
        );
        return {
          success: false,
          error: `${firstFailure.status} (${firstFailure.statusCode})`,
        };
      }

      const messageId = recipients[0]?.messageId;
      this.logger.debug(`SMS sent to ${normalized.length} recipient(s)${messageId ? `, messageId: ${messageId}` : ''}`);
      return { success: true, messageId };
    } catch (err: any) {
      this.logger.error(`Africa's Talking SMS request failed:`, err?.message ?? err);
      return {
        success: false,
        error: err?.message ?? 'Request failed',
      };
    }
  }
}
