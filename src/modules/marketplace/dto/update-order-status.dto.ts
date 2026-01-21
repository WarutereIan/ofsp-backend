import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: [
      'ORDER_PLACED',
      'ORDER_ACCEPTED',
      'PAYMENT_SECURED',
      'IN_TRANSIT',
      'AT_AGGREGATION',
      'QUALITY_CHECKED',
      'QUALITY_APPROVED',
      'QUALITY_REJECTED',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'COMPLETED',
      'REJECTED',
      'DISPUTED',
      'CANCELLED',
    ],
  })
  @IsEnum([
    'ORDER_PLACED',
    'ORDER_ACCEPTED',
    'PAYMENT_SECURED',
    'IN_TRANSIT',
    'AT_AGGREGATION',
    'QUALITY_CHECKED',
    'QUALITY_APPROVED',
    'QUALITY_REJECTED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'COMPLETED',
    'REJECTED',
    'DISPUTED',
    'CANCELLED',
  ])
  status: string;
}
