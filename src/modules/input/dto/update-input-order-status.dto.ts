import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateInputOrderStatusDto {
  @ApiProperty({
    enum: [
      'PENDING',
      'ACCEPTED',
      'PROCESSING',
      'READY_FOR_PICKUP',
      'IN_TRANSIT',
      'DELIVERED',
      'COMPLETED',
      'CANCELLED',
      'REJECTED',
    ],
  })
  @IsEnum([
    'PENDING',
    'ACCEPTED',
    'PROCESSING',
    'READY_FOR_PICKUP',
    'IN_TRANSIT',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED',
    'REJECTED',
  ])
  status: string;

  @ApiPropertyOptional({
    enum: ['PENDING', 'PAID', 'REFUNDED'],
  })
  @IsOptional()
  @IsEnum(['PENDING', 'PAID', 'REFUNDED'])
  paymentStatus?: string;
}
