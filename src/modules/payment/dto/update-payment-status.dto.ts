import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePaymentStatusDto {
  @ApiProperty({
    enum: ['PENDING', 'SECURED', 'RELEASED', 'REFUNDED', 'DISPUTED', 'FAILED'],
  })
  @IsEnum(['PENDING', 'SECURED', 'RELEASED', 'REFUNDED', 'DISPUTED', 'FAILED'])
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transactionReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  failureReason?: string;
}
