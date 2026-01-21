import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MarkAsReadDto } from './dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

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
}
