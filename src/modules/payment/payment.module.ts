import { Module, forwardRef } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { TransportModule } from '../transport/transport.module';

@Module({
  imports: [PrismaModule, CommonModule, forwardRef(() => MarketplaceModule), forwardRef(() => TransportModule)],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
