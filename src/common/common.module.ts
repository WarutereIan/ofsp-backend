import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../modules/prisma/prisma.module';
import { NotificationModule } from '../modules/notification/notification.module';
import { NotificationHelperService } from './services/notification.service';
import { ActivityLogService } from './services/activity-log.service';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    forwardRef(() => NotificationModule), // Import NotificationModule to access WebPushService
  ],
  providers: [NotificationHelperService, ActivityLogService],
  exports: [NotificationHelperService, ActivityLogService],
})
export class CommonModule {}
