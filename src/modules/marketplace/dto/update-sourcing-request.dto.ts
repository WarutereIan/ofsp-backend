import { IsString, IsNumber, IsEnum, IsDateString, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSourcingRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ enum: ['FRESH_ROOTS', 'PROCESS_GRADE', 'PLANTING_VINES', 'OFSP'] })
  @IsOptional()
  @IsEnum(['FRESH_ROOTS', 'PROCESS_GRADE', 'PLANTING_VINES', 'OFSP'])
  productType?: string;

  @ApiPropertyOptional({ enum: ['KENYA', 'SPK004', 'KAKAMEGA', 'KABODE', 'OTHER'] })
  @IsOptional()
  @IsEnum(['KENYA', 'SPK004', 'KAKAMEGA', 'KABODE', 'OTHER'])
  variety?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsEnum(['kg', 'tons', 'units'])
  unit?: string;

  @ApiPropertyOptional({ enum: ['A', 'B', 'C'] })
  @IsOptional()
  @IsEnum(['A', 'B', 'C'])
  qualityGrade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
