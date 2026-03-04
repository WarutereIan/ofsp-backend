import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { WebPushService } from './web-push.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [NotificationController],
  providers: [NotificationService, WebPushService, EmailService, SmsService],
  exports: [NotificationService, WebPushService, EmailService, SmsService],
})
export class NotificationModule {}
