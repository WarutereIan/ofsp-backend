import { Module, forwardRef } from '@nestjs/common';
import { TransportController } from './transport.controller';
import { TransportService } from './transport.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';

@Module({
  imports: [PrismaModule, CommonModule, forwardRef(() => MarketplaceModule)],
  controllers: [TransportController],
  providers: [TransportService],
  exports: [TransportService],
})
export class TransportModule {}
