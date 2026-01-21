import { Module, forwardRef } from '@nestjs/common';
import { AggregationController } from './aggregation.controller';
import { AggregationService } from './aggregation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';

@Module({
  imports: [PrismaModule, CommonModule, forwardRef(() => MarketplaceModule)],
  controllers: [AggregationController],
  providers: [AggregationService],
  exports: [AggregationService],
})
export class AggregationModule {}
