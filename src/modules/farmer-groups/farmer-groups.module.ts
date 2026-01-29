import { Module } from '@nestjs/common';
import { FarmerGroupsController } from './farmer-groups.controller';
import { FarmerGroupsService } from './farmer-groups.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [FarmerGroupsController],
  providers: [FarmerGroupsService],
  exports: [FarmerGroupsService],
})
export class FarmerGroupsModule {}
