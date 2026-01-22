import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsCacheService } from './analytics-cache.service';
import { AnalyticsScheduler } from './analytics.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsCacheService,
    AnalyticsScheduler,
  ],
  exports: [AnalyticsService, AnalyticsCacheService, AnalyticsScheduler],
})
export class AnalyticsModule {}
