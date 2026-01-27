import { Module, forwardRef } from '@nestjs/common';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';
import { BadgeModule } from '../badge/badge.module';
import { TransportModule } from '../transport/transport.module';

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    forwardRef(() => BadgeModule),
    forwardRef(() => TransportModule),
  ],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
