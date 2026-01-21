import { Module, forwardRef } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';

@Module({
  imports: [PrismaModule, CommonModule, forwardRef(() => MarketplaceModule)],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
