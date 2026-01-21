import { Module } from '@nestjs/common';
import { PrismaModule } from '../modules/prisma/prisma.module';
import { NotificationHelperService } from './services/notification.service';
import { ActivityLogService } from './services/activity-log.service';

@Module({
  imports: [PrismaModule],
  providers: [NotificationHelperService, ActivityLogService],
  exports: [NotificationHelperService, ActivityLogService],
})
export class CommonModule {}
