import { Module } from '@nestjs/common';
import { InputController } from './input.controller';
import { InputService } from './input.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [InputController],
  providers: [InputService],
  exports: [InputService],
})
export class InputModule {}
