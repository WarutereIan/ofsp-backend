import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTransportRequestStatusDto {
  @ApiProperty({
    enum: [
      'PENDING',
      'ACCEPTED',
      'REJECTED',
      'IN_TRANSIT',
      'DELIVERED',
      'COMPLETED',
      'CANCELLED',
    ],
  })
  @IsEnum([
    'PENDING',
    'ACCEPTED',
    'REJECTED',
    'IN_TRANSIT',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED',
  ])
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerId?: string;
}
