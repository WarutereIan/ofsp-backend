import { Module } from '@nestjs/common';
import { UssdController } from './ussd.controller';
import { UssdService } from './ussd.service';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { AggregationModule } from '../aggregation/aggregation.module';
import { InputModule } from '../input/input.module';
import { TransportModule } from '../transport/transport.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [AuthModule, MarketplaceModule, AggregationModule, InputModule, TransportModule, PrismaModule, AnalyticsModule],
  controllers: [UssdController],
  providers: [UssdService],
})
export class UssdModule {}

