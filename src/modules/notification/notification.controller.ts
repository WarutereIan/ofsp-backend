import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { WebPushService } from './web-push.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { MarkAsReadDto } from './dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly webPushService: WebPushService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  async getNotifications(
    @CurrentUser() user: any,
    @Query('type') type?: string,
    @Query('isRead') isRead?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.notificationService.getNotifications({
      userId: user.id,
      type,
      isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
      entityType,
      entityId,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get notification statistics' })
  async getNotificationStats(@CurrentUser() user: any) {
    return this.notificationService.getNotificationStats(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification by ID' })
  async getNotificationById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationService.getNotificationById(id, user.id);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationService.markAsRead(id, user.id);
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: any) {
    return this.notificationService.markAllAsRead(user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification' })
  async deleteNotification(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationService.deleteNotification(id, user.id);
  }

  @Delete('read/all')
  @ApiOperation({ summary: 'Delete all read notifications' })
  async deleteAllRead(@CurrentUser() user: any) {
    return this.notificationService.deleteAllRead(user.id);
  }

  // ============ Web Push Subscription Management ============

  @Public()
  @Get('push/public-key')
  @ApiOperation({ summary: 'Get VAPID public key for web push subscription' })
  async getPublicKey() {
    const publicKey = this.webPushService.getPublicKey();
    if (!publicKey) {
      return { error: 'Web push is not configured' };
    }
    return { publicKey };
  }

  @Post('push/subscribe')
  @ApiOperation({ summary: 'Subscribe to web push notifications' })
  async subscribe(
    @CurrentUser() user: any,
    @Body() subscription: {
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
    },
    @Req() req: any,
  ) {
    const userAgent = req.headers['user-agent'];
    const deviceInfo = {
      platform: req.headers['sec-ch-ua-platform'] || 'unknown',
      userAgent,
    };

    return this.webPushService.saveSubscription(
      user.id,
      subscription,
      userAgent,
      deviceInfo,
    );
  }

  @Post('push/unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from web push notifications' })
  async unsubscribe(@Body() body: { endpoint: string }) {
    return this.webPushService.removeSubscription(body.endpoint);
  }

  @Get('push/subscriptions')
  @ApiOperation({ summary: 'Get user push subscriptions' })
  async getSubscriptions(@CurrentUser() user: any) {
    return this.webPushService.getUserSubscriptions(user.id);
  }

  // ============ Africa's Talking SMS Delivery Report (DLR) Callback ============
  // Configure this URL in Africa's Talking dashboard: https://account.africastalking.com
  // See: https://developers.africastalking.com/docs/sms/notifications

  @Public()
  @Post('sms-delivery-callback')
  @ApiOperation({ summary: 'Africa\'s Talking SMS delivery report webhook (DLR)' })
  async smsDeliveryCallback(@Body() body: any) {
    return this.notificationService.handleSmsDeliveryReport(body);
  }
}
