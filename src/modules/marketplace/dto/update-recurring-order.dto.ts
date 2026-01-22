import { IsOptional, IsNumber, IsString, IsEnum, IsDateString, IsBoolean, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRecurringOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerKg?: number;

  @ApiPropertyOptional({ enum: ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'CUSTOM'] })
  @IsOptional()
  @IsEnum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'CUSTOM'])
  frequency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextDeliveryDate?: string;

  @ApiPropertyOptional({ enum: ['active', 'paused', 'cancelled'] })
  @IsOptional()
  @IsString()
  status?: string;
}
