import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushNotificationPayload {
  title: string;
  message: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: {
    url?: string;
    entityType?: string;
    entityId?: string;
    [key: string]: any;
  };
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
  tag?: string;
}

@Injectable()
export class WebPushService implements OnModuleInit {
  private readonly logger = new Logger(WebPushService.name);
  private vapidKeys: {
    publicKey: string;
    privateKey: string;
  } | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.initializeVapidKeys();
  }

  private async initializeVapidKeys() {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');

    if (!publicKey || !privateKey) {
      this.logger.warn(
        'VAPID keys not configured. Web push notifications will not work. ' +
        'Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.',
      );
      return;
    }

    this.vapidKeys = {
      publicKey,
      privateKey,
    };

    // Set VAPID details for web-push
    webpush.setVapidDetails(
      this.configService.get<string>('VAPID_SUBJECT') || 'mailto:admin@ofsp.com',
      publicKey,
      privateKey,
    );

    this.logger.log('Web push VAPID keys initialized successfully');
  }

  /**
   * Get VAPID public key for client subscription
   */
  getPublicKey(): string | null {
    return this.vapidKeys?.publicKey || null;
  }

  /**
   * Save push subscription for a user
   */
  async saveSubscription(
    userId: string,
    subscription: PushSubscriptionData,
    userAgent?: string,
    deviceInfo?: any,
  ) {
    try {
      // Check if subscription already exists
      const existing = await this.prisma.pushSubscription.findUnique({
        where: { endpoint: subscription.endpoint },
      });

      if (existing) {
        // Update existing subscription
        return this.prisma.pushSubscription.update({
          where: { endpoint: subscription.endpoint },
          data: {
            userId,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            userAgent,
            deviceInfo,
            updatedAt: new Date(),
          },
        });
      }

      // Create new subscription
      return this.prisma.pushSubscription.create({
        data: {
          userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userAgent,
          deviceInfo,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to save push subscription for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Remove push subscription
   */
  async removeSubscription(endpoint: string) {
    try {
      return this.prisma.pushSubscription.delete({
        where: { endpoint },
      });
    } catch (error) {
      this.logger.error(`Failed to remove push subscription ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Get all subscriptions for a user
   */
  async getUserSubscriptions(userId: string) {
    return this.prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Send push notification to a single subscription
   */
  async sendNotification(
    subscription: PushSubscriptionData,
    payload: PushNotificationPayload,
  ): Promise<boolean> {
    if (!this.vapidKeys) {
      this.logger.warn('VAPID keys not configured. Cannot send push notification.');
      return false;
    }

    try {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      };

      const notificationPayload = JSON.stringify({
        title: payload.title,
        body: payload.message,
        icon: payload.icon || '/icon-192x192.png',
        badge: payload.badge || '/badge-72x72.png',
        image: payload.image,
        data: payload.data,
        actions: payload.actions,
        requireInteraction: payload.requireInteraction,
        silent: payload.silent,
        tag: payload.tag,
      });

      await webpush.sendNotification(pushSubscription, notificationPayload);
      return true;
    } catch (error: any) {
      // Handle subscription errors
      if (error.statusCode === 410 || error.statusCode === 404) {
        // Subscription expired or not found - remove it
        this.logger.warn(`Subscription expired or invalid: ${subscription.endpoint}`);
        try {
          await this.removeSubscription(subscription.endpoint);
        } catch (removeError) {
          this.logger.error(`Failed to remove expired subscription:`, removeError);
        }
      } else {
        this.logger.error(`Failed to send push notification:`, error);
      }
      return false;
    }
  }

  /**
   * Send push notification to all subscriptions for a user
   */
  async sendNotificationToUser(
    userId: string,
    payload: PushNotificationPayload,
  ): Promise<{ sent: number; failed: number }> {
    const subscriptions = await this.getUserSubscriptions(userId);
    
    if (subscriptions.length === 0) {
      this.logger.debug(`No push subscriptions found for user ${userId}`);
      return { sent: 0, failed: 0 };
    }

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        this.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload,
        ),
      ),
    );

    const sent = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    const failed = results.length - sent;

    return { sent, failed };
  }

  /**
   * Send push notification to multiple users
   */
  async sendNotificationToUsers(
    userIds: string[],
    payload: PushNotificationPayload,
  ): Promise<{ sent: number; failed: number }> {
    const results = await Promise.allSettled(
      userIds.map((userId) => this.sendNotificationToUser(userId, payload)),
    );

    let totalSent = 0;
    let totalFailed = 0;

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        totalSent += result.value.sent;
        totalFailed += result.value.failed;
      } else {
        totalFailed++;
      }
    });

    return { sent: totalSent, failed: totalFailed };
  }
}
